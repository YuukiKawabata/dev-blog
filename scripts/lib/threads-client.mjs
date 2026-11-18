/**
 * Minimal Threads API client for text posts with a link preview.
 *
 *   POST /{user-id}/threads          → media container (media_type=TEXT)
 *   GET  /{container-id}?fields=status
 *   POST /{user-id}/threads_publish  → published media id
 *
 * The access token is a secret: it is sent in the request body (POST) or the
 * query string (GET) and is scrubbed from every error message this module
 * throws, so a failed call never leaks it into CI logs.
 *
 * Docs: https://developers.facebook.com/documentation/threads/posts
 */

export const THREADS_API_BASE = 'https://graph.threads.com';
export const THREADS_API_VERSION = 'v1.0';
export const THREADS_TEXT_LIMIT = 500;

// Pictographs, skin-tone modifiers, ZWJ and variation selector 16, one code point at a time.
const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f/u;

/**
 * Length as Threads counts it: one per character, except emoji, which count as
 * their UTF-8 byte length. Erring high is fine — the API would reject the post.
 */
export function threadsLength(text) {
  let total = 0;
  for (const char of text) {
    total += EMOJI.test(char) ? Buffer.byteLength(char, 'utf8') : 1;
  }
  return total;
}

export function readThreadsCredentials(env = process.env) {
  const accessToken = env.THREADS_ACCESS_TOKEN?.trim();
  const userId = env.THREADS_USER_ID?.trim();
  const missing = [...(accessToken ? [] : ['THREADS_ACCESS_TOKEN']), ...(userId ? [] : ['THREADS_USER_ID'])];
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(', ')}. Set them in .env (local) or repository secrets (CI).`);
  }
  return { accessToken, userId };
}

function scrub(message, secret) {
  if (!secret) return message;
  return String(message).split(secret).join('***');
}

async function call(method, pathname, params, accessToken) {
  const url = new URL(`${THREADS_API_BASE}/${pathname.replace(/^\//, '')}`);
  const body = new URLSearchParams({ ...params, access_token: accessToken });

  let response;
  try {
    if (method === 'GET') {
      for (const [key, value] of body) url.searchParams.set(key, value);
      response = await fetch(url);
    } else {
      response = await fetch(url, { method, body });
    }
  } catch (error) {
    throw new Error(scrub(`Threads API ${method} ${pathname} failed: ${error.message}`, accessToken));
  }

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // fall through with the raw text
  }

  if (!response.ok || json?.error) {
    const detail = json?.error ? JSON.stringify(json.error) : text.slice(0, 500);
    throw new Error(scrub(`Threads API ${method} ${pathname} → HTTP ${response.status}: ${detail}`, accessToken));
  }

  return json ?? {};
}

export function threadsGet(pathname, params, accessToken) {
  return call('GET', pathname, params, accessToken);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a TEXT container, wait until it is ready, publish it, then look up the
 * permalink. Returns { containerId, postId, permalink }.
 */
export async function publishTextPost({ accessToken, userId }, { text, linkAttachment }, { log = () => {} } = {}) {
  const v = THREADS_API_VERSION;

  const container = await call(
    'POST',
    `${v}/${userId}/threads`,
    {
      media_type: 'TEXT',
      text,
      ...(linkAttachment ? { link_attachment: linkAttachment } : {}),
    },
    accessToken
  );
  const containerId = container.id;
  if (!containerId) throw new Error('Threads API did not return a container id');
  log(`  [container] ${containerId}`);

  // Text containers are usually ready at once; poll briefly instead of the
  // fixed 30s the docs suggest for media uploads.
  let status = 'IN_PROGRESS';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await call('GET', `${v}/${containerId}`, { fields: 'status,error_message' }, accessToken);
    status = result.status ?? 'UNKNOWN';
    if (status === 'FINISHED') break;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Threads container ${containerId} is ${status}: ${result.error_message ?? 'no detail'}`);
    }
    await sleep(3000);
  }
  if (status !== 'FINISHED') {
    throw new Error(`Threads container ${containerId} did not finish (last status: ${status})`);
  }

  const published = await call('POST', `${v}/${userId}/threads_publish`, { creation_id: containerId }, accessToken);
  const postId = published.id;
  if (!postId) throw new Error('Threads API did not return a post id');

  let permalink = null;
  try {
    const media = await call('GET', `${v}/${postId}`, { fields: 'permalink' }, accessToken);
    permalink = media.permalink ?? null;
  } catch (error) {
    // The post is live; a missing permalink only costs us a URL in the log.
    log(`  [warn] could not fetch permalink: ${error.message}`);
  }

  return { containerId, postId, permalink };
}
