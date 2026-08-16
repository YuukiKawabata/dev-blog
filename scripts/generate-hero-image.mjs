#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

/**
 * Generate a hero image via the Gemini API (Nano Banana / gemini-3.1-flash-image)
 * and save it as public/images/hero/<slug>.webp.
 *
 * Uses the newer Interactions API (POST /v1beta/interactions), not the classic
 * generateContent + inlineData shape used by older image models — this model
 * line returns the image at `output_image.data`, with a `steps[]` fallback for
 * interleaved responses. Response parsing is defensive because this endpoint
 * has not been exercised against a real key yet at the time of writing.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(path.join(REPO_ROOT, '.env'));
} catch {
  // no .env — fine
}

const MODEL = 'gemini-3.1-flash-image';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const HERO_DIR = path.join(REPO_ROOT, 'public/images/hero');
const WIDTH = 1672;
const HEIGHT = 941;

// Matches the look of the hand-picked hero images already in the repo:
// dark background, blue-to-purple gradient, abstract/conceptual — never a
// literal product screenshot, and never text or logos (image models render
// text unreliably, and a wrong logo would misrepresent a real company).
const STYLE_GUIDE = `暗い背景に、青から紫へのグラデーションを基調にした、抽象的でコンセプチュアルなテクノロジーイラスト。
幾何学的な図形、ホログラム的な光の粒子、繊細なグロー効果で構成する。
文字・ロゴ・実在する企業や人物の顔は描かない。写実的な物撮りではなく、コンセプチュアルなビジュアルにする。
16:9の横長構図、洗練されたエディトリアルイラストのトーン。`;

function parseArgs(argv) {
  const args = { force: false, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const value = () => argv[(i += 1)];

    switch (token) {
      case '--slug':
        args.slug = value();
        break;
      case '--theme':
        args.theme = value();
        break;
      case '--out':
        args.out = value();
        break;
      case '--force':
        args.force = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`generate-hero-image — create a hero image via the Gemini API

Usage:
  node scripts/generate-hero-image.mjs --slug <basename> --theme "記事のテーマ" [--force]

Options:
  --slug    Output filename without extension (matches the blog post basename)
  --theme   Short description of the article's subject, in Japanese or English.
            Fed into a fixed style guide — do not include text/logo requests,
            image models render those unreliably.
  --out     Output directory (default: public/images/hero)
  --force   Regenerate even if the file already exists

Environment:
  GEMINI_API_KEY   Required. From https://aistudio.google.com → "Get API key"

Cost: roughly $0.045 per image at the time of writing. One call per run —
failures are not retried automatically.
`);
}

function readGeminiApiKey(env = process.env) {
  const key = env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY が .env にありません。\n' +
        'https://aistudio.google.com → "Get API key" → "Create API key" で発行し、\n' +
        '.env に GEMINI_API_KEY=... を追加してください。'
    );
  }
  return key;
}

/**
 * Extract the base64 image payload from an Interactions API response.
 * Tries the documented simple-case field first, then the steps[] fallback
 * used for interleaved text/image output.
 */
function extractImageBase64(json) {
  const direct = json?.output_image?.data;
  if (direct) return direct;

  const fromSteps = json?.steps?.flatMap((step) => step?.content ?? [])?.find((item) => item?.type === 'image')?.data;
  if (fromSteps) return fromSteps;

  return null;
}

async function callGemini(prompt, apiKey) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      input: [{ type: 'text', text: prompt }],
      response_format: {
        type: 'image',
        mime_type: 'image/png',
        aspect_ratio: '16:9',
        image_size: '1K',
      },
    }),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Gemini API returned non-JSON (${response.status}):\n${text.slice(0, 500)}`);
  }

  if (!response.ok) {
    throw new Error(`Gemini API error (${response.status}): ${JSON.stringify(json).slice(0, 500)}`);
  }

  const base64 = extractImageBase64(json);
  if (!base64) {
    throw new Error(
      'レスポンスから画像データを取り出せませんでした。API仕様が変わった可能性があります。\n' +
        `生のレスポンス（先頭1000文字）:\n${JSON.stringify(json, null, 2).slice(0, 1000)}`
    );
  }

  return Buffer.from(base64, 'base64');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.slug) throw new Error('--slug は必須です。');

  const apiKey = readGeminiApiKey();
  const outDir = args.out ? path.resolve(REPO_ROOT, args.out) : HERO_DIR;
  const outPath = path.join(outDir, `${args.slug}.webp`);

  if (!args.force) {
    try {
      await fs.access(outPath);
      console.log(`[skip] already exists: ${path.relative(REPO_ROOT, outPath)} (use --force to regenerate)`);
      return;
    } catch {
      // doesn't exist — proceed
    }
  }

  const prompt = `${STYLE_GUIDE}\n\nテーマ: ${args.theme ?? args.slug}`;

  console.log(`[generate] calling Gemini API (${MODEL})...`);
  const imageBuffer = await callGemini(prompt, apiKey);

  await fs.mkdir(outDir, { recursive: true });
  await sharp(imageBuffer).resize(WIDTH, HEIGHT, { fit: 'cover' }).webp({ quality: 90 }).toFile(outPath);

  console.log(`[generate] saved ${path.relative(REPO_ROOT, outPath)} (${WIDTH}x${HEIGHT})`);
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
