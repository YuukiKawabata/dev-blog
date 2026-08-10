#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import yaml from 'js-yaml';

import { collectImageUrls, parseMarkdown, toContentState } from './lib/x-content-state.mjs';
import { buildDigestTree, extractPoints } from './lib/x-digest.mjs';
import { buildThread, validateThread, weightedLength } from './lib/x-thread.mjs';
import { createArticleDraft, createPost, publishArticle, readCredentials, uploadImage } from './lib/x-client.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Local runs read credentials from .env; CI supplies them as real env vars.
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
    apply: false,
    publish: false,
    thread: false,
    force: false,
    help: false,
    only: null,
    src: 'src/content/blog',
    out: '.x/drafts',
    state: '.x/state.json',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const takeValue = () => {
      i += 1;
      return argv[i];
    };

    switch (token) {
      case '--apply':
        args.apply = true;
        break;
      case '--publish':
        args.publish = true;
        args.apply = true;
        break;
      case '--thread':
        args.thread = true;
        args.apply = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--only':
        args.only = takeValue();
        break;
      case '--src':
        args.src = takeValue();
        break;
      case '--out':
        args.out = takeValue();
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

  return args;
}

function printHelp() {
  log(`sync-x — publish blog posts to X as Articles (digest) + an announcement thread

Usage:
  node scripts/sync-x.mjs [options]

Options:
  (no flags)   Build content_state JSON into .x/drafts/ only. No network, no cost.
  --apply      Create the Article draft on X (stays unpublished).
  --publish    Create the draft and publish it. Implies --apply.
  --thread     Post the announcement thread. Implies --apply.
  --force      Re-create even when the content hash is unchanged.
  --only       Limit to one slug.
  --src        Source directory (default: src/content/blog)
  --out        Generated payload directory (default: .x/drafts)
  --state      State file (default: .x/state.json)

Frontmatter:
  x: true                       # digest mode with defaults
  or
  x:
    slug: english-glossary      # state key + payload filename (default: file basename)
    title: "..."                # default: frontmatter title
    mode: digest | full         # default: digest
    url: "https://..."          # default: <site>/blog/<file basename>/
    cta: "..."                  # digest closing line
    hashtags: ["ai", "claude"]  # appended to the last thread post
    thread: ["...", "..."]      # explicit thread, overrides generation
    thread_enabled: false       # skip the thread for this post
    article_enabled: false      # thread only — do not create/publish an Article
    max_points: 8               # bullets in "この記事で書いたこと"
    skip_points: ["前提"]        # extra h2 headings to leave out of the bullets
    max_thread_posts: 5
    code_blocks: blockquote | text | omit

Environment:
  X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET   (required for --apply)
  SITE_URL                                                         (default: ${DEFAULT_SITE})
  X_LINK_MODE=entity|text                                          (default: entity)
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
    if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function extractFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { data: null, body: markdown };

  let data = null;
  try {
    data = yaml.load(match[1]) ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse YAML frontmatter: ${message}`);
  }

  return { data, body: markdown.slice(match[0].length) };
}

async function readState(statePath) {
  try {
    const raw = await fs.readFile(statePath, 'utf8');
    const parsed = JSON.parse(raw);
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
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

/**
 * Local path for an image referenced from markdown. Only site-absolute paths
 * under public/ are uploadable; remote URLs are left to the caller to skip.
 */
function resolveLocalImage(url) {
  if (/^https?:\/\//.test(url)) return null;
  const clean = url.split('?')[0].split('#')[0];
  return path.join(REPO_ROOT, 'public', clean.replace(/^\//, ''));
}

async function uploadImages(credentials, urls) {
  const mediaMap = new Map();

  for (const url of urls) {
    const localPath = resolveLocalImage(url);
    if (!localPath) {
      log(`  [skip media] remote image not uploadable: ${url}`);
      continue;
    }

    try {
      await fs.access(localPath);
    } catch {
      log(`  [skip media] file not found: ${path.relative(REPO_ROOT, localPath)}`);
      continue;
    }

    const mediaId = await uploadImage(credentials, localPath);
    mediaMap.set(url, mediaId);
    log(`  [media] ${url} -> ${mediaId}`);
  }

  return mediaMap;
}

function buildPayload(entry, { mediaMap = new Map(), linkMode }) {
  const { tree, config, url } = entry;

  const converterOptions = {
    mediaMap,
    linkMode,
    codeBlocks: config.code_blocks ?? 'blockquote',
  };

  const skipPoints = config.skip_points ?? [];
  const maxPoints = config.max_points ?? 8;

  if (config.mode === 'full') {
    const { contentState, warnings } = toContentState(tree, converterOptions);
    return { contentState, warnings, points: extractPoints(tree, maxPoints, skipPoints) };
  }

  const { tree: digestTree, points } = buildDigestTree(tree, {
    url,
    maxPoints,
    skipPoints,
    ...(config.cta ? { ctaText: config.cta } : {}),
  });

  const { contentState, warnings } = toContentState(digestTree, converterOptions);
  return { contentState, warnings, points };
}

async function collectEntries(args, siteUrl) {
  const srcDir = path.resolve(REPO_ROOT, args.src);
  const files = await listMarkdownFiles(srcDir);
  const entries = [];

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, body } = extractFrontmatter(raw);
    if (!data?.x) continue;

    const config = typeof data.x === 'object' ? data.x : {};
    const basename = path.basename(filePath).replace(/\.mdx?$/, '');
    const slug = config.slug ?? basename;

    if (args.only && args.only !== slug) continue;

    const title = config.title ?? data.title;
    if (!title) {
      log(`[skip] missing title: ${path.relative(REPO_ROOT, filePath)}`);
      continue;
    }

    // The CTA link is the whole point of the digest — a relative or malformed
    // URL would silently ship a dead link into a published Article.
    const url = config.url?.trim() || `${siteUrl}/blog/${basename}/`;
    if (!/^https?:\/\/[^/]+\//.test(url)) {
      throw new Error(
        `Resolved a non-absolute URL for ${slug}: "${url}".\n` +
          'Set SITE_URL in .env (with scheme and host) or add an absolute `x.url` to the frontmatter.'
      );
    }

    entries.push({
      filePath,
      slug,
      title,
      description: config.description ?? data.description ?? '',
      url,
      config: { mode: 'digest', ...config },
      tree: parseMarkdown(body),
    });
  }

  return entries;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  // `??` would let an empty SITE_URL through and produce host-less CTA links.
  const siteUrl = (process.env.SITE_URL?.trim() || DEFAULT_SITE).replace(/\/$/, '');
  const linkMode = process.env.X_LINK_MODE?.trim() || 'entity';
  const outDir = path.resolve(REPO_ROOT, args.out);
  const statePath = path.resolve(REPO_ROOT, args.state);

  const entries = await collectEntries(args, siteUrl);
  if (entries.length === 0) {
    log('No posts with an `x:` frontmatter key. Nothing to do.');
    return;
  }

  const state = await readState(statePath);
  const credentials = args.apply ? readCredentials() : null;

  await fs.mkdir(outDir, { recursive: true });

  let built = 0;
  let drafted = 0;
  let published = 0;
  let threaded = 0;
  let stateDirty = false;

  for (const entry of entries) {
    log(`\n▸ ${entry.slug} (${entry.config.mode})`);

    let mediaMap = new Map();
    if (args.apply && entry.config.mode === 'full') {
      mediaMap = await uploadImages(credentials, collectImageUrls(entry.tree));
    }

    const { contentState, warnings, points } = buildPayload(entry, { mediaMap, linkMode });
    for (const warning of warnings) log(`  [warn] ${warning}`);

    const threadPosts =
      entry.config.thread_enabled === false
        ? []
        : entry.config.thread ??
          buildThread({
            title: entry.title,
            description: entry.description,
            points,
            url: entry.url,
            hashtags: entry.config.hashtags ?? [],
            maxPosts: entry.config.max_thread_posts ?? 5,
          });

    const threadErrors = validateThread(threadPosts);
    if (threadErrors.length > 0) {
      throw new Error(`Thread for ${entry.slug} is invalid:\n  - ${threadErrors.join('\n  - ')}`);
    }

    const payload = {
      slug: entry.slug,
      title: entry.title,
      url: entry.url,
      mode: entry.config.mode,
      source: path.relative(REPO_ROOT, entry.filePath).split(path.sep).join('/'),
      content_state: contentState,
      thread: threadPosts,
    };

    const outPath = path.join(outDir, `${entry.slug}.json`);
    await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    built += 1;

    log(
      `  [build] ${path.relative(REPO_ROOT, outPath)} — ${contentState.blocks.length} blocks, ${
        threadPosts.length
      } posts`
    );
    threadPosts.forEach((post, index) => {
      log(`    ${index + 1}. (${weightedLength(post)}/280) ${post.split('\n')[0]}`);
    });

    if (!args.apply) continue;

    const record = state.articles[entry.slug] ?? {};
    const articleHash = hashOf(contentState);
    const threadHash = hashOf(threadPosts);

    // Most posts only want the thread — an Article never reaches the timeline,
    // so creating one for every post costs money and clutters the 記事 tab.
    const articleEnabled = entry.config.article_enabled !== false;

    if (!articleEnabled) {
      log('  [skip] article disabled (article_enabled: false) — thread only');
    } else if (record.articleId && record.articleHash === articleHash && !args.force) {
      log(`  [skip] article unchanged (${record.status ?? 'draft'}, id=${record.articleId})`);
    } else {
      const draft = await createArticleDraft(credentials, {
        title: entry.title,
        contentState,
      });
      record.articleId = String(draft.id);
      record.articleHash = articleHash;
      record.status = 'draft';
      record.updatedAt = new Date().toISOString();
      stateDirty = true;
      drafted += 1;
      log(`  [draft] created id=${record.articleId}`);
    }

    if (args.publish && articleEnabled && record.status !== 'published') {
      const result = await publishArticle(credentials, record.articleId);
      record.status = 'published';
      record.postId = String(result.post_id ?? result.postId ?? '');
      record.publishedAt = new Date().toISOString();
      stateDirty = true;
      published += 1;
      log(`  [publish] post_id=${record.postId}`);
    } else if (args.publish && articleEnabled) {
      log('  [skip] already published');
    }

    if (args.thread && threadPosts.length > 0) {
      if (record.threadHash === threadHash && record.threadRootId && !args.force) {
        log(`  [skip] thread unchanged (root=${record.threadRootId})`);
      } else {
        let replyToId = null;
        const ids = [];
        for (const post of threadPosts) {
          const created = await createPost(credentials, { text: post, replyToId });
          replyToId = String(created.id);
          ids.push(replyToId);
        }
        record.threadRootId = ids[0];
        record.threadIds = ids;
        record.threadHash = threadHash;
        record.threadPostedAt = new Date().toISOString();
        stateDirty = true;
        threaded += 1;
        log(`  [thread] posted ${ids.length} posts, root=${ids[0]}`);
      }
    }

    // A post that published nothing (thread-only, article disabled) has no ids
    // worth remembering — writing an empty record just adds noise to the diff.
    if (Object.keys(record).length > 0) {
      state.articles[entry.slug] = record;
      await writeState(statePath, state);
    }
  }

  if (stateDirty) await writeState(statePath, state);

  log(
    `\nDone: built=${built}, drafts=${drafted}, published=${published}, threads=${threaded}` +
      (args.apply ? '' : '  (dry build — pass --apply to hit the API)')
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`\n${error.message}`);
  if (error.body) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(error.body, null, 2));
  }
  process.exitCode = 1;
});
