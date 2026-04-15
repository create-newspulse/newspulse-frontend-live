function normalizeIsoCandidate(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveStoryDateIso(story: any): string {
  if (!story || typeof story !== 'object') return '';
  return (
    normalizeIsoCandidate(story.publishedAt) ||
    normalizeIsoCandidate(story.createdAt) ||
    normalizeIsoCandidate(story.updatedAt) ||
    ''
  );
}

export function getStoryDateTimeValue(story: any): number {
  const iso = resolveStoryDateIso(story);
  if (!iso) return 0;
  const value = Date.parse(iso);
  return Number.isFinite(value) ? value : 0;
}

export function formatEditorialDateTime(iso?: string | null): string {
  const raw = normalizeIsoCandidate(iso);
  if (!raw) return '';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';

  try {
    const dateLabel = new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(date);

    const timeLabel = new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
      .format(date)
      .replace(/\bam\b/g, 'AM')
      .replace(/\bpm\b/g, 'PM');

    return `${dateLabel} • ${timeLabel}`;
  } catch {
    return raw;
  }
}