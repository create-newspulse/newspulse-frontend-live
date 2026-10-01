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

  test.each([
    { ok: true, items: { breaking: [{ text: 'B1' }], live: [{ text: 'L1' }] } },
    { ok: true, breaking: { items: [{ text: 'B1' }] }, live: { items: [{ text: 'L1' }] } },
    {
      ok: false,
      _meta: { hasSettings: false },
      settings: { breaking: { enabled: true, speedSec: 18 }, live: { enabled: true, speedSec: 24 } },
      items: { breaking: [], live: [] },
    },
  ])('preserves synthesized settings provenance across repeated normalization: %j', (raw) => {
    const first = normalizePublicBroadcast(raw);
    expect(first.meta.hasSettings).toBe(false);
    expect(normalizePublicBroadcast(first)).toEqual(first);
    expect(normalizePublicBroadcast(normalizePublicBroadcast(first))).toEqual(first);
  });

  test.each(['durationSeconds', 'durationSec', 'tickerSpeedSeconds', 'speedSec', 'speedSeconds'])(
    'preserves explicit bundle %s even without enabled fields',
    (field) => {
      const result = normalizePublicBroadcast({
        success: true,
        data: { breaking: { [field]: 20, items: [{ text: 'B' }] }, live: { [field]: 30, items: [{ text: 'L' }] } },
      });
      expect(result.meta.hasSettings).toBe(true);
      expect(result.settings.breaking.speedSec).toBe(20);
      expect(result.settings.live.speedSec).toBe(30);
      expect(normalizePublicBroadcast(result)).toEqual(result);
    }
  );

  test.each(['tickerSpeedSeconds', 'speedSec', 'speedSeconds'])('preserves legacy settings alias %s', (field) => {
    const result = normalizePublicBroadcast({
      settings: { tickers: { breaking: { [field]: 22 }, live: { [field]: 29 } } },
      items: { breaking: [], live: [] },
    });
    expect(result.meta.hasSettings).toBe(true);
    expect(result.settings.breaking.speedSec).toBe(22);
    expect(result.settings.live.speedSec).toBe(29);
    expect(normalizePublicBroadcast(result)).toEqual(result);
  });

  test('preserves explicit false provenance and existing duration alias precedence', () => {
    const raw = {
      breaking: { enabled: true, durationSeconds: 20, durationSec: 21, speedSec: 30, items: [] },
      live: { enabled: true, durationSeconds: 28, durationSec: 29, speedSec: 35, items: [] },
    };
    const explicit = normalizePublicBroadcast(raw);
    expect(explicit.settings.breaking.speedSec).toBe(20);
    expect(explicit.settings.live.speedSec).toBe(28);
    expect(normalizePublicBroadcast({ ...raw, _meta: { hasSettings: false } }).meta.hasSettings).toBe(false);
    expect(normalizePublicBroadcast({ ...explicit, _meta: { hasSettings: false } }).meta.hasSettings).toBe(false);
  });
});
