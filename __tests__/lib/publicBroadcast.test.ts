import { normalizePublicBroadcast, shouldRenderTicker, toTickerTexts } from '../../lib/publicBroadcast';

describe('publicBroadcast', () => {
  test('normalizes new breaking/live bundle shape (durationSeconds + items)', () => {
    const res = normalizePublicBroadcast({
      ok: true,
      breaking: { enabled: true, durationSeconds: 22, items: [{ text: 'B1' }] },
      live: { enabled: false, durationSeconds: 30, items: [{ text: 'L1' }] },
    });

    expect(res.meta.hasSettings).toBe(true);
    expect(res.settings.breaking.enabled).toBe(true);
    expect(res.settings.breaking.speedSec).toBe(22);
    expect(res.settings.live.enabled).toBe(false);
    expect(res.settings.live.speedSec).toBe(30);
    expect(toTickerTexts(res.items.breaking)).toEqual(['B1']);
    expect(toTickerTexts(res.items.live)).toEqual(['L1']);
  });

  test('normalizes flat items with type into breaking/live lists', () => {
    const res = normalizePublicBroadcast({
      ok: true,
      settings: {
        breaking: { enabled: true, mode: 'AUTO', speedSec: 10 },
        live: { enabled: true, mode: 'AUTO', speedSec: 20 },
      },
      items: [
        { id: '1', type: 'breaking', text: 'B1' },
        { id: '2', type: 'live', text: 'L1' },
        { id: '3', type: 'breaking', title: 'B2' },
      ],
    });

    expect(toTickerTexts(res.items.breaking)).toEqual(['B1', 'B2']);
    expect(toTickerTexts(res.items.live)).toEqual(['L1']);
  });

  test('prefers per-language translations when lang is provided', () => {
    const items = [
      {
        text: 'EN fallback',
        texts: { en: 'English', hi: 'हिन्दी', gu: 'ગુજરાતી' },
      },
    ];

    expect(toTickerTexts(items, { lang: 'hi' })).toEqual(['हिन्दी']);
    expect(toTickerTexts(items, { lang: 'gu' })).toEqual(['ગુજરાતી']);
    expect(toTickerTexts(items, { lang: 'en' })).toEqual(['English']);
  });

  test('exposes meta.hasSettings based on payload', () => {
    const withSettings = normalizePublicBroadcast({
      ok: true,
      settings: { breaking: { enabled: true, mode: 'AUTO', speedSec: 10 }, live: { enabled: true, mode: 'AUTO', speedSec: 20 } },
      items: { breaking: [], live: [] },
    });
    expect(withSettings.meta.hasSettings).toBe(true);

    const withoutSettings = normalizePublicBroadcast({ ok: true, items: { breaking: [], live: [] } });
    expect(withoutSettings.meta.hasSettings).toBe(false);
  });

  test('respects mode FORCE_ON/FORCE_OFF and AUTO uses enabled', () => {
    expect(shouldRenderTicker({ enabled: false, mode: 'AUTO', speedSec: 10 })).toBe(false);
    expect(shouldRenderTicker({ enabled: true, mode: 'AUTO', speedSec: 10 })).toBe(true);
    expect(shouldRenderTicker({ enabled: false, mode: 'FORCE_ON', speedSec: 10 })).toBe(true);
    expect(shouldRenderTicker({ enabled: true, mode: 'FORCE_OFF', speedSec: 10 })).toBe(false);
  });
});
