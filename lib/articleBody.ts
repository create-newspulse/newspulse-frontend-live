import sanitizeHtml from 'sanitize-html';

const CONTROLLED_INLINE_IMAGE_BLOCK = 'inline-image';
const CONTROLLED_INLINE_IMAGE_MEDIA_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/;
const CONTROLLED_INLINE_IMAGE_DIMENSION_RE = /^[1-9][0-9]{0,4}$/;

export type ControlledArticleInlineImage = {
  src: string;
  mediaId?: string;
  alt?: string;
  caption?: string;
  credit?: string;
  width?: string;
  height?: string;
};

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
  return /<(?:p|div|figure|figcaption|ul|ol|li|blockquote|table|thead|tbody|tr|td|th|h[1-6]|hr)\b/i.test(value);
}

function hasAnyHtml(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value);
}

function normalizeInlineMarkup(value: string): string {
  return String(value || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>');
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseTagAttributes(tagSource: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /\s([A-Za-z][A-Za-z0-9:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null = null;

  while ((match = attrRe.exec(tagSource))) {
    const name = String(match[1] || '').toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[name] = decodeEntities(value).trim();
  }

  return attrs;
}

function normalizeControlledText(value: string): string {
  return stripHtml(value).replace(/\s+/g, ' ').trim().slice(0, 240);
}

function normalizeControlledDimension(value: string): string {
  const normalized = String(value || '').trim();
  return CONTROLLED_INLINE_IMAGE_DIMENSION_RE.test(normalized) ? normalized : '';
}

function isPermittedControlledImageSrc(value: string): boolean {
  const src = String(value || '').trim();
  if (!src || /[\u0000-\u001f\u007f]/.test(src)) return false;
  if (/^\/(?!\/)/.test(src)) return true;

  try {
    return new URL(src).protocol === 'https:';
  } catch {
    return false;
  }
}

function formatPhotoCredit(value: string): string {
  const credit = normalizeControlledText(value);
  if (!credit) return '';
  return /^photo\s*:/i.test(credit) ? credit : `Photo: ${credit}`;
}

function buildControlledInlineImageHtml(attrs: Record<string, string>): string | null {
  if (attrs['data-np-block'] !== CONTROLLED_INLINE_IMAGE_BLOCK) return null;

  const mediaId = String(attrs['data-np-media-id'] || '').trim();
  if (mediaId && !CONTROLLED_INLINE_IMAGE_MEDIA_ID_RE.test(mediaId)) return '';

  const src = String(attrs['data-np-src'] || '').trim();
  if (!isPermittedControlledImageSrc(src)) return '';

  const caption = normalizeControlledText(attrs['data-np-caption'] || '');
  const credit = formatPhotoCredit(attrs['data-np-credit'] || '');
  const alt = normalizeControlledText(attrs['data-np-alt'] || caption || 'News Pulse article image');
  const width = normalizeControlledDimension(attrs['data-np-width'] || '');
  const height = normalizeControlledDimension(attrs['data-np-height'] || '');

  const figureAttrs = [
    'class="np-inline-image"',
    'data-np-block="inline-image"',
    mediaId ? `data-np-media-id="${escapeHtml(mediaId)}"` : '',
  ].filter(Boolean).join(' ');
  const imageAttrs = [
    'class="np-inline-image__media"',
    `src="${escapeHtml(src)}"`,
    `alt="${escapeHtml(alt)}"`,
    width ? `width="${escapeHtml(width)}"` : '',
    height ? `height="${escapeHtml(height)}"` : '',
    'loading="lazy"',
    'decoding="async"',
  ].filter(Boolean).join(' ');
  const captionHtml = caption ? `<span class="np-inline-image__caption-text" data-np-caption="true">${escapeHtml(caption)}</span>` : '';
  const creditHtml = credit ? `<span class="np-inline-image__credit" data-np-credit="true">${escapeHtml(credit)}</span>` : '';
  const figcaptionHtml = captionHtml || creditHtml
    ? `<figcaption class="np-inline-image__caption">${captionHtml}${creditHtml}</figcaption>`
    : '';

  return `<figure ${figureAttrs}><img ${imageAttrs} />${figcaptionHtml}</figure>`;
}

function normalizeControlledInlineImageMarkers(value: string): string {
  return String(value || '').replace(/<(figure|div|span)\b(?=[^>]*data-np-block\s*=\s*(?:"inline-image"|'inline-image'|inline-image))[^>]*(?:\/>|>\s*<\/\1>)/gi, (match) => {
    const html = buildControlledInlineImageHtml(parseTagAttributes(match));
    return html === null ? match : html;
  });
}

export function parseControlledInlineImageBlock(html: string): ControlledArticleInlineImage | null {
  const source = String(html || '').trim();
  const figureMatch = source.match(/^<figure\b([^>]*)>([\s\S]*)<\/figure>$/i);
  if (!figureMatch) return null;

  const figureAttrs = parseTagAttributes(`<figure${figureMatch[1]}>`);
  if (figureAttrs['data-np-block'] !== CONTROLLED_INLINE_IMAGE_BLOCK) return null;

  const imageMatch = String(figureMatch[2] || '').match(/<img\b([^>]*)>/i);
  if (!imageMatch) return null;

  const imageAttrs = parseTagAttributes(`<img${imageMatch[1]}>`);
  const src = String(imageAttrs.src || '').trim();
  if (!isPermittedControlledImageSrc(src)) return null;

  const mediaId = String(figureAttrs['data-np-media-id'] || '').trim();
  if (mediaId && !CONTROLLED_INLINE_IMAGE_MEDIA_ID_RE.test(mediaId)) return null;

  const captionMatch = source.match(/<span\b[^>]*data-np-caption="true"[^>]*>([\s\S]*?)<\/span>/i);
  const creditMatch = source.match(/<span\b[^>]*data-np-credit="true"[^>]*>([\s\S]*?)<\/span>/i);
  const width = normalizeControlledDimension(imageAttrs.width || '');
  const height = normalizeControlledDimension(imageAttrs.height || '');

  return {
    src,
    ...(mediaId ? { mediaId } : {}),
    ...(imageAttrs.alt ? { alt: normalizeControlledText(imageAttrs.alt) } : {}),
    ...(captionMatch ? { caption: normalizeControlledText(captionMatch[1] || '') } : {}),
    ...(creditMatch ? { credit: normalizeControlledText(creditMatch[1] || '') } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
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

export function splitArticleBodyBlocks(html: string): string[] {
  const source = String(html || '').trim();
  if (!source) return [];

  const blocks: string[] = [];
  const re = /<(p|figure)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = re.exec(source))) {
    const before = source.slice(lastIndex, match.index);
    if (before.trim()) blocks.push(before);
    blocks.push(match[0]);
    lastIndex = re.lastIndex;
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
  const markedContent = normalizeControlledInlineImageMarkers(normalized);
  const preSanitized = htmlish && hasBlockHtml(markedContent) ? markedContent : paragraphizeTextContent(markedContent);

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
      'figure',
      'figcaption',
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
      figure: [
        { name: 'class', values: ['np-inline-image'] },
        { name: 'data-np-block', values: ['inline-image'] },
        'data-np-media-id',
      ],
      figcaption: [{ name: 'class', values: ['np-inline-image__caption'] }],
      span: [
        { name: 'class', values: ['np-inline-image__caption-text', 'np-inline-image__credit'] },
        { name: 'data-np-caption', values: ['true'] },
        { name: 'data-np-credit', values: ['true'] },
      ],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', { name: 'class', values: ['np-inline-image__media'] }],
      '*': ['class', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    exclusiveFilter: (frame) => {
      if (frame.tag === 'figure') {
        if (frame.attribs['data-np-block'] !== CONTROLLED_INLINE_IMAGE_BLOCK) return 'excludeTag';
        const mediaId = String(frame.attribs['data-np-media-id'] || '').trim();
        if (mediaId && !CONTROLLED_INLINE_IMAGE_MEDIA_ID_RE.test(mediaId)) return 'excludeTag';
      }
      if (frame.tag === 'figcaption' && frame.attribs.class !== 'np-inline-image__caption') return 'excludeTag';
      return false;
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  });
}