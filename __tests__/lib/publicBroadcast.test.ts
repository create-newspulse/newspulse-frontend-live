import { normalizePublicBroadcast, shouldRenderTicker, toTickerTexts } from '../../lib/publicBroadcast';

describe('publicBroadcast', () => {
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

  test('respects mode FORCE_ON/FORCE_OFF and AUTO uses enabled', () => {
    expect(shouldRenderTicker({ enabled: false, mode: 'AUTO', speedSec: 10 })).toBe(false);
    expect(shouldRenderTicker({ enabled: true, mode: 'AUTO', speedSec: 10 })).toBe(true);
    expect(shouldRenderTicker({ enabled: false, mode: 'FORCE_ON', speedSec: 10 })).toBe(true);
    expect(shouldRenderTicker({ enabled: true, mode: 'FORCE_OFF', speedSec: 10 })).toBe(false);
  });
});
