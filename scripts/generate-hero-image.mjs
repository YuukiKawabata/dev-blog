#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

/**
 * Generate a hero image and save it as public/images/hero/<slug>.webp.
 *
 * OpenAI (gpt-image-1.5) is the default provider — its images/generations
 * API is stable and well-documented. Gemini (gemini-3.1-flash-image) is kept
 * as a fallback via --provider gemini; it needs Google AI Studio prepay
 * credits, not just a linked card, and uses a newer /v1beta/interactions
 * endpoint rather than the classic generateContent + inlineData shape.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(path.join(REPO_ROOT, '.env'));
} catch {
  // no .env — fine
}

const HERO_DIR = path.join(REPO_ROOT, 'public/images/hero');
const WIDTH = 1672;
const HEIGHT = 941;

const OPENAI_MODEL = 'gpt-image-1.5';
const OPENAI_QUALITY = 'medium'; // low $0.01-ish / medium $0.05-ish / high $0.20-ish per image
const OPENAI_SIZE = '1536x1024'; // closest supported landscape size to 16:9; cropped to WIDTH x HEIGHT after

const GEMINI_MODEL = 'gemini-3.1-flash-image';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

// Matches the look of the hand-picked hero images already in the repo:
// dark background, blue-to-purple gradient, abstract/conceptual — never a
// literal product screenshot, and never text or logos (image models render
// text unreliably, and a wrong logo would misrepresent a real company).
const STYLE_GUIDE = `暗い背景に、青から紫へのグラデーションを基調にした、抽象的でコンセプチュアルなテクノロジーイラスト。
幾何学的な図形、ホログラム的な光の粒子、繊細なグロー効果で構成する。
文字・ロゴ・実在する企業や人物の顔は描かない。写実的な物撮りではなく、コンセプチュアルなビジュアルにする。
16:9の横長構図、洗練されたエディトリアルイラストのトーン。`;

function parseArgs(argv) {
  const args = { provider: 'openai', force: false, help: false };

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
      case '--provider':
        args.provider = value();
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
  console.log(`generate-hero-image — create a hero image via an image-generation API

Usage:
  node scripts/generate-hero-image.mjs --slug <basename> --theme "記事のテーマ" [options]

Options:
  --slug      Output filename without extension (matches the blog post basename)
  --theme     Short description of the article's subject, in Japanese or English.
              Fed into a fixed style guide — do not include text/logo requests,
              image models render those unreliably.
  --provider  openai (default) | gemini
  --out       Output directory (default: public/images/hero)
  --force     Regenerate even if the file already exists

Environment:
  OPENAI_API_KEY   For --provider openai (default). From platform.openai.com.
  GEMINI_API_KEY   For --provider gemini. From aistudio.google.com — needs
                   prepay credits (Buy credits on the billing page), a linked
                   card alone is not enough.

Cost: OpenAI gpt-image-1.5 at medium quality is roughly $0.05-0.06/image.
One API call per run — failures are not retried automatically.
`);
}

function readApiKey(envVar, setupHint, env = process.env) {
  const key = env[envVar];
  if (!key) {
    throw new Error(`${envVar} が .env にありません。\n${setupHint}`);
  }
  return key;
}

async function callOpenAI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      prompt,
      size: OPENAI_SIZE,
      quality: OPENAI_QUALITY,
      n: 1,
    }),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI API returned non-JSON (${response.status}):\n${text.slice(0, 500)}`);
  }

  if (!response.ok) {
    throw new Error(`OpenAI API error (${response.status}): ${JSON.stringify(json).slice(0, 500)}`);
  }

  const base64 = json?.data?.[0]?.b64_json;
  if (!base64) {
    throw new Error(
      'レスポンスから画像データ(data[0].b64_json)を取り出せませんでした。API仕様が変わった可能性があります。\n' +
        `生のレスポンス（先頭1000文字）:\n${JSON.stringify(json, null, 2).slice(0, 1000)}`
    );
  }

  return Buffer.from(base64, 'base64');
}

/**
 * Extract the base64 image payload from a Gemini Interactions API response.
 * Tries the documented simple-case field first, then the steps[] fallback
 * used for interleaved text/image output.
 */
function extractGeminiImageBase64(json) {
  const direct = json?.output_image?.data;
  if (direct) return direct;

  const fromSteps = json?.steps?.flatMap((step) => step?.content ?? [])?.find((item) => item?.type === 'image')?.data;
  if (fromSteps) return fromSteps;

  return null;
}

async function callGemini(prompt, apiKey) {
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: [{ type: 'text', text: prompt }],
      response_format: {
        type: 'image',
        mime_type: 'image/jpeg',
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

  const base64 = extractGeminiImageBase64(json);
  if (!base64) {
    throw new Error(
      'レスポンスから画像データを取り出せませんでした。API仕様が変わった可能性があります。\n' +
        `生のレスポンス（先頭1000文字）:\n${JSON.stringify(json, null, 2).slice(0, 1000)}`
    );
  }

  return Buffer.from(base64, 'base64');
}

const PROVIDERS = {
  openai: {
    label: `OpenAI (${OPENAI_MODEL})`,
    readKey: () =>
      readApiKey(
        'OPENAI_API_KEY',
        'https://platform.openai.com → API keys で発行し、.env に OPENAI_API_KEY=... を追加してください。'
      ),
    call: callOpenAI,
  },
  gemini: {
    label: `Gemini (${GEMINI_MODEL})`,
    readKey: () =>
      readApiKey(
        'GEMINI_API_KEY',
        'https://aistudio.google.com → "Get API key" で発行し、.env に GEMINI_API_KEY=... を追加してください。\n' +
          '加えて課金ページで "Buy credits"（最低$10）が必要です。カード登録だけでは quota=0 のまま動きません。'
      ),
    call: callGemini,
  },
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.slug) throw new Error('--slug は必須です。');

  const provider = PROVIDERS[args.provider];
  if (!provider) {
    throw new Error(`Unknown provider: ${args.provider} (openai | gemini)`);
  }

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

  const apiKey = provider.readKey();
  const prompt = `${STYLE_GUIDE}\n\nテーマ: ${args.theme ?? args.slug}`;

  console.log(`[generate] calling ${provider.label}...`);
  const imageBuffer = await provider.call(prompt, apiKey);

  await fs.mkdir(outDir, { recursive: true });
  await sharp(imageBuffer).resize(WIDTH, HEIGHT, { fit: 'cover' }).webp({ quality: 90 }).toFile(outPath);

  console.log(`[generate] saved ${path.relative(REPO_ROOT, outPath)} (${WIDTH}x${HEIGHT})`);
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
