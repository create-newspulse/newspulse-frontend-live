import sanitizeHtml from 'sanitize-html';

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