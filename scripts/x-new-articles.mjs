#!/usr/bin/env node
/**
 * List blog posts that a push newly added and that should be announced on X
 * automatically. Used by .github/workflows/sync-x.yml on push to main.
 *
 *   node scripts/x-new-articles.mjs <before-sha> <after-sha>
 *
 * Prints one tab-separated line per post: <x.slug> <basename> <heroImage>
 *
 * Only *added* files count — editing an existing post never triggers a post,
 * so old articles that were never announced are not swept up by accident.
 * A post opts out with `x.auto: false`, and needs a hand-written `x.thread`
 * (the auto-generated digest is never posted unattended).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const [before, after] = process.argv.slice(2);
if (!before || !after) {
  console.error('usage: node scripts/x-new-articles.mjs <before-sha> <after-sha>');
  process.exit(2);
}

// A push that creates the branch has no "before" commit to diff against.
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
  const x = data.x;
  if (!x || typeof x !== 'object') continue;
  if (x.auto === false) continue;
  if (!Array.isArray(x.thread) || x.thread.length === 0) continue;

  const basename = path.basename(file).replace(/\.mdx?$/, '');
  const slug = x.slug ?? basename;
  const hero = typeof data.heroImage === 'string' ? data.heroImage : '';
  console.log([slug, basename, hero].join('\t'));
}
