export const SLOT_ALIAS: Record<string, string> = {
  HOME_RIGHT_RAIL: 'HOME_RIGHT_300x250',
  HOME_RIGHT_300x250: 'HOME_RIGHT_300x250',
  HOME_728x90: 'HOME_728x90',
  FOOTER_BANNER_728x90: 'FOOTER_BANNER_728x90',
  ARTICLE_INLINE: 'ARTICLE_INLINE',
  ARTICLE_END: 'ARTICLE_END',
};

export function normalizeSlot(slot: string): string {
  const key = String(slot || '').trim();
  if (!key) return '';
  return SLOT_ALIAS[key] || key;
}
