export type PublicAdOpportunityType =
  | 'display-slot'
  | 'sponsor-line'
  | 'ticker-channel'
  | 'package-only'
  | 'inquiry-only';

export type PublicAdOpportunity = {
  value: string;
  label: string;
  type: PublicAdOpportunityType;
};

export const PUBLIC_AD_OPPORTUNITIES: PublicAdOpportunity[] = [
  { value: 'HOME_728x90', label: 'Home Banner 728x90', type: 'display-slot' },
  { value: 'FOOTER_BANNER_728x90', label: 'Footer Banner 728x90', type: 'display-slot' },
  { value: 'HOME_LEFT_300x250', label: 'Home Left Rail 300x250', type: 'display-slot' },
  { value: 'HOME_RIGHT_300x250', label: 'Home Right Rail 300x250', type: 'display-slot' },
  { value: 'HOME_LEFT_300x600', label: 'Home Left Rail 300x600 Half Page', type: 'display-slot' },
  { value: 'HOME_RIGHT_300x600', label: 'Home Right Rail 300x600 Half Page', type: 'display-slot' },
  { value: 'HOME_BILLBOARD_970x250', label: 'Home Billboard 970x250 Premium', type: 'display-slot' },
  { value: 'LIVE_UPDATE_SPONSOR', label: 'Live Update Sponsor', type: 'sponsor-line' },
  { value: 'BREAKING_SPONSOR', label: 'Breaking Sponsor', type: 'sponsor-line' },
  { value: 'ARTICLE_INLINE', label: 'Article Inline', type: 'display-slot' },
  { value: 'ARTICLE_END', label: 'Article End', type: 'display-slot' },
  { value: 'SPONSORED_FEATURE', label: 'Sponsored Feature', type: 'package-only' },
  { value: 'SPONSORED_ARTICLE', label: 'Sponsored Article', type: 'package-only' },
  { value: 'COMBO_CAMPAIGN', label: 'Combo Campaign', type: 'package-only' },
  { value: 'BREAKING_TICKER_RED', label: 'Breaking ticker red', type: 'ticker-channel' },
  { value: 'LIVE_UPDATES_TICKER_BLUE', label: 'Live Updates ticker blue', type: 'ticker-channel' },
  { value: 'BREAKING_PAGE_SPONSOR_LINE', label: '/breaking page sponsor line', type: 'inquiry-only' },
];

export const PUBLIC_AD_INQUIRY_FALLBACK: PublicAdOpportunity = {
  value: 'NOT_SURE',
  label: 'Not sure / Need suggestion',
  type: 'inquiry-only',
};

export const PUBLIC_AD_INQUIRY_OPTIONS: PublicAdOpportunity[] = [
  PUBLIC_AD_INQUIRY_FALLBACK,
  ...PUBLIC_AD_OPPORTUNITIES,
];

export function findPublicAdOpportunity(value: string): PublicAdOpportunity | null {
  const normalized = String(value || '').trim();
  return PUBLIC_AD_INQUIRY_OPTIONS.find((option) => option.value === normalized) || null;
}

export function normalizePublicAdInquiryValue(value: string): string {
  return findPublicAdOpportunity(value)?.value || PUBLIC_AD_INQUIRY_FALLBACK.value;
}

export function getPublicAdOpportunityLabel(value: string): string {
  return findPublicAdOpportunity(value)?.label || PUBLIC_AD_INQUIRY_FALLBACK.label;
}

export function getPublicAdOpportunityType(value: string): PublicAdOpportunityType | null {
  return findPublicAdOpportunity(value)?.type || null;
}

export function isPublicDisplayAdSlot(value: string): boolean {
  return getPublicAdOpportunityType(value) === 'display-slot';
}
