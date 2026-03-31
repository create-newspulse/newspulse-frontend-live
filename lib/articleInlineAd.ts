export type ArticleInlinePlacement = {
  beforeHtml: string;
  afterHtml: string;
  insertedAfterParagraph: 1 | 3 | null;
  paragraphTagCount: number;
  bodyParagraphCount: number;
  containsEscapedNewlines: boolean;
  containsLiteralNewlines: boolean;
};

type ParagraphCandidate = {
  boundary: number;
  textLength: number;
};

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

function pickTargetParagraph(candidates: ParagraphCandidate[]): 1 | 3 | null {
  // Desired behavior:
  // - Prefer inserting after the 3rd body paragraph.
  // - If the article is short (< 3 body paragraphs), still insert after the 1st paragraph.
  if (candidates.length >= 3) return 3;
  if (candidates.length >= 1) return 1;
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

      if (candidates.length >= 3) break;
    }

    currentParagraphStart = null;
    currentParagraphContentStart = null;
  }

  const insertedAfterParagraph = pickTargetParagraph(candidates);
  const splitIndex = insertedAfterParagraph === 3 ? candidates[2]?.boundary : candidates[0]?.boundary;

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