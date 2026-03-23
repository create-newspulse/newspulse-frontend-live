import React from 'react';
import { renderHook, act } from '@testing-library/react';

import { useArticleAnalytics } from '../../hooks/useArticleAnalytics';
import { shouldTrackClientAnalytics } from '../../lib/analytics/articleAnalytics';

jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: {},
    isPreview: false,
  }),
}));

type BeaconCall = { url: string; payload: any };

async function readBeaconCalls(sendBeaconMock: jest.Mock): Promise<BeaconCall[]> {
  const out: BeaconCall[] = [];
  for (const call of sendBeaconMock.mock.calls) {
    const url = String(call[0] || '');
    const blob = call[1] as any;

    let payload: any = null;
    try {
      if (blob && typeof blob.text === 'function') {
        const text = await blob.text();
        payload = JSON.parse(text);
      } else if (typeof blob === 'string') {
        payload = JSON.parse(blob);
      }
    } catch {
      payload = null;
    }

    out.push({ url, payload });
  }
  return out;
}

describe('useArticleAnalytics', () => {
  beforeEach(() => {
    jest.useFakeTimers();

    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    // Ensure sendBeacon exists and is observable
    (global as any).navigator = (global as any).navigator || {};
    (global as any).navigator.sendBeacon = jest.fn(() => true);

    // Stable viewport + scroll metrics
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 4000, configurable: true });

    // Reset scrollY to be writable
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('fires article-view once per article session', async () => {
    const article = { _id: 'a1', category: 'business', language: 'en' } as any;

    const { rerender } = renderHook(
      (props: any) => {
        useArticleAnalytics(props);
        return null;
      },
      { initialProps: { article, slug: 'hello-world', lang: 'en' } }
    );

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    rerender({ article, slug: 'hello-world', lang: 'en' });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    const calls = await readBeaconCalls((navigator as any).sendBeacon);
    const viewCalls = calls.filter((c) => c.url.includes('/api/analytics/article-view'));
    expect(viewCalls.length).toBe(1);

    expect(viewCalls[0].payload.articleId).toBe('a1');
    expect(viewCalls[0].payload.slug).toBe('hello-world');
    expect(viewCalls[0].payload.category).toBe('business');
  });

  it('fires scroll milestones once each (25/50/75/100)', async () => {
    const article = { _id: 'a2', category: 'national', language: 'en' } as any;

    renderHook(
      (props: any) => {
        useArticleAnalytics(props);
        return null;
      },
      { initialProps: { article, slug: 'x', lang: 'en' } }
    );

    // Let initial view schedule flush
    await act(async () => {
      jest.advanceTimersByTime(1100);
    });

    const setScroll = async (y: number) => {
      (window as any).scrollY = y;
      window.dispatchEvent(new Event('scroll'));
      await act(async () => {
        // 250ms throttle + 800ms idle scheduler
        jest.advanceTimersByTime(1200);
      });
    };

    // Depth formula: (scrollY + innerHeight) / scrollHeight * 100
    await setScroll(0); // 25%
    await setScroll(1000); // 50%
    await setScroll(2000); // 75%
    await setScroll(3000); // 100%

    const calls = await readBeaconCalls((navigator as any).sendBeacon);
    const milestoneCalls = calls.filter((c) => c.url.includes('/api/analytics/scroll-milestone'));
    const milestones = milestoneCalls.map((c) => c.payload?.milestonePct).sort((a, b) => a - b);

    expect(milestones).toEqual([25, 50, 75, 100]);
  });

  it('fires engaged-read only after 15s active AND 50% scroll', async () => {
    const article = { _id: 'a3', category: 'sports', language: 'en' } as any;

    renderHook(
      (props: any) => {
        useArticleAnalytics(props);
        return null;
      },
      { initialProps: { article, slug: 'engaged', lang: 'en' } }
    );

    // Scroll to 50% early.
    (window as any).scrollY = 1000;
    window.dispatchEvent(new Event('scroll'));

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    // First heartbeat at 15s should increment readTime to ~15 and trigger engaged-read.
    await act(async () => {
      jest.advanceTimersByTime(15000);
      // allow non-blocking scheduler
      jest.advanceTimersByTime(1000);
    });

    const calls = await readBeaconCalls((navigator as any).sendBeacon);
    const engagedCalls = calls.filter((c) => c.url.includes('/api/analytics/engaged-read'));

    expect(engagedCalls.length).toBe(1);
    expect(engagedCalls[0].payload.articleId).toBe('a3');
    expect(engagedCalls[0].payload.readTimeSec).toBeGreaterThanOrEqual(15);
    expect(engagedCalls[0].payload.scrollDepthPct).toBeGreaterThanOrEqual(50);
  });

  it('resets correctly when navigating between articles', async () => {
    const a1 = { _id: 'a10', category: 'business', language: 'en' } as any;
    const a2 = { _id: 'a11', category: 'business', language: 'en' } as any;

    const { rerender } = renderHook(
      (props: any) => {
        useArticleAnalytics(props);
        return null;
      },
      { initialProps: { article: a1, slug: 'one', lang: 'en' } }
    );

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    rerender({ article: a2, slug: 'two', lang: 'en' });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    const calls = await readBeaconCalls((navigator as any).sendBeacon);
    const viewCalls = calls.filter((c) => c.url.includes('/api/analytics/article-view'));
    expect(viewCalls.length).toBe(2);
  });

  it('blocks localhost tracking by default (guard)', () => {
    expect(
      shouldTrackClientAnalytics({
        hostname: 'localhost',
        pathname: '/news/nope',
        isPreview: false,
        allowLocalhost: false,
      })
    ).toBe(false);
  });

  it('never throws even if analytics posting fails', async () => {
    (navigator as any).sendBeacon = jest.fn(() => {
      throw new Error('beacon failed');
    });
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('fetch failed'));

    const article = { _id: 'a55', category: 'business', language: 'en' } as any;

    expect(() => {
      renderHook(
        (props: any) => {
          useArticleAnalytics(props);
          return null;
        },
        { initialProps: { article, slug: 'safe', lang: 'en' } }
      );
    }).not.toThrow();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
  });
});
