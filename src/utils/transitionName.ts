// 一覧の記事タイトル ⇄ 記事ページ見出しを View Transitions でモーフさせるための
// 共有 view-transition-name。CSS 識別子として安全な文字だけに正規化する。
export const postTitleTransition = (slug: string) =>
  `post-title-${slug.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
