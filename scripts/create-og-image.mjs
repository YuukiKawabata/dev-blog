// サイト共通のOG画像（SNSでシェアされたときの画像）を生成する。
//   node scripts/create-og-image.mjs
// X のヘッダー画像と同じ構成（YUKI / 日常に、ひとつの工夫。 / WEB & APP DEVELOPMENT / マーク）。
// フォントは @fontsource の Noto Sans JP / Inter を読み込むので、OS に日本語フォントがなくても同じ見た目になる。
// Chrome の場所は CHROME_PATH で上書きできる（既定は macOS の Google Chrome）。
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT = path.resolve('public/og-yuki-kawabata.png');

const width = 1200;
const height = 630;
const fontCss = (pkg, weight) => pathToFileURL(path.resolve(`node_modules/@fontsource/${pkg}/${weight}.css`)).href;

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="${fontCss('inter', 600)}" />
<link rel="stylesheet" href="${fontCss('noto-sans-jp', 500)}" />
<link rel="stylesheet" href="${fontCss('noto-sans-jp', 900)}" />
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${width}px; height: ${height}px; background: #FBFAF8; color: #0c0a09;
    font-family: 'Inter', 'Noto Sans JP', sans-serif; position: relative; overflow: hidden;
  }
  .label { font-family: 'Inter', sans-serif; font-size: 22px; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; }
  .wrap { position: absolute; left: 112px; top: 104px; }
  h1 { margin-top: 30px; font-family: 'Noto Sans JP', sans-serif; font-weight: 900; font-size: 104px; line-height: 1.16; letter-spacing: -0.02em; font-feature-settings: 'palt'; }
  h1 span { color: #dd5a35; }
  .sub { margin-top: 34px; }
  .mark { position: absolute; right: 120px; top: 132px; }
  .foot { position: absolute; left: 112px; right: 112px; bottom: 56px; display: flex; justify-content: space-between;
    border-top: 2px solid #e7e5e4; padding-top: 24px; font-size: 22px; font-weight: 600; color: #78716c; font-family: 'Inter', sans-serif; }
</style>
</head>
<body>
  <div class="wrap">
    <p class="label">Yuki</p>
    <h1>日常に、<br />ひとつの工夫<span>。</span></h1>
    <p class="label sub">Web &amp; App Development</p>
  </div>
  <svg class="mark" width="150" height="150" viewBox="0 0 32 32" fill="none">
    <path d="M20 6H5v21h21V12" stroke="#0c0a09" stroke-width="2" stroke-linecap="square" />
    <rect x="23" y="3" width="6" height="6" fill="#dd5a35" />
  </svg>
  <div class="foot"><span>Yuki Kawabata</span><span>dev-blog-pi-six.vercel.app</span></div>
</body>
</html>`;

const workDir = mkdtempSync(path.join(tmpdir(), 'og-image-'));
try {
  const htmlPath = path.join(workDir, 'og.html');
  const rawPath = path.join(workDir, 'raw.png');
  writeFileSync(htmlPath, html);
  // headless Chrome はウィンドウ下端の一部を描画しないので、縦に余裕を持たせて撮ってから切り出す。
  execFileSync(
    CHROME,
    [
      '--headless=new',
      // root で動くコンテナ（CI など）では sandbox を使えない。
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      '--force-device-scale-factor=1',
      '--virtual-time-budget=5000',
      `--window-size=${width},${height + 200}`,
      `--screenshot=${rawPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'ignore' }
  );
  await sharp(rawPath).extract({ left: 0, top: 0, width, height }).toFile(OUTPUT);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
console.log('public/og-yuki-kawabata.png を生成しました');
