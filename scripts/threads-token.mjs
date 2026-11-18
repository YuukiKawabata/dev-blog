#!/usr/bin/env node
/**
 * Threads access-token helper. Tokens are never printed to a terminal:
 * a new token goes to --out <file>, or to stdout only when stdout is a pipe
 * (e.g. straight into `gh secret set`).
 *
 *   # short-lived (1h) → long-lived (60 days). App secret from THREADS_APP_SECRET (env or .env)
 *   pbpaste | node scripts/threads-token.mjs exchange | gh secret set THREADS_ACCESS_TOKEN -R YuukiKawabata/dev-blog
 *
 *   # extend a long-lived token by another 60 days (must be ≥24h old and not expired)
 *   THREADS_ACCESS_TOKEN=... node scripts/threads-token.mjs refresh --out "$RUNNER_TEMP/token"
 *
 *   # who does this token belong to? prints the Threads user id and username
 *   pbpaste | node scripts/threads-token.mjs me
 *
 * Input token: THREADS_ACCESS_TOKEN env var if set, otherwise stdin.
 * Docs: https://developers.facebook.com/documentation/threads/get-started/long-lived-tokens
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { THREADS_API_VERSION, threadsGet } from './lib/threads-client.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(path.join(REPO_ROOT, '.env'));
} catch {
  // no .env — fine
}

const info = (message) => process.stderr.write(`${message}\n`);

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function inputToken({ preferStdin = false } = {}) {
  const fromEnv = process.env.THREADS_ACCESS_TOKEN?.trim();
  const token = preferStdin ? (await readStdin()) || fromEnv : fromEnv || (await readStdin());
  if (!token) throw new Error('No token: pipe it on stdin or set THREADS_ACCESS_TOKEN');
  return token;
}

async function emitToken(token, outPath) {
  if (outPath) {
    await fs.writeFile(outPath, token, { mode: 0o600 });
    info(`token written to ${outPath}`);
    return;
  }
  if (process.stdout.isTTY) {
    throw new Error(
      'Refusing to print a token to the terminal. Pipe stdout (e.g. into gh secret set) or pass --out <file>.'
    );
  }
  process.stdout.write(token);
}

function describeExpiry(expiresIn) {
  if (!expiresIn) return 'unknown';
  const at = new Date(Date.now() + Number(expiresIn) * 1000);
  return `${at.toISOString().slice(0, 10)} (${Math.floor(Number(expiresIn) / 86400)} days)`;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const outIndex = rest.indexOf('--out');
  const outPath = outIndex >= 0 ? rest[outIndex + 1] : null;

  switch (command) {
    case 'exchange': {
      const secret = process.env.THREADS_APP_SECRET?.trim();
      if (!secret) throw new Error('THREADS_APP_SECRET is not set (env or .env)');
      const shortToken = await inputToken({ preferStdin: true });
      const result = await threadsGet(
        'access_token',
        { grant_type: 'th_exchange_token', client_secret: secret },
        shortToken
      ).catch((error) => {
        throw new Error(error.message.split(secret).join('***'));
      });
      if (!result.access_token) throw new Error('No access_token in the response');
      info(`long-lived token expires: ${describeExpiry(result.expires_in)}`);
      await emitToken(result.access_token, outPath);
      break;
    }

    case 'refresh': {
      const token = await inputToken();
      const result = await threadsGet('refresh_access_token', { grant_type: 'th_refresh_token' }, token);
      if (!result.access_token) throw new Error('No access_token in the response');
      info(`refreshed token expires: ${describeExpiry(result.expires_in)}`);
      if (process.env.GITHUB_OUTPUT) {
        await fs.appendFile(process.env.GITHUB_OUTPUT, `expires_in=${result.expires_in ?? ''}\n`);
      }
      await emitToken(result.access_token, outPath);
      break;
    }

    case 'me': {
      const token = await inputToken({ preferStdin: true });
      const me = await threadsGet(`${THREADS_API_VERSION}/me`, { fields: 'id,username' }, token);
      info(`username: ${me.username}`);
      if (outPath || !process.stdout.isTTY) await emitToken(String(me.id), outPath);
      else info(`id: ${me.id}`);
      break;
    }

    default:
      info('usage: node scripts/threads-token.mjs <exchange|refresh|me> [--out <file>]');
      process.exit(2);
  }
}

main().catch((error) => {
  info(`threads-token: ${error.message}`);
  process.exit(1);
});
