#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

/**
 * Blog posts -> note-ready text.
 *
 * note has no official publishing API, so this only prepares the payload.
 * The actual posting is done by driving note's editor in a browser, which is
 * why the body is emitted as plain text rather than Markdown: note's editor
 * does not parse pasted Markdown, it takes the characters literally.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SITE = 'https://dev-blog-pi-six.vercel.app';

function log(message) {
  // eslint-disable-next-line no-console
  console.log(message);
}

function parseArgs(argv) {
  const args = { only: null, src: 'src/content/blog', out: '.note', help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const value = () => argv[(i += 1)];

    switch (token) {
      case '--only':
        args.only = value();
        break;
      case '--src':
        args.src = value();
        break;
      case '--out':
        args.out = value();
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
  log(`sync-note — prepare note-ready text from blog posts

Usage:
  node scripts/sync-note.mjs [--only <slug>] [--src <dir>] [--out <dir>]

Frontmatter:
  note: true
  or
  note:
    slug: my-article        # output filename (default: file basename)
    title: "..."            # default: frontmatter title
    lead: "..."             # replaces the opening paragraph
    outro: "..."            # replaces the closing CTA
    tags: ["個人開発"]       # note hashtags, appended at the end
    canonical: false        # omit the "初出" line

Outputs <out>/<slug>.json  — { title, body, tags } for the browser step
        <out>/<slug>.txt   — the body alone, ready to paste
`);
}

async function listMarkdownFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && /\.mdx?$/.test(entry.name)) files.push(fullPath);
  }

  return files.sort();
}

function extractFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { data: null, body: markdown };
  return { data: yaml.load(match[1]) ?? {}, body: markdown.slice(match[0].length) };
}

/**
 * Markdown -> plain text that reads correctly when pasted into note.
 *
 * note's editor renders literal characters, so syntax that would look like
 * noise (##, **, |) has to go, while the structure it conveyed has to survive.
 */
function toNoteText(markdown) {
  const lines = markdown.split('\n');
  const out = [];
  let inFence = false;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (/^```/.test(line)) {
      inFence = !inFence;
      // Fenced blocks in these posts are diagrams, not code — keep the contents.
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    // Tables lose their grid; keep the cells as a readable line.
    if (/^\s*\|/.test(line)) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
      out.push(cells.join('　／　'));
      continue;
    }

    let text = line
      .replace(/^#{1,6}\s+/, '') // headings become their own short lines
      .replace(/^>\s?/, '')
      .replace(/^[-*]\s+/, '・')
      .replace(/^(\d+)\.\s+/, '$1. ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 $2')
      .replace(/^---+$/, '');

    out.push(text);
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatTags(tags = []) {
  return tags
    .map((tag) => String(tag).trim().replace(/^#/, ''))
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(' ');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  const siteUrl = (process.env.SITE_URL?.trim() || DEFAULT_SITE).replace(/\/$/, '');
  const srcDir = path.resolve(REPO_ROOT, args.src);
  const outDir = path.resolve(REPO_ROOT, args.out);

  const files = await listMarkdownFiles(srcDir);
  let written = 0;

  await fs.mkdir(outDir, { recursive: true });

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, body } = extractFrontmatter(raw);
    if (!data?.note) continue;

    const config = typeof data.note === 'object' ? data.note : {};
    const basename = path.basename(filePath).replace(/\.mdx?$/, '');
    const slug = config.slug ?? basename;
    if (args.only && args.only !== slug) continue;

    const title = config.title ?? data.title;
    const url = config.url?.trim() || `${siteUrl}/blog/${basename}/`;

    const sections = [];
    if (config.lead) sections.push(config.lead);
    sections.push(toNoteText(body));
    if (config.outro) sections.push(config.outro);
    if (config.canonical !== false) {
      sections.push(`この記事は個人ブログにも掲載しています。\n${url}`);
    }
    const tagLine = formatTags(config.tags ?? data.tags ?? []);
    if (tagLine) sections.push(tagLine);

    const noteBody = sections.join('\n\n');

    await fs.writeFile(
      path.join(outDir, `${slug}.json`),
      `${JSON.stringify({ slug, title, url, body: noteBody, tags: config.tags ?? data.tags ?? [] }, null, 2)}\n`,
      'utf8'
    );
    await fs.writeFile(path.join(outDir, `${slug}.txt`), `${noteBody}\n`, 'utf8');

    written += 1;
    log(`  [note] ${slug} — ${noteBody.length} chars → ${path.relative(REPO_ROOT, outDir)}/${slug}.{json,txt}`);
  }

  log(written === 0 ? 'No posts with a `note:` frontmatter key.' : `\nDone: ${written} prepared.`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
