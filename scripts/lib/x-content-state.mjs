import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/**
 * Markdown (mdast) -> X Articles `content_state`.
 *
 * content_state is DraftJS raw state with snake_case field names:
 *   { blocks: [{ text, type, depth, inline_style_ranges, entity_ranges }],
 *     entities: [{ key, value: { type, mutability, data } }] }
 *
 * Offsets are UTF-16 code unit indices, same as DraftJS.
 */

const HEADING_TYPES = {
  1: 'header-one',
  2: 'header-two',
  3: 'header-three',
};

// X Articles has no code-block type. `blockquote` keeps code visually set apart;
// `text` renders it as plain paragraphs; `omit` drops it entirely.
const CODE_BLOCK_MODES = new Set(['blockquote', 'text', 'omit']);

export function parseMarkdown(markdown) {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

/**
 * Every image URL referenced by the tree, in document order and de-duplicated.
 * Callers upload these and pass the resulting url -> media_id map back in.
 */
export function collectImageUrls(tree) {
  const urls = [];

  const visit = (node) => {
    if (node.type === 'image' && node.url && !urls.includes(node.url)) {
      urls.push(node.url);
    }
    for (const child of node.children ?? []) visit(child);
  };

  visit(tree);
  return urls;
}

function mergeStyleRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.offset - b.offset || a.style.localeCompare(b.style));
  const merged = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && previous.style === range.style && previous.offset + previous.length === range.offset) {
      previous.length += range.length;
      continue;
    }
    merged.push({ ...range });
  }

  return merged;
}

class ContentStateBuilder {
  constructor(options = {}) {
    this.options = {
      codeBlocks: 'blockquote',
      linkMode: 'entity',
      linkEntityType: 'link',
      mediaMap: new Map(),
      ...options,
    };

    if (!CODE_BLOCK_MODES.has(this.options.codeBlocks)) {
      throw new Error(`Unknown codeBlocks mode: ${this.options.codeBlocks}`);
    }

    this.blocks = [];
    this.entities = [];
    this.warnings = [];
  }

  addEntity(value) {
    const key = this.entities.length;
    this.entities.push({ key: String(key), value });
    return key;
  }

  pushText(type, text, depth = 0) {
    this.pushBlock({ type, text, depth, styles: [], entityRanges: [] });
  }

  pushBlock({ type, text, depth = 0, styles = [], entityRanges = [] }) {
    const block = { text, type };
    if (depth > 0) block.depth = depth;

    const mergedStyles = mergeStyleRanges(styles);
    if (mergedStyles.length > 0) block.inline_style_ranges = mergedStyles;
    if (entityRanges.length > 0) block.entity_ranges = entityRanges;

    this.blocks.push(block);
  }

  pushInline(type, children, depth = 0) {
    const state = { text: '', styles: [], entityRanges: [] };
    this.renderInline(children ?? [], state, []);

    if (state.text.trim() === '' && state.entityRanges.length === 0) return;

    this.pushBlock({ type, text: state.text, depth, styles: state.styles, entityRanges: state.entityRanges });
  }

  appendText(state, value, activeStyles) {
    if (!value) return;
    const offset = state.text.length;
    state.text += value;
    for (const style of activeStyles) {
      state.styles.push({ offset, length: value.length, style });
    }
  }

  renderInline(nodes, state, activeStyles) {
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          this.appendText(state, node.value, activeStyles);
          break;

        // X Articles has no monospace style, so inline code becomes plain text.
        case 'inlineCode':
          this.appendText(state, node.value, activeStyles);
          break;

        case 'strong':
          this.renderInline(node.children, state, [...new Set([...activeStyles, 'bold'])]);
          break;

        case 'emphasis':
          this.renderInline(node.children, state, [...new Set([...activeStyles, 'italic'])]);
          break;

        case 'delete':
          this.renderInline(node.children, state, [...new Set([...activeStyles, 'strikethrough'])]);
          break;

        case 'break':
          this.appendText(state, '\n', []);
          break;

        case 'link':
          this.renderLink(node, state, activeStyles);
          break;

        case 'image':
          // Inline images cannot be represented; keep the alt text so meaning survives.
          this.appendText(state, node.alt ?? '', activeStyles);
          this.warnings.push(`Inline image dropped: ${node.url}`);
          break;

        case 'footnoteReference':
          break;

        case 'html':
          this.warnings.push(`Inline HTML dropped: ${String(node.value).slice(0, 40)}`);
          break;

        default:
          if (node.children) {
            this.renderInline(node.children, state, activeStyles);
          } else if (typeof node.value === 'string') {
            this.appendText(state, node.value, activeStyles);
          }
      }
    }
  }

  renderLink(node, state, activeStyles) {
    const start = state.text.length;
    this.renderInline(node.children ?? [], state, activeStyles);
    let length = state.text.length - start;

    if (length === 0) {
      this.appendText(state, node.url, activeStyles);
      length = state.text.length - start;
    }

    if (this.options.linkMode === 'text') {
      const label = state.text.slice(start);
      if (label !== node.url) {
        this.appendText(state, ` (${node.url})`, activeStyles);
      }
      return;
    }

    const key = this.addEntity({
      type: this.options.linkEntityType,
      mutability: 'mutable',
      data: { url: node.url },
    });

    state.entityRanges.push({ key, offset: start, length });
  }

  pushImage(node) {
    const mediaId = this.options.mediaMap.get(node.url);
    if (!mediaId) {
      this.warnings.push(`Image skipped (no media id): ${node.url}`);
      return;
    }

    const key = this.addEntity({
      type: 'image',
      mutability: 'immutable',
      data: {
        media_items: [{ media_category: 'tweet_image', media_id: mediaId }],
        ...(node.alt ? { caption: node.alt } : {}),
      },
    });

    this.pushBlock({
      type: 'atomic',
      text: ' ',
      entityRanges: [{ key, offset: 0, length: 1 }],
    });
  }

  walk(nodes, { depth = 0, forceType = null } = {}) {
    for (const node of nodes) {
      switch (node.type) {
        case 'heading':
          this.pushInline(forceType ?? HEADING_TYPES[node.depth] ?? 'header-three', node.children);
          break;

        case 'paragraph': {
          const images = (node.children ?? []).filter((child) => child.type === 'image');
          const isImageOnly =
            images.length > 0 &&
            (node.children ?? []).every(
              (child) => child.type === 'image' || (child.type === 'text' && child.value.trim() === '')
            );

          if (isImageOnly) {
            for (const image of images) this.pushImage(image);
            break;
          }

          this.pushInline(forceType ?? 'unstyled', node.children, depth);
          break;
        }

        case 'list':
          this.walkList(node, depth);
          break;

        case 'blockquote':
          this.walk(node.children ?? [], { depth, forceType: 'blockquote' });
          break;

        case 'code':
          this.pushCode(node);
          break;

        case 'table':
          this.pushTable(node);
          break;

        case 'thematicBreak':
          break;

        case 'html':
          this.warnings.push(`Block HTML dropped: ${String(node.value).slice(0, 40)}`);
          break;

        case 'footnoteDefinition':
          this.walk(node.children ?? [], { depth, forceType });
          break;

        default:
          if (node.children) this.walk(node.children, { depth, forceType });
      }
    }
  }

  walkList(node, depth) {
    const type = node.ordered ? 'ordered-list-item' : 'unordered-list-item';

    for (const item of node.children ?? []) {
      for (const child of item.children ?? []) {
        if (child.type === 'paragraph') {
          this.pushInline(type, child.children, depth);
          continue;
        }

        if (child.type === 'list') {
          this.walkList(child, depth + 1);
          continue;
        }

        this.walk([child], { depth: depth + 1 });
      }
    }
  }

  pushCode(node) {
    if (this.options.codeBlocks === 'omit') {
      this.warnings.push(`Code block omitted (${node.lang ?? 'no lang'})`);
      return;
    }

    const type = this.options.codeBlocks === 'blockquote' ? 'blockquote' : 'unstyled';
    for (const line of String(node.value).split('\n')) {
      this.pushText(type, line === '' ? ' ' : line);
    }
  }

  pushTable(node) {
    this.warnings.push('Table flattened to text (X Articles has no table block)');

    for (const row of node.children ?? []) {
      const cells = (row.children ?? []).map((cell) => {
        const state = { text: '', styles: [], entityRanges: [] };
        this.renderInline(cell.children ?? [], state, []);
        return state.text.trim();
      });

      this.pushText('unstyled', cells.join(' | '));
    }
  }

  toJSON() {
    return { blocks: this.blocks, entities: this.entities };
  }

  /** Warnings collapsed to one line per distinct message, with a count. */
  summarizeWarnings() {
    const counts = new Map();
    for (const warning of this.warnings) {
      counts.set(warning, (counts.get(warning) ?? 0) + 1);
    }

    return [...counts.entries()].map(([message, count]) => (count > 1 ? `${message} (×${count})` : message));
  }
}

/**
 * Convert an mdast tree into a content_state payload.
 *
 * @returns {{contentState: object, warnings: string[]}}
 */
export function toContentState(tree, options = {}) {
  const builder = new ContentStateBuilder(options);
  builder.walk(tree.children ?? []);

  return { contentState: builder.toJSON(), warnings: builder.summarizeWarnings() };
}
