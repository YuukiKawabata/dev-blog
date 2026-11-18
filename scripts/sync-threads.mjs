#!/usr/bin/env node
/**
 * sync-threads — announce blog posts on Threads (one text post with a link card).
 *
 *   node scripts/sync-threads.mjs                        # dry-run: print every post's text, no network
 *   node scripts/sync-threads.mjs --only <slug>          # dry-run for one post
 *   node scripts/sync-threads.mjs --publish --only <slug>
 *   node scripts/sync-threads.mjs --record --only <slug> [--post-id <id>] [--permalink <url>]
 *
 * Text: `threads.text` if present, otherwise the first element of `x.thread`
 * (the hand-written announcement). The bare blog URL in the text gets
 * utm_source=threads, and the same URL is sent as link_attachment so the post
 * shows a preview card. Posts over 500 characters are rejected, not truncated.
 *
 * The state file (.threads/state.json) is keyed by slug (x.slug, else the file
 * basename). A post that already has an entry is never posted again unless
 * --force is given — editing an article never re-announces it.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

import { THREADS_TEXT_LIMIT, publishTextPost, readThreadsCredentials, threadsLength } from './lib/threads-client.mjs';
import utm from './lib/utm.cjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  process.loadEnvFile(path.join(REPO_ROOT, '.env'));
} catch {
  // no .env — fine
}

const DEFAULT_SITE = 'https://dev-blog-pi-six.vercel.app';
const STATE_VERSION = 1;

function log(message) {
  // eslint-disable-next-line no-console
  console.log(message);
}

function parseArgs(argv) {
  const args = {
    publish: false,
    record: false,
    force: false,
    only: null,
    postId: null,
    permalink: null,
    help: false,
    src: 'src/content/blog',
    state: '.threads/state.json',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const takeValue = () => {
      i += 1;
      if (argv[i] === undefined) throw new Error(`${token} needs a value`);
      return argv[i];
    };

    switch (token) {
      case '--publish':
        args.publish = true;
        break;
      case '--record':
        args.record = true;
        break;
      case '--dry-run':
        break;
      case '--force':
        args.force = true;
        break;
      case '--only':
        args.only = takeValue();
        break;
      case '--post-id':
        args.postId = takeValue();
        break;
      case '--permalink':
        args.permalink = takeValue();
        break;
      case '--src':
        args.src = takeValue();
        break;
      case '--state':
        args.state = takeValue();
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${token}`);
    }
  }

  if (args.publish && args.record) throw new Error('--publish and --record cannot be combined');
  if ((args.publish || args.record) && !args.only) {
    throw new Error('--publish / --record need --only <slug> (one post at a time, on purpose)');
  }

  return args;
}

function printHelp() {
  log(`sync-threads — announce blog posts on Threads

Usage:
  node scripts/sync-threads.mjs [options]

Options:
  (no flags)    Dry-run. Print the text that would be posted. No network.
  --publish     Post to Threads. Requires --only.
  --record      Mark as already posted without posting (e.g. posted by hand). Requires --only.
  --post-id     With --record: the Threads post id, if known.
  --permalink   With --record: the post URL, if known.
  --force       Post even if state says it was posted, or if threads.auto / x.auto is false.
  --only        Limit to one slug (x.slug, else file basename).
  --state       State file (default: .threads/state.json)

Frontmatter:
  threads:
    text: "..."     # optional. Default: x.thread[0]
    auto: false     # do not announce on Threads (x.auto: false also stops it)

Environment:
  THREADS_ACCESS_TOKEN, THREADS_USER_ID   (required for --publish)
  SITE_URL                                (default: ${DEFAULT_SITE})
`);
}

async function listMarkdownFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...(await listMarkdownFiles(fullPath)));
    else if (entry.isFile() && /\.mdx?$/.test(entry.name)) files.push(fullPath);
  }
  return files.sort();
}

function extractFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return null;
  return yaml.load(match[1]) ?? {};
}

async function readState(statePath) {
  try {
    const parsed = JSON.parse(await fs.readFile(statePath, 'utf8'));
    return { version: STATE_VERSION, articles: {}, ...parsed };
  } catch (error) {
    if (error.code === 'ENOENT') return { version: STATE_VERSION, articles: {} };
    throw error;
  }
}

async function writeState(statePath, state) {
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function hashOf(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

/**
 * Resolve what would be posted for one article, or a reason it would not be.
 * Exported shape: { slug, basename, hero, text, link, length, skip, error }
 */
export function resolvePost(data, basename, siteUrl) {
  const x = data.x && typeof data.x === 'object' ? data.x : {};
  const threads = data.threads && typeof data.threads === 'object' ? data.threads : {};
  const slug = x.slug ?? basename;
  const hero = typeof data.heroImage === 'string' ? data.heroImage : '';
  const result = { slug, basename, hero, text: null, link: null, length: 0, skip: null, error: null };

  if (threads.auto === false) result.skip = 'threads.auto: false';
  else if (x.auto === false) result.skip = 'x.auto: false';

  const source =
    typeof threads.text === 'string' && threads.text.trim()
      ? threads.text
      : Array.isArray(x.thread) && typeof x.thread[0] === 'string' && x.thread[0].trim()
        ? x.thread[0]
        : null;
  if (!source) {
    result.skip ??= 'no threads.text or x.thread';
    return result;
  }

  const canonical = (threads.url ?? x.url ?? `${siteUrl}/blog/${basename}/`).trim();
  if (!/^https?:\/\/[^/]+\//.test(canonical)) {
    result.error = `non-absolute URL "${canonical}"`;
    return result;
  }
  const link = utm.withUtm(canonical, { source: 'threads', campaign: basename });

  // Replace the bare blog URL (not one that already carries a query) with the
  // UTM version; if the text has no link at all, put it on the last line.
  const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bare = new RegExp(`${escaped}(?![?#\\w])`, 'g');
  let text = source.trim();
  text = bare.test(text) ? text.replace(bare, link) : text.includes(canonical) ? text : `${text}\n${link}`;

  result.text = text;
  result.link = link;
  result.length = threadsLength(text);
  if (result.length > THREADS_TEXT_LIMIT) {
    result.error = `${result.length}/${THREADS_TEXT_LIMIT} characters — shorten threads.text (or x.thread[0])`;
  }
  return result;
}

async function collect(args, siteUrl) {
  const files = await listMarkdownFiles(path.resolve(REPO_ROOT, args.src));
  const posts = [];
  for (const filePath of files) {
    const data = extractFrontmatter(await fs.readFile(filePath, 'utf8'));
    if (!data) continue;
    const basename = path.basename(filePath).replace(/\.mdx?$/, '');
    const post = resolvePost(data, basename, siteUrl);
    if (args.only && args.only !== post.slug) continue;
    posts.push(post);
  }
  return posts;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const siteUrl = (process.env.SITE_URL?.trim() || DEFAULT_SITE).replace(/\/$/, '');
  const statePath = path.resolve(REPO_ROOT, args.state);
  const state = await readState(statePath);
  const posts = await collect(args, siteUrl);

  if (args.only && posts.length === 0) {
    throw new Error(`No article with slug "${args.only}"`);
  }

  const mode = args.publish ? 'publish' : args.record ? 'record' : 'dry-run';
  log(`sync-threads (${mode}) — ${posts.length} article(s)\n`);

  let failures = 0;

  for (const post of posts) {
    const existing = state.articles[post.slug];

    if (mode === 'dry-run') {
      if (!post.text && post.skip) continue; // nothing to show
      const status = existing
        ? `posted ${existing.postedAt ?? ''}`.trim()
        : post.skip
          ? `skip (${post.skip})`
          : 'not posted';
      log(`── ${post.slug}  [${status}]`);
      if (post.error) {
        log(`  [error] ${post.error}`);
        failures += 1;
      }
      if (post.text) {
        log(`  ${post.length}/${THREADS_TEXT_LIMIT} chars, link_attachment: ${post.link}`);
        log(post.text.replace(/^/gm, '  │ '));
      }
      log('');
      continue;
    }

    // publish / record: exactly one post (enforced by --only)
    if (existing && !args.force) {
      log(
        `[skip] ${post.slug} — already in state (${
          existing.permalink ?? existing.postId ?? existing.postedAt
        }). Use --force to post again.`
      );
      continue;
    }

    if (mode === 'record') {
      state.articles[post.slug] = {
        postId: args.postId ?? null,
        permalink: args.permalink ?? null,
        textHash: post.text ? hashOf(post.text) : null,
        postedAt: new Date().toISOString(),
        source: 'manual',
      };
      await writeState(statePath, state);
      log(`[record] ${post.slug} — marked as posted (no API call)`);
      continue;
    }

    if (post.skip && !args.force) {
      log(`[skip] ${post.slug} — ${post.skip}`);
      continue;
    }
    if (post.error) throw new Error(`${post.slug}: ${post.error}`);
    if (!post.text) throw new Error(`${post.slug}: nothing to post`);

    const credentials = readThreadsCredentials();
    log(`[publish] ${post.slug} (${post.length}/${THREADS_TEXT_LIMIT} chars)`);
    log(post.text.replace(/^/gm, '  │ '));
    const result = await publishTextPost(credentials, { text: post.text, linkAttachment: post.link }, { log });

    state.articles[post.slug] = {
      postId: result.postId,
      permalink: result.permalink,
      textHash: hashOf(post.text),
      postedAt: new Date().toISOString(),
      source: 'api',
    };
    await writeState(statePath, state);
    log(`  [posted] ${result.permalink ?? result.postId}`);
  }

  // A full dry-run is a listing; only fail it when checking one post.
  if (failures > 0 && args.only) {
    throw new Error(`${failures} article(s) would be rejected by Threads (see [error] above)`);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`sync-threads: ${error.message}`);
  process.exit(1);
});
