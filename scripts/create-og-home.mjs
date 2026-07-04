import sharp from 'sharp';

const width = 1200;
const height = 630;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#111111"/>
  <path d="M0 520H1200" stroke="#2A2A2A" stroke-width="1"/>
  <path d="M860 0L1200 0L1200 630L720 630C820 520 920 410 980 286C1035 172 1010 74 860 0Z" fill="#0F766E" fill-opacity="0.18"/>
  <path d="M96 96H1104V534H96V96Z" stroke="#2F2F2F" stroke-width="2"/>
  <rect x="96" y="96" width="10" height="438" fill="#0F766E"/>
  <text x="144" y="170" fill="#5EEAD4" font-size="28" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif">AI時代の個人開発ログ</text>
  <text x="144" y="285" fill="#FFFFFF" font-size="68" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif">作って、届けて、</text>
  <text x="144" y="365" fill="#FFFFFF" font-size="68" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif">改善する。</text>
  <text x="146" y="440" fill="#D4D4D4" font-size="28" font-weight="500" font-family="-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP', sans-serif">React / Next.js / TypeScript / SwiftUI / Expo / AI API</text>
  <text x="144" y="500" fill="#A3A3A3" font-size="24" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif">Yuki Kawabata</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og-home.png');
