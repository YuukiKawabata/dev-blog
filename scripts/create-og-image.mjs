// サイト共通のOG画像（SNSでシェアされたときの画像）を生成する。
// アプリの本数が変わったら src/config/apps.ts の publishedAppCount を更新してから実行する:
//   node scripts/create-og-image.mjs
// 日本語フォント（ヒラギノ）を使うため、macOSのGoogle Chromeで描画する。
// sharpはWASM版だとシステムフォントを読めず、文字が消えるので使わない。
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT = path.resolve('public/og-yuki-kawabata.png');

const appsSource = readFileSync(new URL('../src/config/apps.ts', import.meta.url), 'utf8');
const count = appsSource.match(/publishedAppCount\s*=\s*(\d+)/)?.[1];
if (!count) throw new Error('publishedAppCount が src/config/apps.ts に見つかりません');

const width = 1200;
const height = 630;
const serif = "'Hiragino Mincho ProN', 'Yu Mincho', serif";
const sans = "'Hiragino Sans', 'Noto Sans JP', sans-serif";

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#FBFAF8"/>
  <circle cx="1080" cy="40" r="200" fill="#fbe7de" fill-opacity="0.85"/>
  <circle cx="1120" cy="600" r="190" fill="#fdf4f0"/>
  <rect x="72" y="66" width="1056" height="498" rx="32" fill="#FBFAF8" fill-opacity="0.72" stroke="#e7e5e4" stroke-width="2"/>
  <text x="116" y="133" fill="#a8371e" font-size="25" font-weight="700" letter-spacing="3" font-family="${sans}">YUKI KAWABATA — INDIE DEV LOG</text>
  <text x="112" y="248" fill="#1c1917" font-size="66" font-weight="700" font-family="${serif}">元コンビニ店長、</text>
  <text x="112" y="332" fill="#1c1917" font-size="66" font-weight="700" font-family="${serif}">アプリを${count}本出しました。</text>
  <text x="116" y="406" fill="#57534e" font-size="36" font-weight="700" font-family="${serif}">たぶん、まだ誰も知りません。</text>
  <path d="M116 466H1084" stroke="#d6d3d1" stroke-width="2"/>
  <text x="116" y="513" fill="#78716c" font-size="21" font-family="${sans}">AI開発・個人開発の本音と失敗談｜大阪・珈琲</text>
  <circle cx="1076" cy="513" r="10" fill="#dd5a35"/>
</svg>`;

const workDir = mkdtempSync(path.join(tmpdir(), 'og-image-'));
try {
  const svgPath = path.join(workDir, 'og.svg');
  writeFileSync(svgPath, svg);
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${width},${height}`,
      `--screenshot=${OUTPUT}`,
      `file://${svgPath}`,
    ],
    { stdio: 'ignore' }
  );
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
console.log(`public/og-yuki-kawabata.png を生成しました（アプリ${count}本）`);
