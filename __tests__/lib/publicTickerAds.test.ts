import {
  filterTickerAdsForChannel,
  getTickerMarqueeText,
  mergeTickerItemsWithAds,
  normalizePublicTickerAds,
} from '../../lib/publicTickerAds';

describe('publicTickerAds helpers', () => {
  test('normalizePublicTickerAds resolves text, defaults, and fallback channel', () => {
    const result = normalizePublicTickerAds(
      {
        ok: true,
        data: {
          ads: [
            {
              _id: 'ad-1',
              translations: {
                en: 'English campaign',
                hi: 'हिंदी अभियान',
              },
              clickUrl: 'https://example.com/campaign',
              priority: 'high',
            },
          ],
        },
      },
      { lang: 'hi', fallbackChannel: 'live' }
    );

    expect(result.ok).toBe(true);
    expect(result.enabled).toBe(true);
    expect(result.ads).toEqual([
      expect.objectContaining({
        id: 'ad-1',
        text: 'हिंदी अभियान',
        url: 'https://example.com/campaign',
        channel: 'live',
        frequency: 3,
        priority: 3,
      }),
    ]);
  });

  test('filterTickerAdsForChannel keeps exact and both-channel ads', () => {
    const ads = normalizePublicTickerAds(
      {
        ads: [
          { id: 'breaking-only', text: 'Breaking sponsor', channel: 'breaking' },
          { id: 'both-channels', text: 'Network campaign', channel: 'both' },
          { id: 'live-only', text: 'Live sponsor', channel: 'live' },
        ],
      },
      { lang: 'en', fallbackChannel: 'breaking' }
    ).ads;

    expect(filterTickerAdsForChannel(ads, 'breaking').map((ad) => ad.id)).toEqual(['both-channels', 'breaking-only']);
    expect(filterTickerAdsForChannel(ads, 'live').map((ad) => ad.id)).toEqual(['both-channels', 'live-only']);
  });

  test('mergeTickerItemsWithAds inserts an ad every configured frequency in round-robin order', () => {
    const ads = normalizePublicTickerAds(
      {
        ads: [
          { id: 'ad-a', text: 'Campaign A', channel: 'both', frequency: 3, priority: 5 },
          { id: 'ad-b', text: 'Campaign B', channel: 'breaking', frequency: 2, priority: 2 },
        ],
      },
      { lang: 'en', fallbackChannel: 'breaking' }
    ).ads;

    const merged = mergeTickerItemsWithAds(['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7'], ads, 'breaking');

    expect(merged.map((item) => `${item.kind}:${item.text}`)).toEqual([
      'news:N1',
      'news:N2',
      'news:N3',
      'ad:Campaign A',
      'news:N4',
      'news:N5',
      'ad:Campaign B',
      'news:N6',
      'news:N7',
    ]);

    expect(getTickerMarqueeText(merged)).toContain('🟡 Ad: Campaign A');
  });

  test('mergeTickerItemsWithAds returns ads only when there is no news stream', () => {
    const ads = normalizePublicTickerAds(
      {
        ads: [{ id: 'ad-only', text: 'Standalone campaign', channel: 'live', url: 'https://example.com' }],
      },
      { lang: 'en', fallbackChannel: 'live' }
    ).ads;

    const merged = mergeTickerItemsWithAds([], ads, 'live');

    expect(merged).toEqual([
      expect.objectContaining({
        kind: 'ad',
        text: 'Standalone campaign',
        url: 'https://example.com',
      }),
    ]);
  });
});