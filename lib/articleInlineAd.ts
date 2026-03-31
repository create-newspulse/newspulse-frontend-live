export type ArticleInlinePlacement = {
  beforeHtml: string;
  afterHtml: string;
  insertedAfterParagraph: 1 | 2 | 3 | null;
  paragraphTagCount: number;
  bodyParagraphCount: number;
  containsEscapedNewlines: boolean;
  containsLiteralNewlines: boolean;
};

type ParagraphCandidate = {
  boundary: number;
  textLength: number;
};

const IGNORED_BLOCK_TAGS = new Set(['ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr']);

function getLeadingTagName(html: string): string {
  const match = String(html || '').trim().match(/^<([a-z0-9]+)\b/i);
  return String(match?.[1] || '').toLowerCase();
}

function stripOuterTag(html: string, tagName: string): string {
  const source = String(html || '').trim();
  if (!tagName) return source;

  const open = new RegExp(`^<${tagName}\\b[^>]*>`, 'i');
  const close = new RegExp(`</${tagName}>$`, 'i');
  if (!open.test(source) || !close.test(source)) return source;

  return source.replace(open, '').replace(close, '').trim();
}

function extractBlockText(html: string): string {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHeadingOnlyBlock(blockHtml: string, blockText: string): boolean {
  if (!blockText) return false;

  const tagName = getLeadingTagName(blockHtml);
  if (/^h[1-6]$/.test(tagName)) return true;

  const innerHtml = stripOuterTag(blockHtml, tagName);
  return isHeadingOnlyParagraph(innerHtml, blockText);
}

function isCountableBodyBlock(blockHtml: string): boolean {
  const trimmed = String(blockHtml || '').trim();
  if (!trimmed) return false;

  const tagName = getLeadingTagName(trimmed);
  if (tagName && IGNORED_BLOCK_TAGS.has(tagName)) return false;

  const blockText = extractBlockText(trimmed);
  if (!blockText) return false;
  if (isHeadingOnlyBlock(trimmed, blockText)) return false;

  return true;
}

function unwrapFormattingTags(html: string): string {
  let current = String(html || '').trim();

  while (/^<(strong|b|em|span)\b[^>]*>[\s\S]*<\/(strong|b|em|span)>$/i.test(current)) {
    const next = current
      .replace(/^<(strong|b|em|span)\b[^>]*>/i, '')
      .replace(/<\/(strong|b|em|span)>$/i, '')
      .trim();

    if (next === current) break;
    current = next;
  }

  return current;
}

function isHeadingOnlyParagraph(innerHtml: string, innerText: string): boolean {
  if (!innerText) return false;
  const trimmedHtml = String(innerHtml || '').trim();
  if (trimmedHtml === innerText) return false;
  if (!/<\/?(strong|b|em|span)\b/i.test(trimmedHtml)) return false;
  const unwrapped = unwrapFormattingTags(trimmedHtml);
  return unwrapped === innerText && innerText.length <= 120;
}

function pickTargetParagraph(candidates: ParagraphCandidate[]): 1 | 2 | 3 | null {
  // Desired behavior:
  // - Keep the ad inside the reading flow, not near the bottom.
  // - Short articles insert after the 1st paragraph.
  // - Three visible body blocks insert after the 2nd.
  // - Longer articles insert after the 3rd.
  if (candidates.length >= 4) return 3;
  if (candidates.length === 3) return 2;
  if (candidates.length >= 1) return 1;
  return null;
}

function getCandidateBoundary(candidates: ParagraphCandidate[], insertedAfterParagraph: 1 | 2 | 3 | null): number | null {
  if (insertedAfterParagraph === 1) return candidates[0]?.boundary ?? null;
  if (insertedAfterParagraph === 2) return candidates[1]?.boundary ?? null;
  if (insertedAfterParagraph === 3) return candidates[2]?.boundary ?? null;
  return null;
}

export function findInlineInsertAfterBlockIndex(blocks: string[]): number | null {
  const candidateIndexes: number[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    if (isCountableBodyBlock(blocks[index])) candidateIndexes.push(index);
    if (candidateIndexes.length >= 4) break;
  }

  const insertedAfterParagraph = pickTargetParagraph(
    candidateIndexes.map((boundary) => ({ boundary, textLength: 0 }))
  );

  if (insertedAfterParagraph === 1) return candidateIndexes[0] ?? null;
  if (insertedAfterParagraph === 2) return candidateIndexes[1] ?? null;
  if (insertedAfterParagraph === 3) return candidateIndexes[2] ?? null;
  return null;
}

export function splitArticleHtmlForInlineAd(html: string): ArticleInlinePlacement {
  const source = String(html || '');
  const paragraphTagCount = (source.match(/<p\b/gi) || []).length;
  const containsEscapedNewlines = /\\n/.test(source);
  const containsLiteralNewlines = /\n/.test(source);

  if (!source) {
    return {
      beforeHtml: '',
      afterHtml: '',
      insertedAfterParagraph: null,
      paragraphTagCount,
      bodyParagraphCount: 0,
      containsEscapedNewlines,
      containsLiteralNewlines,
    };
  }

  const ignoredAncestors = new Set(['ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th']);
  const tagMatcher = /<\/?([a-z0-9]+)\b[^>]*>/gi;
  const candidates: ParagraphCandidate[] = [];
  const stack: string[] = [];
  let currentParagraphStart: number | null = null;
  let currentParagraphContentStart: number | null = null;
  let match: RegExpExecArray | null = null;

  while ((match = tagMatcher.exec(source))) {
    const rawTag = match[0];
    const tagName = String(match[1] || '').toLowerCase();
    const isClosingTag = rawTag.startsWith('</');
    const isSelfClosingTag = /\/>$/.test(rawTag) || tagName === 'br' || tagName === 'hr' || tagName === 'img';

    if (!isClosingTag) {
      const insideIgnoredAncestor = stack.some((entry) => ignoredAncestors.has(entry));
      if (tagName === 'p' && !insideIgnoredAncestor) {
        currentParagraphStart = match.index;
        currentParagraphContentStart = match.index + rawTag.length;
      }

      if (!isSelfClosingTag) stack.push(tagName);
      continue;
    }

    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index] === tagName) {
        stack.splice(index, 1);
        break;
      }
    }

    if (tagName !== 'p' || currentParagraphStart == null || currentParagraphContentStart == null) continue;

    const innerHtml = source.slice(currentParagraphContentStart, match.index);
    const innerText = innerHtml
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (innerText && !isHeadingOnlyParagraph(innerHtml, innerText)) {
      candidates.push({
        boundary: match.index + rawTag.length,
        textLength: innerText.length,
      });

      if (candidates.length >= 4) break;
    }

    currentParagraphStart = null;
    currentParagraphContentStart = null;
  }

  const insertedAfterParagraph = pickTargetParagraph(candidates);
  const splitIndex = getCandidateBoundary(candidates, insertedAfterParagraph);

  if (splitIndex == null || insertedAfterParagraph == null) {
    return {
      beforeHtml: source,
      afterHtml: '',
      insertedAfterParagraph: null,
      paragraphTagCount,
      bodyParagraphCount: candidates.length,
      containsEscapedNewlines,
      containsLiteralNewlines,
    };
  }

  return {
    beforeHtml: source.slice(0, splitIndex),
    afterHtml: source.slice(splitIndex),
    insertedAfterParagraph,
    paragraphTagCount,
    bodyParagraphCount: candidates.length,
    containsEscapedNewlines,
    containsLiteralNewlines,
  };
}