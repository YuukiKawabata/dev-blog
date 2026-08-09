import fs from 'node:fs/promises';
import path from 'node:path';

import { buildAuthHeader } from './x-oauth1.mjs';

const API_BASE = 'https://api.x.com';

const REQUIRED_ENV = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];

const MIME_BY_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

export class XApiError extends Error {
  constructor(message, { status, body }) {
    super(message);
    this.name = 'XApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Read OAuth 1.0a user-context credentials from the environment.
 * Throws with an actionable message when something is missing.
 */
export function readCredentials(env = process.env) {
  const missing = REQUIRED_ENV.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing X credentials: ${missing.join(', ')}.\n` +
        'Create them at https://console.x.com → Apps → your app → "Keys & Tokens". ' +
        'The app must have Read and write permission, and the Access Token has to be ' +
        'regenerated after any permission change. Put them in .env or the repository secrets.'
    );
  }

  return {
    apiKey: env.X_API_KEY,
    apiSecret: env.X_API_SECRET,
    accessToken: env.X_ACCESS_TOKEN,
    accessTokenSecret: env.X_ACCESS_TOKEN_SECRET,
  };
}

async function request(credentials, { method, endpoint, query = {}, json, body, headers = {} }) {
  const url = `${API_BASE}${endpoint}`;
  const search = new URLSearchParams(query).toString();
  const authorization = buildAuthHeader({ method, url, queryParams: query, credentials });

  const response = await fetch(search ? `${url}?${search}` : url, {
    method,
    headers: {
      Authorization: authorization,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : body,
  });

  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const detail =
      typeof parsed === 'object' && parsed !== null
        ? parsed.detail ?? parsed.title ?? JSON.stringify(parsed)
        : String(parsed ?? '');
    throw new XApiError(`${method} ${endpoint} failed (${response.status}): ${detail}`, {
      status: response.status,
      body: parsed,
    });
  }

  return parsed;
}

/**
 * POST /2/articles/draft — create a long-form Article draft.
 * Returns { id, title }.
 */
export async function createArticleDraft(credentials, { title, contentState }) {
  const result = await request(credentials, {
    method: 'POST',
    endpoint: '/2/articles/draft',
    json: { title, content_state: contentState },
  });

  return result?.data ?? result;
}

/**
 * POST /2/articles/{id}/publish — publish a draft. Returns { post_id }.
 * The authenticated account must have an active X Premium subscription.
 */
export async function publishArticle(credentials, articleId) {
  const result = await request(credentials, {
    method: 'POST',
    endpoint: `/2/articles/${encodeURIComponent(articleId)}/publish`,
  });

  return result?.data ?? result;
}

/**
 * POST /2/tweets — create a post, optionally as a reply (used to chain threads).
 * Returns { id, text }.
 */
export async function createPost(credentials, { text, replyToId }) {
  const json = { text };
  if (replyToId) {
    json.reply = { in_reply_to_tweet_id: String(replyToId) };
  }

  const result = await request(credentials, {
    method: 'POST',
    endpoint: '/2/tweets',
    json,
  });

  return result?.data ?? result;
}

/**
 * POST /2/media/upload — upload a local image and return its media id.
 */
export async function uploadImage(credentials, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_BY_EXTENSION[extension];
  if (!contentType) {
    throw new Error(`Unsupported image type for X upload: ${filePath}`);
  }

  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append('media', new Blob([buffer], { type: contentType }), path.basename(filePath));
  form.append('media_category', 'tweet_image');

  const result = await request(credentials, {
    method: 'POST',
    endpoint: '/2/media/upload',
    body: form,
  });

  const data = result?.data ?? result;
  const mediaId = data?.id ?? data?.media_id_string ?? data?.media_id;
  if (!mediaId) {
    throw new Error(`Media upload returned no id: ${JSON.stringify(result)}`);
  }

  return String(mediaId);
}
