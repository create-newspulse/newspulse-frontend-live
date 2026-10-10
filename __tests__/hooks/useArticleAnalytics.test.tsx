import React from 'react';
import { renderHook, act, cleanup } from '@testing-library/react';

import { useArticleAnalytics } from '../../hooks/useArticleAnalytics';
import {
  clearAnalyticsMemory,
  DEFAULT_INACTIVITY_WINDOW_MS,
  getOrCreateSessionId,
  getOrCreateVisitorId,
  postAnalyticsEvent,
  shouldTrackClientAnalytics,
  type ArticleAnalyticsLang,
} from '../../lib/analytics/articleAnalytics';
import { CookieConsentProvider, useCookieConsent } from '../../src/consent/CookieConsentProvider';
import { COOKIE_CONSENT_NAME, createConsentRecord, writeConsentCookie } from '../../src/consent/cookieConsent';
import { LanguageProvider } from '../../src/i18n/LanguageProvider';

const mockRouteHandlers = new Map<string, Set<() => void>>();
const mockRouter = {
  isReady: true,
  query: {} as Record<string, string>,
  isPreview: false,
  events: {
    on(event: string, handler: () => void) {
      const handlers = mockRouteHandlers.get(event) || new Set<() => void>();
      handlers.add(handler);
      mockRouteHandlers.set(event, handlers);
    },
    off(event: string, handler: () => void) {
      mockRouteHandlers.get(event)?.delete(handler);
    },
  },
};

jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('next/script', () => function MockScript() { return null; });

function ConsentWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider initialLang="en">
      <CookieConsentProvider>{children}</CookieConsentProvider>
    </LanguageProvider>
  );
}

function articleArgs(id = 'public-news-a', lang: ArticleAnalyticsLang = 'en') {
  return { article: { _id: id, category: 'business', language: lang }, slug: id, lang };
}

function capturedEvents(event?: string): Array<{ url: string; payload: Record<string, unknown> }> {
  return jest.mocked(global.fetch).mock.calls.flatMap(([input, init]) => {
    const url = String(input);
    if (!url.startsWith('/api/analytics/') || (event && url !== `/api/analytics/${event}`)) return [];
    if (typeof init?.body !== 'string') throw new Error('Expected a flat JSON analytics request');
    return [{ url, payload: JSON.parse(init.body) as Record<string, unknown> }];
  });
}

async function advance(ms: number) {
  await act(async () => { jest.advanceTimersByTime(ms); });
}

function scroll(y: number) {
  window.scrollY = y;
  act(() => { window.dispatchEvent(new Event('scroll')); });
}

function emitRoute(event: string) {
  act(() => { mockRouteHandlers.get(event)?.forEach((handler) => handler()); });
}

function setVisibility(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true });
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}

type BeaconCall = { url: string; payload: any };

async function readBlobText(blob: Blob): Promise<string> {
  if (typeof (blob as any).text === 'function') return (blob as any).text();

  if (typeof Response === 'function') {
    try {
      return await new Response(blob).text();
    } catch {
      // fall through to FileReader for older jsdom implementations
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read Blob'));
    reader.readAsText(blob);
  });
}

async function readBeaconCalls(sendBeaconMock: jest.Mock): Promise<BeaconCall[]> {
  const out: BeaconCall[] = [];
  for (const call of sendBeaconMock.mock.calls) {
    const url = String(call[0] || '');
    const blob = call[1] as any;

    let payload: any = null;
    try {
      if (blob && typeof blob.text === 'function') {
        const text = await readBlobText(blob);
        payload = JSON.parse(text);
      } else if (typeof Blob === 'function' && blob instanceof Blob) {
        const text = await readBlobText(blob);
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
    clearAnalyticsMemory();
    window.localStorage.clear();
    window.sessionStorage.clear();
    document.cookie = 'np_vid=; Path=/; Max-Age=0';
    mockRouteHandlers.clear();
    mockRouter.isReady = true;
    mockRouter.isPreview = false;
    mockRouter.query = {};
    window.history.replaceState({}, '', '/news/public-news-a');
    window.scrollTo = jest.fn();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    Object.defineProperty(window, 'requestIdleCallback', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(window, 'cancelIdleCallback', { value: undefined, writable: true, configurable: true });

    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    // Ensure sendBeacon exists and is observable
    (global as any).navigator = (global as any).navigator || {};
    (global as any).navigator.sendBeacon = jest.fn(() => true);

    // Stable viewport + scroll metrics
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 4000, configurable: true });

    // Reset scrollY to be writable
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });

    writeConsentCookie(createConsentRecord('custom', { preferences: false, analytics: true, advertising: false, embeddedMedia: false }, new Date()));
  });

  afterEach(() => {
    cleanup();
    document.cookie = `${COOKIE_CONSENT_NAME}=; Path=/; Max-Age=0`;
    document.cookie = 'np_vid=; Path=/; Max-Age=0';
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('fires article-view once per article session', async () => {
    const article = { _id: '507f1f77bcf86cd799439011', category: 'business', language: 'en', status: 'published' } as any;

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

    expect(viewCalls[0].payload.articleId).toBe('507f1f77bcf86cd799439011');
    expect(viewCalls[0].payload.slug).toBe('hello-world');
    expect(viewCalls[0].payload.category).toBe('business');
  });

  it('sends beacon analytics as application/json with a flat body', async () => {
    await postAnalyticsEvent('article-view', {
      articleId: '507f1f77bcf86cd799439011',
      visitorId: 'visitor-1',
      sessionId: 'session-1',
      slug: 'hello-world',
      category: 'business',
    });

    expect((navigator as any).sendBeacon).toHaveBeenCalledTimes(1);
    expect((global as any).fetch).not.toHaveBeenCalled();

    const [url, body] = ((navigator as any).sendBeacon as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/analytics/article-view');
    expect(body).toBeInstanceOf(Blob);
    expect((body as Blob).type).toBe('application/json');

    const payload = JSON.parse(await readBlobText(body as Blob));
    expect(payload).toMatchObject({
      articleId: '507f1f77bcf86cd799439011',
      visitorId: 'visitor-1',
      sessionId: 'session-1',
      slug: 'hello-world',
      category: 'business',
    });
    expect(payload.type).toBeUndefined();
    expect(payload.data).toBeUndefined();
  });

  it('falls back to fetch when sendBeacon refuses the event', async () => {
    (navigator as any).sendBeacon = jest.fn(() => false);

    await postAnalyticsEvent('article-view', {
      articleId: '507f1f77bcf86cd799439011',
      visitorId: 'visitor-1',
      sessionId: 'session-1',
      slug: 'hello-world',
    });

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    const [url, init] = ((global as any).fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/analytics/article-view');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      cache: 'no-store',
    });
    expect(JSON.parse(init.body)).toMatchObject({
      articleId: '507f1f77bcf86cd799439011',
      visitorId: 'visitor-1',
      sessionId: 'session-1',
      slug: 'hello-world',
    });
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
    const milestones = milestoneCalls.map((c) => c.payload?.milestone).sort((a, b) => a - b);

    expect(milestones).toEqual([25, 50, 75, 100]);
    expect(milestoneCalls.every((c) => c.payload?.milestonePct === undefined)).toBe(true);
    expect(milestoneCalls.every((c) => typeof c.payload?.scrollPercent === 'number')).toBe(true);
    expect(milestoneCalls.every((c) => c.payload?.articleId === 'a2')).toBe(true);
    expect(milestoneCalls.every((c) => typeof c.payload?.visitorId === 'string' && c.payload.visitorId.length > 0)).toBe(true);
    expect(milestoneCalls.every((c) => typeof c.payload?.sessionId === 'string' && c.payload.sessionId.length > 0)).toBe(true);
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
    expect(engagedCalls[0].payload.scrollPercent).toBeGreaterThanOrEqual(50);

    const heartbeatCalls = calls.filter((c) => c.url.includes('/api/analytics/article-heartbeat'));
    expect(heartbeatCalls.length).toBeGreaterThanOrEqual(1);
    expect(heartbeatCalls[0].payload.articleId).toBe('a3');
    expect(typeof heartbeatCalls[0].payload.readTimeSec).toBe('number');
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

  it('does not post analytics when analytics consent is withdrawn', async () => {
    document.cookie = `${COOKIE_CONSENT_NAME}=; Path=/; Max-Age=0`;
    writeConsentCookie(createConsentRecord('rejected', { preferences: false, analytics: false, advertising: false, embeddedMedia: false }, new Date()));

    const article = { _id: 'a-denied', category: 'business', language: 'en' } as any;
    renderHook(
      (props: any) => {
        useArticleAnalytics(props);
        return null;
      },
      { initialProps: { article, slug: 'denied', lang: 'en' } }
    );

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    const calls = await readBeaconCalls((navigator as any).sendBeacon);
    expect(calls.filter((c) => c.url.includes('/api/analytics/')).length).toBe(0);
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

  describe('lifecycle reliability', () => {
    beforeEach(() => {
      jest.mocked(navigator.sendBeacon).mockReturnValue(false);
    });

    it.each([
      ['en', '/news/public-news-a'],
      ['hi', '/hi/news/public-news-a'],
      ['gu', '/gu/news/public-news-a'],
    ] as const)('sends incremental heartbeats and cumulative engagement on %s articles', async (lang, path) => {
      window.history.replaceState({}, '', path);
      renderHook(() => useArticleAnalytics(articleArgs('public-news-a', lang)));

      for (let i = 0; i < 3; i += 1) {
        await advance(15_000);
        act(() => { window.dispatchEvent(new Event('mousemove')); });
      }
      scroll(1000);
      await advance(1100);

      expect(capturedEvents('article-heartbeat').map(({ payload }) => payload.readTimeSec)).toEqual([15, 15, 15]);
      expect(capturedEvents('engaged-read').map(({ payload }) => ({
        readTimeSec: payload.readTimeSec, scrollPercent: payload.scrollPercent,
      }))).toEqual([{ readTimeSec: 45, scrollPercent: 50 }]);
      expect(capturedEvents('article-view')).toHaveLength(1);
      for (const { payload } of capturedEvents()) {
        expect(payload).toMatchObject({
          articleId: 'public-news-a', slug: 'public-news-a', language: lang,
          url: window.location.href,
          visitorId: expect.any(String), sessionId: expect.any(String),
        });
        expect(payload.visitorId).not.toBe('');
        expect(payload.sessionId).not.toBe('');
        expect(payload.type).toBeUndefined();
        expect(payload.data).toBeUndefined();
      }
    });

    it('snapshots queued A events and pending depth before B replaces the article and DOM', async () => {
      const idleCallbacks: IdleRequestCallback[] = [];
      window.requestIdleCallback = jest.fn((callback: IdleRequestCallback) => idleCallbacks.push(callback));
      window.cancelIdleCallback = jest.fn();
      const startedAt = Date.now();
      const urlA = window.location.href;
      const { rerender } = renderHook((args) => useArticleAnalytics(args), { initialProps: articleArgs() });
      scroll(1000);
      await advance(15_000);
      await advance(4000);
      scroll(3000);
      const staleCallbacks = [...idleCallbacks];

      window.history.replaceState({}, '', '/gu/news/public-news-b');
      window.scrollY = 0;
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 10_000, configurable: true });
      rerender(articleArgs('public-news-b', 'gu'));

      const oldHeartbeats = capturedEvents('article-heartbeat');
      expect(oldHeartbeats.map(({ payload }) => payload.readTimeSec)).toEqual([15, 4]);
      expect(oldHeartbeats[0].payload).toMatchObject({
        articleId: 'public-news-a', language: 'en', slug: 'public-news-a',
        readTimeSec: 15, ts: startedAt + 15_000, url: urlA,
      });
      expect(capturedEvents('engaged-read')[0].payload).toMatchObject({
        articleId: 'public-news-a', language: 'en', slug: 'public-news-a',
        readTimeSec: 15, scrollPercent: 50, ts: startedAt + 15_000, url: urlA,
        visitorId: oldHeartbeats[0].payload.visitorId, sessionId: oldHeartbeats[0].payload.sessionId,
      });
      expect(capturedEvents('scroll-milestone').map(({ payload }) => payload.milestone)).toEqual([25, 50, 75, 100]);
      expect(capturedEvents('scroll-milestone')[3].payload).toMatchObject({
        articleId: 'public-news-a', scrollPercent: 100, url: urlA,
      });

      const count = capturedEvents().length;
      act(() => {
        staleCallbacks.forEach((callback) => callback({ didTimeout: false, timeRemaining: () => 50 }));
      });
      expect(capturedEvents()).toHaveLength(count);
      expect(window.cancelIdleCallback).toHaveBeenCalled();

      act(() => { idleCallbacks.at(-1)?.({ didTimeout: false, timeRemaining: () => 50 }); });
      expect(capturedEvents('article-view')[1].payload).toMatchObject({
        articleId: 'public-news-b', slug: 'public-news-b', language: 'gu', url: window.location.href,
      });
    });

    it.each(['unmount', 'pagehide', 'routeChangeStart', 'visibility'] as const)(
      'finalizes only the unsent delta and pending scroll once on %s',
      async (exit) => {
        const { unmount } = renderHook(() => useArticleAnalytics(articleArgs()));
        await advance(19_000);
        scroll(3000);
        const leave = () => {
          if (exit === 'unmount') unmount();
          else if (exit === 'visibility') setVisibility(true);
          else if (exit === 'routeChangeStart') emitRoute(exit);
          else act(() => { window.dispatchEvent(new Event(exit)); });
        };
        leave();
        leave();
        expect(capturedEvents('article-heartbeat').map(({ payload }) => payload.readTimeSec)).toEqual([15, 4]);
        expect(capturedEvents('scroll-milestone').map(({ payload }) => payload.milestone)).toEqual([25, 50, 75, 100]);
        expect(capturedEvents('engaged-read')[0].payload).toMatchObject({ readTimeSec: 19, scrollPercent: 100 });
        const count = capturedEvents().length;
        await advance(60_000);
        unmount();
        expect(capturedEvents()).toHaveLength(count);
        expect(Array.from(mockRouteHandlers.values()).every((handlers) => handlers.size === 0)).toBe(true);
      }
    );

    it('flushes a short visit without manufacturing engagement or zero-second heartbeats', async () => {
      const { unmount } = renderHook(() => useArticleAnalytics(articleArgs()));
      await advance(9000);
      scroll(3000);
      unmount();
      expect(capturedEvents('article-heartbeat').map(({ payload }) => payload.readTimeSec)).toEqual([9]);
      expect(capturedEvents('scroll-milestone').map(({ payload }) => payload.milestone)).toEqual([25, 50, 75, 100]);
      expect(capturedEvents('engaged-read')).toHaveLength(0);
      expect(capturedEvents('article-view')).toHaveLength(1);
    });

    it.each(['routeChangeError', 'routeChangeComplete', 'pageshow', 'visibility'] as const)(
      'resumes after %s without counting suspended time',
      async (resume) => {
        const { unmount } = renderHook(() => useArticleAnalytics(articleArgs()));
        await advance(9000);
        if (resume === 'visibility') setVisibility(true);
        else if (resume === 'pageshow') act(() => { window.dispatchEvent(new Event('pagehide')); });
        else emitRoute('routeChangeStart');
        await advance(60_000);
        if (resume === 'visibility') setVisibility(false);
        else if (resume === 'pageshow') act(() => { window.dispatchEvent(new Event('pageshow')); });
        else emitRoute(resume);
        await advance(7000);
        unmount();
        expect(capturedEvents('article-heartbeat').reduce((sum, { payload }) => sum + Number(payload.readTimeSec), 0)).toBe(16);
        expect(capturedEvents('article-view')).toHaveLength(1);
      }
    );

    it('uses the existing consent provider to start, stop, cancel queued work, and reinitialize', async () => {
      writeConsentCookie(createConsentRecord('rejected', { analytics: false }, new Date()));
      const { result } = renderHook(() => {
        useArticleAnalytics(articleArgs());
        return useCookieConsent();
      }, { wrapper: ConsentWrapper });
      await advance(20_000);
      expect(capturedEvents()).toHaveLength(0);
      expect(localStorage.getItem('np_visitor_id_v1')).toBeNull();
      expect(sessionStorage.getItem('np_session_id_v1')).toBeNull();

      act(() => { result.current.savePreferences({ analytics: true }); });
      await advance(15_000);
      const oldView = capturedEvents('article-view')[0].payload;
      expect(oldView.visitorId).not.toBe('');
      expect(oldView.sessionId).not.toBe('');
      expect(capturedEvents('article-heartbeat')).toHaveLength(0);
      scroll(3000);
      act(() => { result.current.rejectNonEssential(); });
      const count = capturedEvents().length;
      await advance(120_000);
      scroll(3000);
      act(() => { window.dispatchEvent(new Event('focus')); });
      expect(capturedEvents()).toHaveLength(count);
      expect(localStorage.getItem('np_visitor_id_v1')).toBeNull();
      expect(sessionStorage.getItem('np_session_id_v1')).toBeNull();
      expect(sessionStorage.getItem('np_session_last_activity_v1')).toBeNull();
      expect(getOrCreateVisitorId()).toBe('');
      expect(getOrCreateSessionId().sessionId).toBe('');
      expect(Array.from(mockRouteHandlers.values()).every((handlers) => handlers.size === 0)).toBe(true);

      act(() => { result.current.savePreferences({ analytics: true }); });
      await advance(16_000);
      const views = capturedEvents('article-view');
      expect(views).toHaveLength(2);
      expect(views[1].payload.visitorId).not.toBe(oldView.visitorId);
      expect(views[1].payload.sessionId).not.toBe(oldView.sessionId);
      expect(capturedEvents('article-heartbeat').map(({ payload }) => payload.readTimeSec)).toEqual([15]);
      expect(capturedEvents('article-heartbeat')[0].payload.sessionId).toBe(views[1].payload.sessionId);
      expect(capturedEvents('engaged-read')).toHaveLength(0);
      expect(capturedEvents('scroll-milestone')).toHaveLength(0);
    });

    it.each(['mousemove', 'focus', 'scroll'])('rotates the mounted session before resumed %s activity', async (event) => {
      renderHook(() => useArticleAnalytics(articleArgs()));
      await advance(31 * 60_000);
      const oldView = capturedEvents('article-view')[0].payload;
      expect(capturedEvents('article-heartbeat').map(({ payload }) => payload.readTimeSec)).toEqual([15, 15]);

      act(() => { window.dispatchEvent(new Event(event)); });
      await advance(1100);
      const views = capturedEvents('article-view');
      expect(views).toHaveLength(2);
      expect(views[1].payload.sessionId).not.toBe(oldView.sessionId);
      expect(views[1].payload.visitorId).toBe(oldView.visitorId);
      expect(sessionStorage.getItem('np_session_id_v1')).toBe(views[1].payload.sessionId);
    });

    it('does not let a delayed heartbeat extend an already idle session before activity resumes', async () => {
      renderHook(() => useArticleAnalytics(articleArgs()));
      await advance(1000);
      const oldSession = capturedEvents('article-view')[0].payload.sessionId;
      jest.setSystemTime(Date.now() + 31 * 60_000);
      await advance(15_000);
      act(() => { window.dispatchEvent(new Event('mousemove')); });
      await advance(1000);
      expect(capturedEvents('article-view')).toHaveLength(2);
      expect(capturedEvents('article-view')[1].payload.sessionId).not.toBe(oldSession);
    });

    it.each(['available', 'session-blocked', 'both-blocked'])('keeps one view and stable identity in Strict Mode with storage %s', async (storage) => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      if (storage !== 'available') {
        jest.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('Storage blocked'); });
      }
      if (storage === 'both-blocked') {
        jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Storage blocked'); });
      }
      let setups = 0;
      const { rerender, unmount } = renderHook(() => {
        React.useEffect(() => { setups += 1; }, []);
        useArticleAnalytics(articleArgs());
      }, { reactStrictMode: true });
      expect(setups).toBe(2);
      await advance(2000);
      rerender();
      const view = capturedEvents('article-view')[0].payload;
      expect(view.visitorId).not.toBe('');
      expect(view.sessionId).not.toBe('');
      document.cookie = 'np_vid=; Path=/; Max-Age=0';
      expect(getOrCreateVisitorId()).toBe(view.visitorId);
      expect(getOrCreateSessionId().sessionId).toBe(view.sessionId);
      unmount();
      renderHook(() => useArticleAnalytics(articleArgs()), { reactStrictMode: true });
      await advance(1000);
      expect(capturedEvents('article-view')).toHaveLength(1);
    });

    it('clears shared in-memory fallback on withdrawal even when no article is mounted', () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      jest.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('Storage blocked'); });
      jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Storage blocked'); });
      const oldVisitor = getOrCreateVisitorId();
      const oldSession = getOrCreateSessionId().sessionId;
      const { result } = renderHook(() => useCookieConsent(), { wrapper: ConsentWrapper });
      act(() => { result.current.rejectNonEssential(); });
      expect(result.current.categories.analytics).toBe(false);
      act(() => { result.current.savePreferences({ analytics: true }); });
      expect(getOrCreateVisitorId()).not.toBe(oldVisitor);
      expect(getOrCreateSessionId().sessionId).not.toBe(oldSession);
    });

    it.each([false, true])('preserves the exact greater-than inactivity threshold (storage blocked=%s)', (blocked) => {
      if (blocked) {
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        jest.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('Storage blocked'); });
      }
      const first = getOrCreateSessionId();
      jest.setSystemTime(Date.now() + DEFAULT_INACTIVITY_WINDOW_MS);
      const boundary = getOrCreateSessionId();
      expect(boundary).toEqual({ sessionId: first.sessionId, isNew: false });
      jest.setSystemTime(Date.now() + DEFAULT_INACTIVITY_WINDOW_MS + 1);
      const expired = getOrCreateSessionId();
      expect(expired.isNew).toBe(true);
      expect(expired.sessionId).not.toBe(first.sessionId);
    });

    it('deduplicates a normal remount with storage and retains the language-free view key', async () => {
      const { unmount } = renderHook(() => useArticleAnalytics(articleArgs()));
      await advance(1000);
      const first = capturedEvents('article-view')[0].payload;
      unmount();
      renderHook(() => useArticleAnalytics(articleArgs()));
      await advance(1000);
      expect(capturedEvents('article-view')).toHaveLength(1);
      expect(sessionStorage.getItem(`np_article_session_public-news-a:view:${first.sessionId}`)).toBe('1');
    });

    it('does not postpone heartbeats or duplicate views on equivalent article rerenders', async () => {
      const { rerender } = renderHook((args) => useArticleAnalytics(args), { initialProps: articleArgs() });
      for (let i = 0; i < 15; i += 1) {
        await advance(1000);
        rerender(articleArgs());
      }
      await advance(800);
      expect(capturedEvents('article-view')).toHaveLength(1);
      expect(capturedEvents('article-heartbeat').map(({ payload }) => payload.readTimeSec)).toEqual([15]);
    });

    it('preserves public _id and the existing language-switch view deduplication', async () => {
      const initial = {
        ...articleArgs(),
        article: { ...articleArgs().article, sourceNewsId: 'do-not-substitute', translationGroupId: 'do-not-use' },
      };
      const { rerender } = renderHook((args) => useArticleAnalytics(args), { initialProps: initial });
      await advance(1000);
      rerender({
        ...initial, slug: 'translated-slug', lang: 'gu',
        article: { ...initial.article, language: 'gu' },
      });
      await advance(16_000);
      expect(capturedEvents('article-view')).toHaveLength(1);
      expect(capturedEvents('article-view')[0].payload.articleId).toBe('public-news-a');
      expect(capturedEvents('article-heartbeat').at(-1)?.payload).toMatchObject({
        articleId: 'public-news-a', language: 'gu', slug: 'translated-slug', readTimeSec: 15,
      });
    });

    it('retains article-language precedence over route language', async () => {
      renderHook(() => useArticleAnalytics({ ...articleArgs('public-news-a', 'en'), lang: 'gu' }));
      await advance(1000);
      expect(capturedEvents('article-view')[0].payload.language).toBe('en');
    });

    it.each([
      { status: 'draft' }, { status: 'preview' }, { status: 'unpublished' }, { status: 'deleted' },
      { isDraft: true }, { preview: true }, { unpublished: true }, { isPublished: false }, { published: false },
    ])('does not initialize analytics for excluded publication state %j', async (flags) => {
      const args = articleArgs();
      renderHook(() => useArticleAnalytics({ ...args, article: { ...args.article, ...flags } }));
      await advance(20_000);
      expect(capturedEvents()).toHaveLength(0);
      expect(sessionStorage.getItem('np_session_id_v1')).toBeNull();
    });

    it.each(['not-ready', 'preview', 'draft-query', 'pending-translation'] as const)(
      'retains the %s guard', async (guard) => {
        mockRouter.isReady = guard !== 'not-ready';
        mockRouter.isPreview = guard === 'preview';
        if (guard === 'draft-query') mockRouter.query.draft = '1';
        renderHook(() => useArticleAnalytics({ ...articleArgs(), isPendingTranslation: guard === 'pending-translation' }));
        await advance(20_000);
        expect(capturedEvents()).toHaveLength(0);
      }
    );

    it.each(['/admin', '/admin/analytics', '/api/admin/news', '/dev', '/dev/demo', '/dev-tools'])(
      'retains the excluded path %s', async (path) => {
        window.history.replaceState({}, '', path);
        renderHook(() => useArticleAnalytics(articleArgs()));
        await advance(20_000);
        expect(capturedEvents()).toHaveLength(0);
      }
    );

    it.each(['Googlebot', 'HeadlessChrome', 'crawler'])('retains the %s user-agent exclusion', async (userAgent) => {
      jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
      renderHook(() => useArticleAnalytics(articleArgs()));
      await advance(20_000);
      expect(capturedEvents()).toHaveLength(0);
    });
  });
});
