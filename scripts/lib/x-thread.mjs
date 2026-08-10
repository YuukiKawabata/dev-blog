/**
 * Thread generation for the announcement chain that drives traffic to the blog.
 *
 * Length is measured the way X measures it (twitter-text weighted length):
 * code points inside the Latin/general-punctuation ranges count as 1, everything
 * else — CJK, kana, emoji — counts as 2. URLs are always billed at 23.
 */

const POST_LIMIT = 280;
const URL_WEIGHT = 23;
const ELLIPSIS = '…';
const URL_PATTERN = /https?:\/\/\S+/g;

// twitter-text default weighted ranges (weight 1); anything outside weighs 2.
const LIGHT_RANGES = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2037],
];

function charWeight(codePoint) {
  return LIGHT_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end) ? 1 : 2;
}

export function weightedLength(input) {
  const withoutUrls = input.replace(URL_PATTERN, '');
  const urlCount = input.match(URL_PATTERN)?.length ?? 0;

  let total = urlCount * URL_WEIGHT;
  for (const char of withoutUrls) {
    total += charWeight(char.codePointAt(0));
  }

  return total;
}

/**
 * Truncate to `limit` weighted units, appending an ellipsis when it had to cut.
 * The ellipsis itself weighs 2, so its budget is reserved up front — otherwise
 * the result overshoots the limit by exactly the ellipsis.
 */
export function truncateWeighted(input, limit) {
  if (weightedLength(input) <= limit) return input;

  const budget = limit - weightedLength(ELLIPSIS);
  if (budget <= 0) return '';

  let result = '';
  for (const char of input) {
    if (weightedLength(result + char) > budget) break;
    result += char;
  }

  return `${result.trimEnd()}${ELLIPSIS}`;
}

/** Greedily fill each post to the limit before starting the next one. */
function greedyPack(lines, { limit, reserve = 0 }) {
  const posts = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (weightedLength(candidate) + reserve <= limit) {
      current = candidate;
      continue;
    }

    if (current) posts.push(current);
    current = truncateWeighted(line, limit - reserve);
  }

  if (current) posts.push(current);
  return posts;
}

/**
 * Pack bullet lines into posts, spreading them evenly rather than cramming the
 * first post full. Greedy packing leaves trailing posts with a single lonely
 * bullet, which reads badly in a thread.
 */
function packLines(lines, { limit, reserve = 0 }) {
  const greedy = greedyPack(lines, { limit, reserve });
  if (greedy.length <= 1) return greedy;

  const linesPerPost = Math.ceil(lines.length / greedy.length);
  const balanced = [];
  let current = [];

  for (const line of lines) {
    const candidate = [...current, line];
    const fits = candidate.length <= linesPerPost && weightedLength(candidate.join('\n')) + reserve <= limit;

    if (fits) {
      current = candidate;
      continue;
    }

    if (current.length > 0) balanced.push(current.join('\n'));
    current = [line];
  }

  if (current.length > 0) balanced.push(current.join('\n'));

  // Only take the balanced layout when it did not cost an extra post.
  return balanced.length <= greedy.length ? balanced : greedy;
}

function formatHashtags(tags = []) {
  return tags
    .map((tag) => String(tag).trim().replace(/^#/, ''))
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(' ');
}

/**
 * Build the thread. Post 1 carries no link on purpose — link-free openers reach
 * further, and the URL lands in the closing post where the intent is highest.
 *
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.description]
 * @param {string[]} [options.points] Section headings from the article
 * @param {string} options.url Canonical blog URL
 * @param {string[]} [options.hashtags]
 * @param {number} [options.maxPosts]
 * @returns {string[]} Post texts, in order
 */
export function buildThread({
  title,
  description = '',
  points = [],
  url,
  hashtags = [],
  maxPosts = 5,
  cta = '全文はこちら',
} = {}) {
  const opener = truncateWeighted([title, description].filter(Boolean).join('\n\n'), POST_LIMIT);

  const bodyBudget = Math.max(1, maxPosts - 2);
  const bullets = points.map((point, index) => `${index + 1}. ${point}`);
  const body = packLines(bullets, { limit: POST_LIMIT }).slice(0, bodyBudget);

  const tagLine = formatHashtags(hashtags);
  const closing = [cta, url, ...(tagLine ? [tagLine] : [])].filter(Boolean).join('\n');

  return [opener, ...body, closing].filter((post) => post.trim() !== '');
}

/** Reject any post that would be rejected by the API, before spending a call. */
export function validateThread(posts) {
  const errors = [];

  posts.forEach((post, index) => {
    const length = weightedLength(post);
    if (length > POST_LIMIT) {
      errors.push(`Post ${index + 1} is ${length}/${POST_LIMIT} weighted characters`);
    }
    if (post.trim() === '') {
      errors.push(`Post ${index + 1} is empty`);
    }
  });

  return errors;
}
