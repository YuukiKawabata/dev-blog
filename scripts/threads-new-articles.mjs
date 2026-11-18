#!/usr/bin/env node
/**
 * List blog posts that a push newly added and that should be announced on
 * Threads automatically. Used by .github/workflows/sync-threads.yml.
 *
 *   node scripts/threads-new-articles.mjs <before-sha> <after-sha>
 *
 * Prints one tab-separated line per post: <slug> <basename> <heroImage>
 *
 * Same rules as x-new-articles.mjs: only *added* files count, and the post
 * needs a hand-written announcement (`threads.text` or `x.thread`). A post opts
 * out with `threads.auto: false` or `x.auto: false`.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const [before, after] = process.argv.slice(2);
if (!before || !after) {
  console.error('usage: node scripts/threads-new-articles.mjs <before-sha> <after-sha>');
  process.exit(2);
}

if (/^0+$/.test(before)) process.exit(0);

const added = execFileSync(
  'git',
  ['diff', '--name-only', '--diff-filter=A', before, after, '--', 'src/content/blog/'],
  { encoding: 'utf8' }
)
  .split('\n')
  .map((line) => line.trim())
  .filter((file) => /\.mdx?$/.test(file));

for (const file of added) {
  const source = fs.readFileSync(file, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) continue;

  const data = yaml.load(match[1]) ?? {};
  const x = data.x && typeof data.x === 'object' ? data.x : {};
  const threads = data.threads && typeof data.threads === 'object' ? data.threads : {};
  if (threads.auto === false || x.auto === false) continue;

  const hasText =
    (typeof threads.text === 'string' && threads.text.trim() !== '') ||
    (Array.isArray(x.thread) && typeof x.thread[0] === 'string' && x.thread[0].trim() !== '');
  if (!hasText) continue;

  const basename = path.basename(file).replace(/\.mdx?$/, '');
  const slug = x.slug ?? basename;
  const hero = typeof data.heroImage === 'string' ? data.heroImage : '';
  console.log([slug, basename, hero].join('\t'));
}
