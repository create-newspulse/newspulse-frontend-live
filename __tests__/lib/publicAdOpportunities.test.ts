import {
  PUBLIC_AD_INQUIRY_FALLBACK,
  PUBLIC_AD_INQUIRY_OPTIONS,
  PUBLIC_AD_OPPORTUNITIES,
  getPublicAdOpportunityLabel,
  getPublicAdOpportunityType,
  isPublicDisplayAdSlot,
  normalizePublicAdInquiryValue,
} from '../../src/lib/publicAdOpportunities';

describe('publicAdOpportunities registry', () => {
  test('keeps the 17 canonical public ad opportunities with types', () => {
    expect(PUBLIC_AD_OPPORTUNITIES).toHaveLength(17);
    expect(PUBLIC_AD_OPPORTUNITIES.map((item) => item.value)).toEqual([
      'HOME_728x90',
      'FOOTER_BANNER_728x90',
      'HOME_LEFT_300x250',
      'HOME_RIGHT_300x250',
      'HOME_LEFT_300x600',
      'HOME_RIGHT_300x600',
      'HOME_BILLBOARD_970x250',
      'LIVE_UPDATE_SPONSOR',
      'BREAKING_SPONSOR',
      'ARTICLE_INLINE',
      'ARTICLE_END',
      'SPONSORED_FEATURE',
      'SPONSORED_ARTICLE',
      'COMBO_CAMPAIGN',
      'BREAKING_TICKER_RED',
      'LIVE_UPDATES_TICKER_BLUE',
      'BREAKING_PAGE_SPONSOR_LINE',
    ]);
  });

  test('marks real display slots separately from inquiry-only opportunities', () => {
    expect(isPublicDisplayAdSlot('FOOTER_BANNER_728x90')).toBe(true);
    expect(isPublicDisplayAdSlot('ARTICLE_END')).toBe(true);
    expect(getPublicAdOpportunityType('LIVE_UPDATE_SPONSOR')).toBe('sponsor-line');
    expect(getPublicAdOpportunityType('SPONSORED_FEATURE')).toBe('package-only');
    expect(getPublicAdOpportunityType('BREAKING_TICKER_RED')).toBe('ticker-channel');
    expect(getPublicAdOpportunityType('BREAKING_PAGE_SPONSOR_LINE')).toBe('inquiry-only');
    expect(isPublicDisplayAdSlot('BREAKING_TICKER_RED')).toBe(false);
  });

  test('keeps inquiry fallback while preserving selected canonical values', () => {
    expect(PUBLIC_AD_INQUIRY_OPTIONS[0]).toBe(PUBLIC_AD_INQUIRY_FALLBACK);
    expect(normalizePublicAdInquiryValue('HOME_RIGHT_300x600')).toBe('HOME_RIGHT_300x600');
    expect(normalizePublicAdInquiryValue('SPONSORED_ARTICLE')).toBe('SPONSORED_ARTICLE');
    expect(normalizePublicAdInquiryValue('UNKNOWN')).toBe('NOT_SURE');
    expect(getPublicAdOpportunityLabel('COMBO_CAMPAIGN')).toBe('Combo Campaign');
  });
});
