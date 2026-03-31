import sanitizeHtml from 'sanitize-html';

function decodeEntities(value: string): string {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(value: string): string {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' '));
}

function normalizeComparisonText(value: string): string {
  return stripHtml(value)
    .toLowerCase()
    .replace(/["'`.,!?;:()[\]{}<>\\/|@#$%^&*_+=~-]+/g, ' ')
    .replace(/[\u2018\u2019\u201c\u201d\u2013\u2014\u2026\u0964\u0965]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMatchingPrefixTokens(leftTokens: string[], rightTokens: string[]): number {
  const max = Math.min(leftTokens.length, rightTokens.length);
  let count = 0;

  for (let index = 0; index < max; index += 1) {
    if (leftTokens[index] !== rightTokens[index]) break;
    count += 1;
  }

  return count;
}

function hasMeaningfulText(value: string): boolean {
  return normalizeComparisonText(value).length >= 24;
}

function areNearDuplicateTexts(left: string, right: string): boolean {
  const normalizedLeft = normalizeComparisonText(left);
  const normalizedRight = normalizeComparisonText(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftTokens = normalizedLeft.split(' ').filter(Boolean);
  const rightTokens = normalizedRight.split(' ').filter(Boolean);
  const shorterTokens = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
  const longerTokens = shorterTokens === leftTokens ? rightTokens : leftTokens;

  if (shorterTokens.length < 8) return false;

  const prefixMatches = countMatchingPrefixTokens(shorterTokens, longerTokens);
  if (prefixMatches === shorterTokens.length && shorterTokens.length >= 8) {
    const extraTokens = longerTokens.length - shorterTokens.length;
    if (extraTokens <= 4) return true;
  }

  return false;
}

function normalizeEscapedNewlines(value: string): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/\u0000/g, '');
}

function hasBlockHtml(value: string): boolean {
  return /<(?:p|div|ul|ol|li|blockquote|table|thead|tbody|tr|td|th|h[1-6]|hr)\b/i.test(value);
}

function hasAnyHtml(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value);
}

function normalizeInlineMarkup(value: string): string {
  return String(value || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>');
}

function isHeadingLikeLine(value: string): boolean {
  const line = String(value || '').trim();
  if (!line) return false;
  if (/^\*\*.+\*\*$/.test(line)) return true;
  if (line.length > 90) return false;
  if (/:$/.test(line)) return true;
  return !/[.!?]["')\]]?$/.test(line);
}

function shouldKeepLineBreaks(lines: string[]): boolean {
  if (lines.length <= 1) return false;
  if (lines.some((line) => /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line))) return true;
  return lines.length >= 3 && lines.every((line) => line.length <= 90);
}

function paragraphizeTextContent(value: string): string {
  const blocks = normalizeEscapedNewlines(value)
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) return '';

  return blocks
    .map((block) => {
      const lines = block
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (!lines.length) return '';

      if (lines.length > 1 && isHeadingLikeLine(lines[0])) {
        const heading = normalizeInlineMarkup(lines[0].replace(/^\*\*(.+)\*\*$/, '$1').replace(/^__(.+)__$/, '$1'));
        const rest = lines.slice(1);
        const body = shouldKeepLineBreaks(rest)
          ? rest.map((line) => normalizeInlineMarkup(line)).join('<br />')
          : normalizeInlineMarkup(rest.join(' '));

        return `<p><strong>${heading}</strong>${body ? `<br />${body}` : ''}</p>`;
      }

      const inner = shouldKeepLineBreaks(lines)
        ? lines.map((line) => normalizeInlineMarkup(line)).join('<br />')
        : normalizeInlineMarkup(lines.join(' '));

      return `<p>${inner}</p>`;
    })
    .filter(Boolean)
    .join('');
}

const TOP_LEVEL_BLOCK_TAGS = new Set([
  'p',
  'div',
  'blockquote',
  'ul',
  'ol',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'pre',
]);

function splitParagraphLikeBlock(block: string): string[] {
  const source = String(block || '').trim();
  if (!source) return [];

  const match = source.match(/^(<(p|div|blockquote)\b[^>]*>)([\s\S]*)(<\/\2>)$/i);
  if (!match) return [source];

  const openTag = String(match[1] || '');
  const tagName = String(match[2] || '').toLowerCase();
  const innerHtml = String(match[3] || '');
  const closeTag = String(match[4] || '');

  if (tagName === 'blockquote') return [source];
  if (!/(?:<br\s*\/?>\s*){2,}/i.test(innerHtml)) return [source];

  const segments = innerHtml
    .split(/(?:<br\s*\/?>\s*){2,}/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length <= 1) return [source];

  return segments.map((segment) => `${openTag}${segment}${closeTag}`);
}

export function splitArticleBodyBlocks(html: string): string[] {
  const source = String(html || '').trim();
  if (!source) return [];

  const blocks: string[] = [];
  const re = /<\/?([a-z0-9]+)\b[^>]*>/gi;
  const stack: string[] = [];
  let lastIndex = 0;
  let currentBlockStart: number | null = null;
  let currentBlockTag: string | null = null;
  let match: RegExpExecArray | null = null;

  while ((match = re.exec(source))) {
    const rawTag = match[0];
    const tagName = String(match[1] || '').toLowerCase();
    const isClosingTag = rawTag.startsWith('</');
    const isSelfClosingTag = /\/>$/.test(rawTag) || tagName === 'br' || tagName === 'hr' || tagName === 'img';

    if (!isClosingTag) {
      if (currentBlockStart == null && stack.length === 0 && TOP_LEVEL_BLOCK_TAGS.has(tagName)) {
        const before = source.slice(lastIndex, match.index);
        if (before.trim()) blocks.push(before);
        currentBlockStart = match.index;
        currentBlockTag = tagName;
      }

      if (!isSelfClosingTag) {
        stack.push(tagName);
      } else if (currentBlockStart != null && currentBlockTag === tagName && stack.length === 0) {
        const block = source.slice(currentBlockStart, match.index + rawTag.length);
        if (block.trim()) blocks.push(block);
        lastIndex = match.index + rawTag.length;
        currentBlockStart = null;
        currentBlockTag = null;
      }

      continue;
    }

    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index] === tagName) {
        stack.splice(index, 1);
        break;
      }
    }

    if (currentBlockStart != null && currentBlockTag === tagName && stack.length === 0) {
      const block = source.slice(currentBlockStart, match.index + rawTag.length);
      for (const splitBlock of splitParagraphLikeBlock(block)) {
        if (splitBlock.trim()) blocks.push(splitBlock);
      }
      lastIndex = match.index + rawTag.length;
      currentBlockStart = null;
      currentBlockTag = null;
    }
  }

  if (currentBlockStart != null) {
    const trailingBlock = source.slice(currentBlockStart);
    for (const splitBlock of splitParagraphLikeBlock(trailingBlock)) {
      if (splitBlock.trim()) blocks.push(splitBlock);
    }
    lastIndex = source.length;
  }

  const rest = source.slice(lastIndex);
  if (rest.trim()) blocks.push(rest);

  return blocks;
}

export function stripDuplicateOpeningParagraph(html: string, summary: string): string {
  const source = String(html || '').trim();
  const summaryText = String(summary || '').trim();

  if (!source || !summaryText) return source;

  const blocks = splitArticleBodyBlocks(source);
  if (!blocks.length) return source;

  const firstParagraphIndex = blocks.findIndex((block) => /^<p\b/i.test(String(block || '').trim()));
  if (firstParagraphIndex < 0) return source;

  const firstParagraph = blocks[firstParagraphIndex];
  if (!areNearDuplicateTexts(firstParagraph, summaryText)) return source;

  const remainingHtml = blocks.filter((_, index) => index !== firstParagraphIndex).join('').trim();
  if (!remainingHtml) return source;
  if (!hasMeaningfulText(remainingHtml)) return source;

  return remainingHtml;
}

export function formatArticleBodyHtml(rawContent: string): string {
  const normalized = normalizeEscapedNewlines(rawContent).trim();
  if (!normalized) return '';

  const htmlish = hasAnyHtml(normalized);
  const preSanitized = htmlish && hasBlockHtml(normalized) ? normalized : paragraphizeTextContent(normalized);

  return sanitizeHtml(preSanitized, {
    disallowedTagsMode: 'discard',
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'b',
      'i',
      'u',
      's',
      'blockquote',
      'code',
      'pre',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'a',
      'span',
      'div',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      '*': ['class', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  });
}