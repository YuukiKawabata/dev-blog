#!/usr/bin/env node
// 記事ごとの読まれ方・流入元・アプリ送客・検索キーワードを GA4 と Search Console から集めて
// Markdown レポートにする。
//
// 使い方:
//   node scripts/analytics-report.mjs                        # 直近7日（昨日まで, JST）
//   node scripts/analytics-report.mjs --from 2026-10-01 --to 2026-10-11
//   node scripts/analytics-report.mjs --out /path/to/report.md
//
// 必要な環境変数（.env でも可。手順は docs/analytics.md）:
//   GA4_PROPERTY_ID                 GA4 のプロパティID（数字のみ。測定ID G-XXXX ではない）
//   GSC_SITE_URL                    Search Console のプロパティ（例: https://dev-blog-pi-six.vercel.app/）
//   GOOGLE_APPLICATION_CREDENTIALS  サービスアカウントの JSON 鍵のパス

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { google } from 'googleapis';
import yaml from 'js-yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = path.join(REPO_ROOT, 'src/content/blog');
const TZ_OFFSET_MS = 9 * 60 * 60 * 1000; // JST

// ---------- 引数 ----------
const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (args.includes('--help') || args.includes('-h')) {
  console.log(`analytics-report — GA4 + Search Console の記事別レポート

Usage:
  node scripts/analytics-report.mjs [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out FILE] [--top N]

Env:
  GA4_PROPERTY_ID, GSC_SITE_URL, GOOGLE_APPLICATION_CREDENTIALS（どちらか片方だけでも動く）`);
  process.exit(0);
}

function defaultRange() {
  const fmt = (d) => d.toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() + TZ_OFFSET_MS);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const start = new Date(yesterday);
  start.setUTCDate(yesterday.getUTCDate() - 6);
  return [fmt(start), fmt(yesterday)];
}

const [defFrom, defTo] = defaultRange();
const FROM = argOf('--from') ?? defFrom;
const TO = argOf('--to') ?? defTo;
const OUT = argOf('--out');
const TOP = Number(argOf('--top') ?? 20);

const propertyId = process.env.GA4_PROPERTY_ID?.trim();
const gscSite = process.env.GSC_SITE_URL?.trim();

if (!propertyId && !gscSite) {
  console.error('GA4_PROPERTY_ID と GSC_SITE_URL のどちらも未設定です。docs/analytics.md の手順で設定してください。');
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS（サービスアカウントの JSON 鍵のパス）が未設定です。');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/analytics.readonly', 'https://www.googleapis.com/auth/webmasters.readonly'],
});

// ---------- 記事タイトル ----------
const weeklySlugs = new Set();
function loadPostTitles() {
  const titles = new Map();
  for (const file of fs.readdirSync(BLOG_DIR)) {
    if (!/\.mdx?$/.test(file)) continue;
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
    const match = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;
    const data = yaml.load(match[1]) ?? {};
    if (data.title) titles.set(file.replace(/\.mdx?$/, ''), data.title);
    if (data.series === 'weekly-log' && !data.draft) weeklySlugs.add(file.replace(/\.mdx?$/, ''));
  }
  return titles;
}

const titles = loadPostTitles();
const slugOfPath = (pagePath) => pagePath.match(/^\/blog\/([^/]+)\/?$/)?.[1];
const labelOf = (slug) => titles.get(slug) ?? slug;

// ---------- 表示 ----------
const num = (n) => Math.round(n).toLocaleString('ja-JP');
const pct = (n) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '-');
const secs = (n) =>
  Number.isFinite(n) ? `${Math.floor(n / 60)}分${String(Math.round(n % 60)).padStart(2, '0')}秒` : '-';
const cell = (v) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function table(headers, rows) {
  if (rows.length === 0) return '_データなし_\n';
  return (
    [
      `| ${headers.join(' | ')} |`,
      `| ${headers.map(() => '---').join(' | ')} |`,
      ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
    ].join('\n') + '\n'
  );
}

// ---------- GA4 ----------
async function runReport(analyticsdata, body) {
  const res = await analyticsdata.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: { dateRanges: [{ startDate: FROM, endDate: TO }], limit: 1000, ...body },
  });
  return (res.data.rows ?? []).map((row) => ({
    dims: (row.dimensionValues ?? []).map((v) => v.value),
    mets: row.metricValues.map((v) => Number(v.value)),
  }));
}

const eventIs = (name) => ({
  filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: name } },
});

async function ga4Section() {
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
  const out = [];

  const [pages, reads, apps, sources, landing] = await Promise.all([
    runReport(analyticsdata, {
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'userEngagementDuration' }],
    }),
    runReport(analyticsdata, {
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: eventIs('article_read_complete'),
    }),
    runReport(analyticsdata, {
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: eventIs('app_store_click'),
    }),
    runReport(analyticsdata, {
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'sessions' }, { name: 'engagedSessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    }),
    runReport(analyticsdata, {
      dimensions: [{ name: 'landingPage' }, { name: 'sessionSource' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    }),
  ]);

  const byPath = (rows) => new Map(rows.map((r) => [r.dims[0], r.mets[0]]));
  const readMap = byPath(reads);
  const appMap = byPath(apps);

  const totalPv = pages.reduce((sum, r) => sum + r.mets[0], 0);
  const totalApps = apps.reduce((sum, r) => sum + r.mets[0], 0);
  out.push('## サイト全体 (GA4)\n');
  out.push(`- PV: ${num(totalPv)}`);
  out.push(`- アプリへの送客（app_store_click）: ${num(totalApps)}\n`);

  const articles = pages
    .map((r) => ({
      path: r.dims[0],
      slug: slugOfPath(r.dims[0]),
      pv: r.mets[0],
      users: r.mets[1],
      engagement: r.mets[2],
    }))
    .filter((r) => r.slug)
    .sort((a, b) => b.pv - a.pv)
    .slice(0, TOP);

  out.push('## 記事別の読まれ方\n');
  out.push('読了率 = 本文末尾まで到達（article_read_complete）÷ PV。滞在 = PVあたりのエンゲージメント時間。\n');
  out.push(
    table(
      ['記事', 'PV', 'ユーザー', '滞在/PV', '読了率', 'アプリ送客'],
      articles.map((a) => [
        labelOf(a.slug),
        num(a.pv),
        num(a.users),
        secs(a.engagement / a.pv),
        pct((readMap.get(a.path) ?? 0) / a.pv),
        num(appMap.get(a.path) ?? 0),
      ])
    )
  );

  out.push('## アプリ送客が起きたページ\n');
  out.push(
    table(
      ['ページ', 'クリック'],
      [...apps]
        .sort((a, b) => b.mets[0] - a.mets[0])
        .map((r) => [labelOf(slugOfPath(r.dims[0]) ?? r.dims[0]), num(r.mets[0])])
    )
  );

  out.push('## 流入元（セッション）\n');
  out.push(
    table(
      ['参照元 / メディア', 'セッション', 'エンゲージ率'],
      sources.slice(0, TOP).map((r) => [`${r.dims[0]} / ${r.dims[1]}`, num(r.mets[0]), pct(r.mets[1] / r.mets[0])])
    )
  );

  out.push('## 記事 × 流入元（ランディング）\n');
  out.push(
    table(
      ['記事', '参照元', 'セッション'],
      landing
        .filter((r) => slugOfPath(r.dims[0]))
        .slice(0, TOP)
        .map((r) => [labelOf(slugOfPath(r.dims[0])), r.dims[1], num(r.mets[0])])
    )
  );

  // 継続読者の指標は追加セクションとして取得し、失敗しても既存レポートを残す。
  out.push(
    await section('認知・継続・次の接点', true, async () => {
      const [users, returning, clicks] = await Promise.all([
        runReport(analyticsdata, { metrics: [{ name: 'totalUsers' }] }),
        runReport(analyticsdata, {
          metrics: [{ name: 'totalUsers' }],
          dimensionFilter: {
            filter: { fieldName: 'newVsReturning', stringFilter: { matchType: 'EXACT', value: 'returning' } },
          },
        }),
        runReport(analyticsdata, {
          dimensions: [{ name: 'customEvent:link_target' }],
          metrics: [{ name: 'eventCount' }],
          dimensionFilter: eventIs('outbound_click'),
        }),
      ]);
      const total = users[0]?.mets[0] ?? 0;
      const repeat = returning[0]?.mets[0] ?? 0;
      const weekly = pages.filter((r) => weeklySlugs.has(slugOfPath(r.dims[0])) || /^\/weekly\/?$/.test(r.dims[0]));
      return [
        '## 認知・継続・次の接点\n',
        `- ユーザー数（totalUsers）: ${num(total)}`,
        `- 再訪ユーザー数（newVsReturning=returning）: ${num(repeat)}`,
        `- 再訪ユーザー / 全ユーザー: ${total ? pct(repeat / total) : '-'}`,
        `- Weekly Log記事・一覧の合計PV: ${num(weekly.reduce((sum, r) => sum + r.mets[0], 0))}`,
        '\n※ 再訪はGA4で識別できた範囲。ファン数ではありません。クリックは延べ回数で、遷移完了やXフォローを意味しません。',
        '\n### Xプロフィール・記事回遊のクリック\n',
        table(
          ['リンク識別子', 'クリック'],
          clicks.filter((r) => /^(social:x:|reading:)/.test(r.dims[0])).map((r) => [r.dims[0], num(r.mets[0])])
        ),
        'Xフォロワー純増・繰り返しの反応は運用記録に手動記入。取得できない値は未取得とします。',
      ].join('\n');
    })
  );
  return out.join('\n');
}

// ---------- Search Console ----------
async function gscSection() {
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const query = async (dimensions, rowLimit) => {
    const res = await searchconsole.searchanalytics.query({
      siteUrl: gscSite,
      requestBody: { startDate: FROM, endDate: TO, dimensions, rowLimit },
    });
    return res.data.rows ?? [];
  };

  const [pages, queries, pageQueries] = await Promise.all([
    query(['page'], 1000),
    query(['query'], TOP),
    query(['page', 'query'], 1000),
  ]);

  const out = ['## 検索（Search Console）\n', '※ Search Console のデータは2〜3日遅れで確定します。\n'];
  const pathOf = (url) => new URL(url).pathname;

  out.push('### 記事別\n');
  out.push(
    table(
      ['記事', '表示', 'クリック', 'CTR', '平均順位', '上位クエリ'],
      pages
        .filter((r) => slugOfPath(pathOf(r.keys[0])))
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, TOP)
        .map((r) => {
          const top = pageQueries
            .filter((q) => q.keys[0] === r.keys[0])
            .sort((a, b) => b.impressions - a.impressions)
            .slice(0, 3)
            .map((q) => q.keys[1])
            .join(' / ');
          return [
            labelOf(slugOfPath(pathOf(r.keys[0]))),
            num(r.impressions),
            num(r.clicks),
            pct(r.ctr),
            r.position.toFixed(1),
            top || '-',
          ];
        })
    )
  );

  out.push('### 検索クエリ\n');
  out.push(
    table(
      ['クエリ', '表示', 'クリック', 'CTR', '平均順位'],
      queries.map((r) => [r.keys[0], num(r.impressions), num(r.clicks), pct(r.ctr), r.position.toFixed(1)])
    )
  );

  return out.join('\n');
}

// ---------- main ----------
async function section(label, enabled, fn) {
  if (!enabled) return `## ${label}\n\n_未設定のためスキップ_\n`;
  try {
    return await fn();
  } catch (error) {
    // 片方の権限が無くても、もう片方のレポートは出す。
    const detail = error.response?.data?.error?.message ?? error.message;
    console.error(`[${label}] ${detail}`);
    return `## ${label}\n\n_取得失敗: ${cell(detail)}_\n`;
  }
}

const sections = [
  `# ブログ分析レポート ${FROM} 〜 ${TO}\n`,
  await section('GA4', propertyId, ga4Section),
  await section('Search Console', gscSite, gscSection),
];
const report = sections.join('\n');

if (OUT) {
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  fs.writeFileSync(OUT, report);
  console.error(`wrote ${OUT}`);
} else {
  process.stdout.write(report);
}
