import { act, renderHook } from '@testing-library/react';

import { usePublicBroadcastTicker } from '../../hooks/usePublicBroadcastTicker';
import { fetchPublicBroadcast, normalizePublicBroadcast, type PublicBroadcast } from '../../lib/publicBroadcast';
import { dispatchPublicDataRefresh } from '../../lib/publicDataRefresh';

jest.mock('../../lib/publicBroadcast', () => ({
  ...jest.requireActual('../../lib/publicBroadcast'),
  fetchPublicBroadcast: jest.fn(),
}));

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  close = jest.fn();

  constructor(url: string) {
    super();
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  emit(raw: unknown) {
    this.dispatchEvent(new MessageEvent('broadcast_updated', { data: JSON.stringify(raw) }));
  }
}

const originalEventSource = Object.getOwnPropertyDescriptor(global, 'EventSource');
const items = { breaking: [{ text: 'B' }], live: [{ text: 'L' }] };
const contentOnly = () => normalizePublicBroadcast({ ok: true, items });
const explicit = () => normalizePublicBroadcast({
  ok: true,
  settings: { breaking: { enabled: true, speedSec: 18 }, live: { enabled: true, speedSec: 24 } },
  items,
});

beforeEach(() => {
  jest.mocked(fetchPublicBroadcast).mockReset();
  jest.mocked(fetchPublicBroadcast).mockResolvedValue(contentOnly());
  FakeEventSource.instances = [];
  Object.defineProperty(global, 'EventSource', { configurable: true, writable: true, value: FakeEventSource });
});

afterEach(() => {
  jest.useRealTimers();
  if (originalEventSource) Object.defineProperty(global, 'EventSource', originalEventSource);
  else Reflect.deleteProperty(global, 'EventSource');
});

test('keeps unresolved state distinct from a resolved content-only HTTP result', async () => {
  let resolve!: (broadcast: PublicBroadcast) => void;
  jest.mocked(fetchPublicBroadcast).mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result } = renderHook(() => usePublicBroadcastTicker({ lang: 'en', enableSse: false }));
  expect(result.current.isLoading).toBe(true);
  expect(result.current.breakingEnabled).toBeNull();
  expect(result.current.liveSpeedSec).toBeNull();
  await act(async () => { resolve(contentOnly()); });
  expect(result.current.isLoading).toBe(false);
  expect(result.current.broadcast.meta.hasSettings).toBe(false);
  expect(result.current.breakingEnabled).toBeNull();
  expect(result.current.liveEnabled).toBeNull();
  expect(result.current.breakingSpeedSec).toBeNull();
  expect(result.current.liveSpeedSec).toBeNull();
  expect(result.current.breakingTexts).toEqual(['B']);
  expect(result.current.liveTexts).toEqual(['L']);
});

test('accepts config-provenance changes even when texts and normalized values match', async () => {
  const { result } = renderHook(() => usePublicBroadcastTicker({ lang: 'en' }));
  await act(async () => {});
  const stream = FakeEventSource.instances[0];
  expect(stream.url).toBe('/public/broadcast/stream?lang=en');
  expect(result.current.breakingEnabled).toBeNull();
  act(() => stream.emit(explicit()));
  expect(result.current.broadcast.meta.hasSettings).toBe(true);
  expect(result.current.breakingEnabled).toBe(true);
  expect(result.current.breakingSpeedSec).toBe(18);
  expect(result.current.liveSpeedSec).toBe(24);
  const previous = result.current.broadcast;
  act(() => stream.emit(explicit()));
  expect(result.current.broadcast).toBe(previous);
  act(() => stream.emit(contentOnly()));
  expect(result.current.broadcast.meta.hasSettings).toBe(false);
  expect(result.current.breakingEnabled).toBeNull();
  expect(result.current.liveSpeedSec).toBeNull();
});

test('preserves accepted HTTP/SSE arrival ownership, version refresh, and five-second dedupe', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-01T00:00:00Z'));
  jest.mocked(fetchPublicBroadcast).mockResolvedValue(explicit());
  const { result, unmount } = renderHook(() => usePublicBroadcastTicker({ lang: 'en' }));
  await act(async () => {});
  const stream = FakeEventSource.instances[0];
  const updated = {
    settings: { breaking: { enabled: false, speedSec: 30 }, live: { enabled: true, speedSec: 32 } },
    items: { breaking: [{ text: 'SSE Breaking' }], live: [{ text: 'SSE Live' }] },
  };
  act(() => stream.emit(updated));
  expect(result.current.source).toBe('sse');
  expect(result.current.breakingEnabled).toBe(false);
  expect(result.current.liveSpeedSec).toBe(32);
  expect(result.current.liveTexts).toEqual(['SSE Live']);
  act(() => dispatchPublicDataRefresh({ version: 'v2', previousVersion: 'v1', source: 'test' }));
  expect(fetchPublicBroadcast).toHaveBeenCalledTimes(1);
  await act(async () => {
    jest.advanceTimersByTime(5001);
    dispatchPublicDataRefresh({ version: 'v3', previousVersion: 'v2', source: 'test' });
  });
  expect(fetchPublicBroadcast).toHaveBeenCalledTimes(2);
  expect(result.current.source).toBe('poll');
  expect(result.current.breakingEnabled).toBe(true);
  expect(result.current.liveSpeedSec).toBe(24);
  expect(result.current.liveTexts).toEqual(['L']);
  unmount();
  expect(stream.close).toHaveBeenCalledTimes(1);
});

test('SSE failure closes the stream and uses the existing HTTP fallback', async () => {
  jest.useFakeTimers();
  const { result } = renderHook(() => usePublicBroadcastTicker({ lang: 'en' }));
  await act(async () => {});
  const stream = FakeEventSource.instances[0];
  jest.mocked(fetchPublicBroadcast).mockResolvedValue(explicit());
  await act(async () => {
    jest.advanceTimersByTime(5001);
    stream.dispatchEvent(new Event('error'));
  });
  expect(stream.close).toHaveBeenCalledTimes(1);
  expect(fetchPublicBroadcast).toHaveBeenCalledTimes(2);
  expect(result.current.breakingEnabled).toBe(true);
});

test.each(['en', 'hi', 'gu'] as const)('keeps requested-language content and existing mode handling for %s', async (lang) => {
  const broadcast = normalizePublicBroadcast({
    settings: {
      breaking: { enabled: false, mode: 'FORCE_ON', speedSec: 20 },
      live: { enabled: true, mode: 'FORCE_OFF', speedSec: 30 },
    },
    items: {
      breaking: [{ text: 'Fallback', texts: { en: 'EN-B', hi: 'HI-B', gu: 'GU-B' } }],
      live: [{ title: 'Direct Live' }],
    },
  });
  jest.mocked(fetchPublicBroadcast).mockResolvedValue(broadcast);
  const { result } = renderHook(() => usePublicBroadcastTicker({ lang }));
  await act(async () => {});
  expect(fetchPublicBroadcast).toHaveBeenCalledWith(expect.objectContaining({ lang }));
  expect(FakeEventSource.instances[0].url).toBe(`/public/broadcast/stream?lang=${lang}`);
  expect(result.current.breakingTexts).toEqual([`${lang.toUpperCase()}-B`]);
  expect(result.current.liveTexts).toEqual(['Direct Live']);
  expect(result.current.breakingEnabled).toBe(false);
  expect(result.current.liveEnabled).toBe(true);
});

test('preserves empty-text fallback and exposes initial HTTP failure without inventing config', async () => {
  jest.mocked(fetchPublicBroadcast).mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => usePublicBroadcastTicker({ lang: 'en', enableSse: false }));
  await act(async () => {});
  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBe('offline');
  expect(result.current.breakingEnabled).toBeNull();
  expect(result.current.liveEnabled).toBeNull();
  expect(result.current.breakingTexts).toEqual(['No updates right now — stay tuned']);
  expect(result.current.liveTexts).toEqual(['No updates right now — stay tuned']);
});

test('disabled hook does not start HTTP or SSE', () => {
  renderHook(() => usePublicBroadcastTicker({ lang: 'en', enabled: false }));
  expect(fetchPublicBroadcast).not.toHaveBeenCalled();
  expect(FakeEventSource.instances).toHaveLength(0);
});
