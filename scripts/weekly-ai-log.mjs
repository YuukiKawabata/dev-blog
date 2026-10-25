#!/usr/bin/env node
// 週次連載「AI Weekly Log」用の素材集計スクリプト。
// Claude Code / Codex の履歴と ~/dev 配下の git ログを1週間分集めて Markdown ダイジェストにする。
//
// 使い方:
//   node scripts/weekly-ai-log.mjs                       # 直近の日〜土（JST）
//   node scripts/weekly-ai-log.mjs --from 2026-10-04 --to 2026-10-10
//   node scripts/weekly-ai-log.mjs --out /path/to/digest.md
//
// 出力は記事の「素材」であって公開物ではない。公開前に必ず人の目で確認すること。
//
// コミットの数え方:
//   - git worktree（同じリポジトリを別フォルダで開いたもの）は、本体のリポジトリにまとめて1回だけ数える
//   - PRをスカッシュでマージしたときのブランチ側のコミットは、main 側の (#NN) 付きの1件にまとめる
//   - 本文にクラウドの Claude Code の会話リンクがあるコミットは「クラウド」として別に数える（依頼数には入らない）

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude', 'projects');
const CODEX_DIR = path.join(HOME, '.codex');
const DEV_DIR = path.join(HOME, 'dev');
const TZ_OFFSET_MS = 9 * 60 * 60 * 1000; // JST

// ---------- 引数 ----------
const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function defaultRange() {
  // 今日(JST)より前の直近の土曜日を終端にする
  const nowJst = new Date(Date.now() + TZ_OFFSET_MS);
  const day = nowJst.getUTCDay(); // 0=日
  const end = new Date(nowJst);
  end.setUTCDate(nowJst.getUTCDate() - ((day + 1) % 7 || 7));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return [fmt(start), fmt(end)];
}

const [defFrom, defTo] = defaultRange();
const FROM = argOf('--from') ?? defFrom;
const TO = argOf('--to') ?? defTo;
const OUT = argOf('--out');
const fromMs = Date.parse(`${FROM}T00:00:00+09:00`);
const toMs = Date.parse(`${TO}T23:59:59.999+09:00`);
const inRange = (ts) => {
  const t = Date.parse(ts);
  return t >= fromMs && t <= toMs;
};

// ---------- ユーティリティ ----------
function redact(text) {
  return text
    .replace(/sk-[A-Za-z0-9_-]{16,}/g, '[REDACTED_KEY]')
    .replace(/(ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{16,}/g, '[REDACTED_TOKEN]')
    .replace(/xox[abprs]-[A-Za-z0-9-]{10,}/g, '[REDACTED_TOKEN]')
    .replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]{16,}/g, 'Bearer [REDACTED]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[REDACTED_LONG]');
}

function cleanPrompt(text, max = 220) {
  const t = text
    .replace(/<\/?pasted_content[^>]*>/g, '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/\[external unsupported block: \w+\]/g, '')
    .replace(/# Files mentioned by the user:[\s\S]*?## My request[^:\n]*:\s*/, '[添付あり] ')
    .replace(/<\/?image[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const r = redact(t);
  return r.length > max ? `${r.slice(0, max)}…` : r;
}

function isNoisePrompt(text) {
  const t = text.replace(/<\/?pasted_content[^>]*>/g, '').trim();
  return (
    !t ||
    t.startsWith('<') || // command / environment / AGENTS.md 注入
    t.startsWith('[Request interrupted') ||
    t.startsWith('Caveat:') ||
    t.startsWith('# AGENTS.md')
  );
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c && (c.type === 'text' || c.type === 'input_text'))
      .map((c) => c.text)
      .join('\n');
  }
  return '';
}

function readJsonl(file) {
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* 壊れた行は無視 */
    }
  }
  return out;
}

const shortCwd = (cwd) => (cwd ? cwd.replace(`${HOME}/dev/`, '').replace(HOME, '~') : '(unknown)');
const jstHour = (ts) => new Date(Date.parse(ts) + TZ_OFFSET_MS).getUTCHours();
const jstDate = (ts) => new Date(Date.parse(ts) + TZ_OFFSET_MS).toISOString().slice(0, 10);

// ---------- Claude Code ----------
function collectClaude() {
  const sessions = [];
  if (!fs.existsSync(CLAUDE_DIR)) return sessions;
  for (const proj of fs.readdirSync(CLAUDE_DIR)) {
    const dir = path.join(CLAUDE_DIR, proj);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue;
      const file = path.join(dir, f);
      if (fs.statSync(file).mtimeMs < fromMs) continue;
      let cwd;
      const prompts = [];
      let outputTokens = 0;
      let first;
      let last;
      for (const r of readJsonl(file)) {
        if (!r.timestamp || !inRange(r.timestamp)) continue;
        cwd ??= r.cwd;
        if (r.type === 'assistant' && r.message?.usage) {
          outputTokens += r.message.usage.output_tokens ?? 0;
        }
        if (r.type !== 'user' || r.isMeta || r.isSidechain) continue;
        const text = textOf(r.message?.content);
        if (isNoisePrompt(text)) continue;
        prompts.push({ ts: r.timestamp, text: cleanPrompt(text) });
        first ??= r.timestamp;
        last = r.timestamp;
      }
      if (prompts.length) {
        sessions.push({ tool: 'Claude', id: f.replace('.jsonl', ''), cwd, prompts, first, last, outputTokens });
      }
    }
  }
  return sessions;
}

// ---------- Codex ----------
function collectCodex() {
  const sessions = [];
  const names = new Map();
  const indexFile = path.join(CODEX_DIR, 'session_index.jsonl');
  if (fs.existsSync(indexFile)) {
    for (const r of readJsonl(indexFile)) names.set(r.id, r.thread_name);
  }
  // Codex Desktop は Claude Code のセッションを取り込める。取り込まれたスレッドは
  // 元の Claude の依頼をそのまま含むので、二重計上しないよう元の依頼文を除外する。
  const imports = new Map();
  const importsFile = path.join(CODEX_DIR, 'external_agent_session_imports.json');
  if (fs.existsSync(importsFile)) {
    try {
      for (const r of JSON.parse(fs.readFileSync(importsFile, 'utf8')).records ?? []) {
        imports.set(r.imported_thread_id, r.source_path);
      }
    } catch {
      /* 形式が変わっていたら取り込み判定をあきらめる */
    }
  }
  const claudePromptsOf = (file) => {
    const set = new Set();
    if (!file || !fs.existsSync(file)) return set;
    for (const r of readJsonl(file)) {
      if (r.type === 'user') set.add(cleanPrompt(textOf(r.message?.content)));
    }
    return set;
  };
  // 範囲の前日〜翌日のディレクトリを見る（ファイル名はUTCではなくローカル日付のため余裕を持たせる）
  const days = [];
  for (let t = fromMs - 864e5; t <= toMs + 864e5; t += 864e5) {
    const d = new Date(t + TZ_OFFSET_MS).toISOString().slice(0, 10).split('-');
    days.push(path.join(CODEX_DIR, 'sessions', ...d));
  }
  for (const dir of days) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.jsonl')) continue;
      let id;
      let cwd;
      const prompts = [];
      let first;
      let last;
      let totalTokens = 0;
      for (const r of readJsonl(path.join(dir, f))) {
        const p = r.payload ?? {};
        if (r.type === 'session_meta') {
          id = p.id;
          cwd = p.cwd;
          continue;
        }
        if (!r.timestamp || !inRange(r.timestamp)) continue;
        if (p.type === 'token_count') {
          totalTokens = p.info?.total_token_usage?.total_tokens ?? totalTokens;
        }
        if (r.type !== 'response_item' || p.type !== 'message' || p.role !== 'user') continue;
        const text = textOf(p.content);
        if (isNoisePrompt(text)) continue;
        prompts.push({ ts: r.timestamp, text: cleanPrompt(text) });
      }
      const importedFrom = imports.get(id);
      const copied = importedFrom ? claudePromptsOf(importedFrom) : new Set();
      // 取り込みスレッドは丸ごとコピーなので、トークン数も Claude 側と重複する
      if (importedFrom) totalTokens = 0;
      const own = prompts.filter((p) => !copied.has(p.text));
      if (own.length) {
        first = own[0].ts;
        last = own.at(-1).ts;
        sessions.push({ tool: 'Codex', id, name: names.get(id), cwd, prompts: own, first, last, totalTokens, handoff: Boolean(importedFrom) });
      }
    }
  }
  return sessions;
}

// ---------- git ----------
const gitOut = (dir, gitArgs) =>
  execFileSync('git', ['-C', dir, ...gitArgs], {
    encoding: 'utf8',
    env: { ...process.env, TZ: 'Asia/Tokyo' },
    stdio: ['ignore', 'pipe', 'ignore'],
  });

// クラウドの Claude Code が作ったコミットには、本文に会話へのリンクが入る
const CLOUD_SESSION_RE = /https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]+/;

function collectGit() {
  // git worktree は別フォルダでも同じリポジトリなので、共通の .git ごとにまとめて1回だけ数える
  const groups = new Map();
  if (!fs.existsSync(DEV_DIR)) return [];
  for (const name of fs.readdirSync(DEV_DIR).sort()) {
    const dir = path.join(DEV_DIR, name);
    if (!fs.existsSync(path.join(dir, '.git'))) continue;
    let common;
    try {
      common = gitOut(dir, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
    } catch {
      continue;
    }
    if (!groups.has(common)) groups.set(common, []);
    groups.get(common).push(name);
  }

  const repos = [];
  for (const [common, names] of groups) {
    // 表示名は本体のフォルダ名（.git の親）。見つからなければ最初のフォルダ名
    const mainName = path.basename(common) === '.git' ? path.basename(path.dirname(common)) : null;
    const name = names.includes(mainName) ? mainName : names[0];
    let log = '';
    try {
      log = gitOut(path.join(DEV_DIR, name), [
        'log', '--all', '--no-merges',
        `--since=${FROM}T00:00:00+09:00`, `--until=${TO}T23:59:59+09:00`,
        '--date=format-local:%Y-%m-%d', '--pretty=%H%x1f%cd%x1f%s%x1f%b%x1e',
      ]);
    } catch {
      continue;
    }
    let commits = log
      .split('\x1e')
      .map((rec) => rec.replace(/^\n/, ''))
      .filter(Boolean)
      .map((rec) => {
        const [hash, day, subject, body] = rec.split('\x1f');
        const session = (body ?? '').match(CLOUD_SESSION_RE)?.[0] ?? null;
        return { hash, day, date: day.slice(5).replace('-', '/'), subject: redact(subject ?? ''), session };
      });
    // PRをスカッシュでマージすると、ブランチ側と main 側に同じ件名のコミットが残る（main 側は末尾に (#NN)）。
    // --all で両方拾うので、ブランチ側は main 側の1件にまとめ、どちらかがクラウド製ならクラウド扱いにする。
    // 件名がたまたま同じ別のコミット（定型の chore など）はまとめない
    const PR_SUFFIX = /\s*\(#\d+\)$/;
    const merged = new Map(commits.filter((c) => PR_SUFFIX.test(c.subject)).map((c) => [c.subject.replace(PR_SUFFIX, ''), c]));
    commits = commits.filter((c) => {
      const squashed = !PR_SUFFIX.test(c.subject) && merged.get(c.subject);
      if (squashed) squashed.session ??= c.session;
      return !squashed;
    });
    if (commits.length) repos.push({ name, worktrees: names.filter((n) => n !== name), commits });
  }
  return repos.sort((a, b) => b.commits.length - a.commits.length);
}

// ---------- 出力 ----------
function render(claude, codex, git) {
  const all = [...claude, ...codex];
  const promptCount = (ss) => ss.reduce((n, s) => n + s.prompts.length, 0);
  const projects = new Set(all.map((s) => shortCwd(s.cwd)));
  const commitTotal = git.reduce((n, r) => n + r.commits.length, 0);
  // クラウドのセッションは手元に会話が残らないので、依頼数の代わりにコミットで数える
  const cloud = git.flatMap((r) => r.commits.filter((c) => c.session).map((c) => ({ ...c, repo: r.name })));
  const cloudSessions = new Set(cloud.map((c) => c.session));
  const cloudByDate = new Map();
  for (const c of cloud) cloudByDate.set(c.day, (cloudByDate.get(c.day) ?? 0) + 1);

  // 時間帯・曜日分布
  const hours = Array(24).fill(0);
  const byDate = new Map();
  for (const s of all) {
    for (const p of s.prompts) {
      hours[jstHour(p.ts)]++;
      byDate.set(jstDate(p.ts), (byDate.get(jstDate(p.ts)) ?? 0) + 1);
    }
  }
  const bar = (n, max) => '█'.repeat(Math.round((n / Math.max(max, 1)) * 20));
  const maxHour = Math.max(...hours);
  const maxDate = Math.max(0, ...byDate.values());

  const L = [];
  L.push(`# AI Weekly Log 素材 ${FROM} 〜 ${TO}`);
  L.push('');
  L.push('> 自動集計した素材です。公開前に、クライアント名・未発表情報・個人情報が含まれていないか必ず確認してください。');
  L.push('');
  L.push('## This Week in Numbers');
  L.push('');
  L.push('| 指標 | Claude Code | Codex | 合計 |');
  L.push('| --- | ---: | ---: | ---: |');
  L.push(`| セッション数 | ${claude.length} | ${codex.length} | ${all.length} |`);
  L.push(`| 依頼（プロンプト）数 | ${promptCount(claude)} | ${promptCount(codex)} | ${promptCount(all)} |`);
  L.push(`| 触ったプロジェクト | ${new Set(claude.map((s) => shortCwd(s.cwd))).size} | ${new Set(codex.map((s) => shortCwd(s.cwd))).size} | ${projects.size} |`);
  L.push(`| 出力トークン / 総トークン | ${claude.reduce((n, s) => n + s.outputTokens, 0).toLocaleString()} (output) | ${codex.reduce((n, s) => n + s.totalTokens, 0).toLocaleString()} (total) | - |`);
  L.push(`| うち Claude→Codex 引き継ぎ | - | ${codex.filter((s) => s.handoff).length} | - |`);
  L.push(`| git コミット | - | - | ${commitTotal}（${git.length}リポジトリ） |`);
  L.push(`| うちクラウドのAIが作ったコミット（依頼数に入らない） | - | - | ${cloud.length}（${cloudSessions.size}セッション） |`);
  L.push('');

  L.push('## 日別の依頼数');
  L.push('');
  L.push('```');
  // 依頼が0回の日も、クラウドのコミットがあることがあるので7日すべて出す
  for (let t = fromMs; t <= toMs; t += 24 * 60 * 60 * 1000) {
    const d = jstDate(new Date(t).toISOString());
    const n = byDate.get(d) ?? 0;
    const c = cloudByDate.get(d);
    L.push(`${d} ${String(n).padStart(4)} ${bar(n, maxDate)}${c ? `  （クラウドのコミット ${c}件）` : ''}`);
  }
  L.push('```');
  L.push('');
  if (cloud.length) {
    L.push('## クラウドのAIが作ったコミット（集計外）');
    L.push('');
    L.push(`クラウドの Claude Code の会話は手元に残らないため、上の依頼数には入っていない。コミット本文に会話へのリンクがあるものを数えた（${cloudSessions.size}セッション）。`);
    L.push('');
    for (const c of cloud.sort((a, b) => a.day.localeCompare(b.day))) L.push(`- ${c.date} ${c.repo}: ${c.subject}`);
    L.push('');
  }
  L.push('## 時間帯別の依頼数（JST）');
  L.push('');
  L.push('```');
  hours.forEach((n, h) => n && L.push(`${String(h).padStart(2, '0')}時 ${String(n).padStart(4)} ${bar(n, maxHour)}`));
  L.push('```');
  L.push('');

  L.push('## git コミット');
  L.push('');
  for (const r of git) {
    const wt = r.worktrees.length ? ` ※worktree ${r.worktrees.join('・')} を含む` : '';
    L.push(`### ${r.name}（${r.commits.length}）${wt}`);
    for (const c of r.commits.slice(0, 15)) L.push(`- ${c.date} ${c.session ? '[クラウド] ' : ''}${c.subject}`);
    if (r.commits.length > 15) L.push(`- …ほか ${r.commits.length - 15} 件`);
    L.push('');
  }

  L.push('## プロジェクト別セッション');
  L.push('');
  const byProject = new Map();
  for (const s of all) {
    const k = shortCwd(s.cwd);
    if (!byProject.has(k)) byProject.set(k, []);
    byProject.get(k).push(s);
  }
  const sortedProjects = [...byProject].sort((a, b) => promptCount(b[1]) - promptCount(a[1]));
  for (const [proj, ss] of sortedProjects) {
    L.push(`### ${proj}（Claude ${ss.filter((s) => s.tool === 'Claude').length} / Codex ${ss.filter((s) => s.tool === 'Codex').length}）`);
    L.push('');
    for (const s of ss.sort((a, b) => a.first.localeCompare(b.first))) {
      const title = s.name ? ` 「${redact(s.name)}」` : '';
      const label = s.handoff ? 'Codex ← Claudeから引き継ぎ' : s.tool;
      L.push(`- **[${label}]** ${jstDate(s.first)}${title} — 依頼 ${s.prompts.length} 回`);
      L.push(`  - 最初の依頼: ${s.prompts[0].text}`);
      // 途中の方向転換が分かるよう、最後の依頼も載せる
      if (s.prompts.length > 1) L.push(`  - 最後の依頼: ${s.prompts.at(-1).text}`);
    }
    L.push('');
  }
  return L.join('\n');
}

const claude = collectClaude();
const codex = collectCodex();
const git = collectGit();
const md = render(claude, codex, git);

if (OUT) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md);
  console.error(`wrote ${OUT}`);
} else {
  process.stdout.write(md);
}
