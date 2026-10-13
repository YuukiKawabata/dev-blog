// 転載先（X / Zenn / note）からブログに戻ってきた読者を GA4 で区別するための UTM 付与。
// canonical は Base.astro がパスだけで組み立てるので、クエリを付けても SEO には影響しない。

const MEDIUM = {
  x: 'social',
  zenn: 'referral',
  note: 'referral',
};

/**
 * @param {string} url ブログ記事の絶対URL
 * @param {{ source: keyof typeof MEDIUM, campaign: string }} options campaign は記事の slug
 * @returns {string}
 */
function withUtm(url, { source, campaign }) {
  const parsed = new URL(url);
  // frontmatter で UTM 付きのURLを明示している場合はそれを優先する。
  if (parsed.searchParams.has('utm_source')) return url;
  parsed.searchParams.set('utm_source', source);
  parsed.searchParams.set('utm_medium', MEDIUM[source] ?? 'referral');
  parsed.searchParams.set('utm_campaign', campaign);
  return parsed.toString();
}

module.exports = { withUtm };
