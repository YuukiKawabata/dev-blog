import { toString as mdastToString } from 'mdast-util-to-string';

/**
 * Build the "digest" tree: a short teaser that lives on X, with the full article
 * staying on the blog. Keeping the body off X is deliberate — a full mirror
 * hands the traffic to X instead of routing it back to the blog.
 */

const DEFAULTS = {
  maxLead: 3,
  maxPoints: 8,
  pointsHeading: 'この記事で書いたこと',
  ctaText: '続きはブログで読めます。',
};

// Navigational headings say nothing about the content, so they make poor bullets.
const BOILERPLATE_HEADINGS =
  /^(はじめに|introduction|概要|目次|おわりに|さいごに|最後に|参考(文献|リンク|資料)?|関連記事|免責事項?)$/i;

function isImageOnlyParagraph(node) {
  const children = node.children ?? [];
  return (
    children.some((child) => child.type === 'image') &&
    children.every((child) => child.type === 'image' || (child.type === 'text' && child.value.trim() === ''))
  );
}

/**
 * The lead paragraphs: everything before the first section heading that follows
 * real prose. Leading headings (e.g. "## はじめに") are skipped, not counted.
 */
export function extractLead(tree, maxLead = DEFAULTS.maxLead) {
  const lead = [];

  for (const node of tree.children ?? []) {
    if (node.type === 'heading') {
      if (lead.length > 0) break;
      continue;
    }

    if (node.type !== 'paragraph' || isImageOnlyParagraph(node)) continue;
    if (mdastToString(node).trim() === '') continue;

    lead.push(node);
    if (lead.length >= maxLead) break;
  }

  return lead;
}

/** Section headings (h2) used as the bullet list of what the article covers. */
export function extractPoints(tree, maxPoints = DEFAULTS.maxPoints, skip = []) {
  const extraSkip = skip.map((entry) => String(entry).trim()).filter(Boolean);

  return (tree.children ?? [])
    .filter((node) => node.type === 'heading' && node.depth === 2)
    .map((node) => mdastToString(node).trim())
    .map((text) => text.replace(/^\d+[.．)]\s*/, '').trim())
    .filter(Boolean)
    .filter((text) => !BOILERPLATE_HEADINGS.test(text) && !extraSkip.includes(text))
    .slice(0, maxPoints);
}

function paragraph(children) {
  return { type: 'paragraph', children };
}

function text(value) {
  return { type: 'text', value };
}

/**
 * @param {object} tree Parsed mdast of the full article
 * @param {object} options
 * @param {string} options.url Canonical blog URL
 * @returns {{tree: object, points: string[]}} A synthetic mdast root ready for toContentState
 */
export function buildDigestTree(tree, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const lead = extractLead(tree, config.maxLead);
  const points = extractPoints(tree, config.maxPoints, config.skipPoints ?? []);

  const children = [...lead];

  if (points.length > 0) {
    children.push({ type: 'heading', depth: 2, children: [text(config.pointsHeading)] });
    children.push({
      type: 'list',
      ordered: false,
      children: points.map((point) => ({
        type: 'listItem',
        children: [paragraph([text(point)])],
      })),
    });
  }

  if (config.url) {
    children.push({ type: 'heading', depth: 2, children: [text('全文はこちら')] });
    children.push(paragraph([text(config.ctaText)]));
    children.push(paragraph([{ type: 'link', url: config.url, children: [text(config.url)] }]));
  }

  return { tree: { type: 'root', children }, points };
}
