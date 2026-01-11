#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const yaml = require('js-yaml');

function parseArgs(argv) {
  const args = {
    dryRun: false,
    src: null,
    dest: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (token === '--src') {
      args.src = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === '--dest') {
      args.dest = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
  }

  return args;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`sync-zenn

Usage:
  node scripts/sync-zenn.cjs [--dry-run] [--src <dir>] [--dest <dir>]

Defaults:
  --src  ./src/content/blog
  --dest ../zenn-articles/zenn-articles/articles  (or $ZENN_ARTICLES_DIR)

Frontmatter:
  Add a 'zenn' key to enable sync.

  zenn: true
  or
  zenn:
    slug: mac-setup-2026-0110
    type: tech
    emoji: "⛳"
    topics: ["mac", "setup"]
    published: false
`);
}

async function listMarkdownFilesRecursively(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFilesRecursively(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function extractFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) {
    return { data: null, body: markdown };
  }

  const frontmatterText = match[1];
  const body = markdown.slice(match[0].length);

  let data = null;
  try {
    data = yaml.load(frontmatterText) ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse YAML frontmatter: ${message}`);
  }

  return { data, body };
}

function escapeDoubleQuoted(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeStringArray(value) {
  if (!value) return [];
  if (!Array.isArray(value)) return [];

  const normalized = value.map((v) => String(v).trim()).filter(Boolean);

  return Array.from(new Set(normalized));
}

function renderZennFrontmatter({ title, emoji, type, topics, published }) {
  const safeTitle = escapeDoubleQuoted(title ?? '');
  const safeEmoji = escapeDoubleQuoted(emoji ?? '📝');
  const safeType = escapeDoubleQuoted(type ?? 'tech');
  const safeTopics = normalizeStringArray(topics).slice(0, 4);
  const topicsInline = `[${safeTopics.map((t) => `"${escapeDoubleQuoted(t)}"`).join(', ')}]`;
  const safePublished = Boolean(published);

  return [
    '---',
    `title: "${safeTitle}"`,
    `emoji: "${safeEmoji}"`,
    `type: "${safeType}"`,
    `topics: ${topicsInline}`,
    `published: ${safePublished ? 'true' : 'false'}`,
    '---',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const blogRepoRoot = path.resolve(__dirname, '..');
  const srcDir = path.resolve(blogRepoRoot, args.src ?? 'src/content/blog');

  const defaultDest = path.resolve(blogRepoRoot, '../zenn-articles/zenn-articles/articles');
  const destDir = path.resolve(blogRepoRoot, args.dest ?? process.env.ZENN_ARTICLES_DIR ?? defaultDest);

  const allMarkdown = await listMarkdownFilesRecursively(srcDir);

  let generated = 0;
  let skipped = 0;

  await fs.mkdir(destDir, { recursive: true });

  for (const filePath of allMarkdown) {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, body } = extractFrontmatter(raw);

    const zennConfig = data?.zenn;
    if (!zennConfig) {
      skipped += 1;
      continue;
    }

    const zennObj = typeof zennConfig === 'object' ? zennConfig : {};

    const slug = zennObj.slug ?? path.basename(filePath, '.md');
    const title = zennObj.title ?? data?.title;
    if (!title) {
      // eslint-disable-next-line no-console
      console.warn(`[skip] Missing title: ${path.relative(blogRepoRoot, filePath)}`);
      skipped += 1;
      continue;
    }

    const topics = zennObj.topics ?? data?.tags ?? [];
    const emoji = zennObj.emoji ?? '📝';
    const type = zennObj.type ?? 'tech';
    const published = zennObj.published ?? false;

    const frontmatter = renderZennFrontmatter({ title, emoji, type, topics, published });
    const relSource = path.relative(blogRepoRoot, filePath).split(path.sep).join('/');

    const output = `${frontmatter}\n\n<!-- synced from yuki-dev-blog: ${relSource} -->\n\n${body.trimStart()}`;
    const outPath = path.join(destDir, `${slug}.md`);

    if (args.dryRun) {
      // eslint-disable-next-line no-console
      console.log(`[dry-run] write ${path.relative(blogRepoRoot, outPath)}`);
    } else {
      await fs.writeFile(outPath, output, 'utf8');
      // eslint-disable-next-line no-console
      console.log(`[write] ${path.relative(blogRepoRoot, outPath)}`);
    }

    generated += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`\nDone: generated=${generated}, skipped=${skipped}, dest=${destDir}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
