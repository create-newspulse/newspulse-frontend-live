export type StoryTitleHookParts = {
  highlightedHook: string;
  remainingTitle: string;
};

function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function splitStoryTitleHook(title: unknown): StoryTitleHookParts {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) {
    return { highlightedHook: '', remainingTitle: '' };
  }

  const colonIndex = normalizedTitle.indexOf(':');
  if (colonIndex > 0) {
    return {
      highlightedHook: normalizeText(normalizedTitle.slice(0, colonIndex + 1)),
      remainingTitle: normalizeText(normalizedTitle.slice(colonIndex + 1)),
    };
  }

  const words = normalizedTitle.split(' ').filter(Boolean);
  if (words.length <= 4) {
    return { highlightedHook: normalizedTitle, remainingTitle: '' };
  }

  const hookWordCount = words.length <= 8 ? 4 : words.length <= 12 ? 5 : 6;
  return {
    highlightedHook: words.slice(0, hookWordCount).join(' '),
    remainingTitle: words.slice(hookWordCount).join(' '),
  };
}

export function getStoryTitleHookColor(category: unknown): string {
  const normalizedCategory = normalizeText(category).toLowerCase();
  if (!normalizedCategory) return '#2563EB';

  if (normalizedCategory.includes('breaking') || normalizedCategory.includes('crime')) return '#DC2626';
  if (normalizedCategory.includes('science') || normalizedCategory.includes('technology')) return '#0891B2';
  if (normalizedCategory.includes('international')) return '#7C3AED';
  if (normalizedCategory.includes('world')) return '#0D9488';
  if (normalizedCategory.includes('business')) return '#EA580C';
  if (normalizedCategory.includes('sports')) return '#4F46E5';
  if (normalizedCategory.includes('ipl')) return '#2563EB';
  if (normalizedCategory.includes('lifestyle')) return '#DB2777';
  if (normalizedCategory.includes('glamour')) return '#C026D3';
  if (normalizedCategory.includes('editorial')) return '#14B8A6';
  if (normalizedCategory.includes('viral videos') || normalizedCategory.includes('viral-video') || normalizedCategory.includes('viral')) return '#F97316';
  if (normalizedCategory.includes('national')) return '#2563EB';
  if (normalizedCategory.includes('regional') || normalizedCategory.includes('gujarat')) return '#65A30D';

  return '#2563EB';
}