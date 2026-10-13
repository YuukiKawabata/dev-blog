#!/usr/bin/env node
// GA4 プロパティの初期設定を Admin API でまとめて行う。何度実行しても同じ状態になる（作成済みのものは飛ばす）。
//
//   - ウェブストリームを探して測定IDを src/config/config.json に書き込む
//   - 拡張計測の「ブラウザの履歴イベントに基づくページの変更」をオフ（page_view はサイト側で送るため）
//   - キーイベント app_store_click / article_read_complete
//   - イベントスコープのカスタムディメンション
//   - イベントデータの保持期間を14か月に
//
// 使い方:
//   node scripts/analytics-setup.mjs            # 実行
//   node scripts/analytics-setup.mjs --dry-run  # 何をするかだけ表示
//
// 必要な環境変数: GA4_PROPERTY_ID, GOOGLE_APPLICATION_CREDENTIALS
// サービスアカウントには GA4 プロパティの「編集者」権限が必要（レポートだけなら「閲覧者」で足りる）。

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { google } from 'googleapis';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(REPO_ROOT, 'src/config/config.json');
const API = 'https://analyticsadmin.googleapis.com';

const KEY_EVENTS = ['app_store_click', 'article_read_complete'];
const CUSTOM_DIMENSIONS = [
  { parameterName: 'article_slug', displayName: '記事スラッグ' },
  { parameterName: 'article_tags', displayName: '記事タグ' },
  { parameterName: 'published_date', displayName: '記事公開日' },
  { parameterName: 'link_target', displayName: 'リンク先（data-track）' },
  { parameterName: 'link_detail', displayName: 'リンク補足' },
  { parameterName: 'app_name', displayName: 'アプリ名' },
  { parameterName: 'percent', displayName: '読了位置（%）' },
];

const dryRun = process.argv.includes('--dry-run');
const propertyId = process.env.GA4_PROPERTY_ID?.trim();

if (!propertyId || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GA4_PROPERTY_ID と GOOGLE_APPLICATION_CREDENTIALS を .env に設定してください（docs/analytics.md）。');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/analytics.edit'] });
const client = await auth.getClient();
const property = `properties/${propertyId}`;

async function call(method, url, data) {
  try {
    const res = await client.request({ method, url: `${API}/${url}`, data });
    return res.data;
  } catch (error) {
    const detail = error.response?.data?.error?.message ?? error.message;
    throw new Error(`${method} ${url}: ${detail}`);
  }
}

const log = (msg) => console.log(dryRun ? `[dry-run] ${msg}` : msg);

// ---------- ウェブストリームと測定ID ----------
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const siteHost = new URL(config.site.base_url).host;

const { dataStreams = [] } = await call('GET', `v1beta/${property}/dataStreams`);
const webStreams = dataStreams.filter((s) => s.type === 'WEB_DATA_STREAM');
const stream =
  webStreams.find((s) => s.webStreamData?.defaultUri && new URL(s.webStreamData.defaultUri).host === siteHost) ??
  webStreams[0];
if (!stream) {
  console.error(
    `ウェブストリームがありません。GA4 の管理画面で ${config.site.base_url} のウェブストリームを作ってください。`
  );
  process.exit(1);
}
const measurementId = stream.webStreamData.measurementId;
console.log(`ストリーム: ${stream.displayName} (${stream.webStreamData.defaultUri}) 測定ID ${measurementId}`);

if (config.analytics?.ga4MeasurementId === measurementId) {
  console.log('  測定IDは config.json に設定済み');
} else {
  log(
    `  測定IDを src/config/config.json に書き込み（${
      config.analytics?.ga4MeasurementId || '未設定'
    } → ${measurementId}）`
  );
  if (!dryRun) {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    fs.writeFileSync(CONFIG_PATH, raw.replace(/("ga4MeasurementId":\s*)"[^"]*"/, `$1"${measurementId}"`));
  }
}

// ---------- 拡張計測: ページ遷移の自動 page_view をオフ ----------
const emName = `${stream.name}/enhancedMeasurementSettings`;
const em = await call('GET', `v1alpha/${emName}`);
if (em.pageChangesEnabled === false) {
  console.log('拡張計測: ページ変更の自動計測は無効化済み');
} else {
  log('拡張計測: ページ変更の自動計測を無効化');
  if (!dryRun) await call('PATCH', `v1alpha/${emName}?updateMask=pageChangesEnabled`, { pageChangesEnabled: false });
}

// ---------- キーイベント ----------
const { keyEvents = [] } = await call('GET', `v1beta/${property}/keyEvents`);
for (const eventName of KEY_EVENTS) {
  if (keyEvents.some((k) => k.eventName === eventName)) {
    console.log(`キーイベント ${eventName}: 作成済み`);
    continue;
  }
  log(`キーイベント ${eventName}: 作成`);
  if (!dryRun) await call('POST', `v1beta/${property}/keyEvents`, { eventName, countingMethod: 'ONCE_PER_EVENT' });
}

// ---------- カスタムディメンション ----------
const { customDimensions = [] } = await call('GET', `v1beta/${property}/customDimensions?pageSize=200`);
for (const dim of CUSTOM_DIMENSIONS) {
  if (customDimensions.some((d) => d.parameterName === dim.parameterName && d.scope === 'EVENT')) {
    console.log(`カスタムディメンション ${dim.parameterName}: 作成済み`);
    continue;
  }
  log(`カスタムディメンション ${dim.parameterName}: 作成`);
  if (!dryRun) await call('POST', `v1beta/${property}/customDimensions`, { ...dim, scope: 'EVENT' });
}

// ---------- データ保持 ----------
const retention = await call('GET', `v1beta/${property}/dataRetentionSettings`);
// 初期値は2か月。それより長く設定済みなら触らない。
if (
  retention.eventDataRetention &&
  !['TWO_MONTHS', 'RETENTION_DURATION_UNSPECIFIED'].includes(retention.eventDataRetention)
) {
  console.log(`データ保持: ${retention.eventDataRetention}（変更なし）`);
} else {
  log(`データ保持: ${retention.eventDataRetention} → FOURTEEN_MONTHS`);
  if (!dryRun) {
    await call('PATCH', `v1beta/${property}/dataRetentionSettings?updateMask=eventDataRetention`, {
      eventDataRetention: 'FOURTEEN_MONTHS',
    });
  }
}

console.log(
  dryRun
    ? '\n--dry-run なので何も変更していません。'
    : '\n完了。src/config/config.json の測定IDをコミットして main に push すると、本番で計測が始まります。'
);
