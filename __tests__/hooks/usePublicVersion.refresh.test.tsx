import { renderHook, act } from '@testing-library/react';

import { usePublicVersion } from '../../hooks/usePublicVersion';
import { PUBLIC_DATA_REFRESH_EVENT } from '../../lib/publicDataRefresh';
import { fetchPublicVersion } from '../../lib/publicVersion';

jest.mock('../../lib/publicVersion', () => ({
  fetchPublicVersion: jest.fn(),
}));

const mockedFetchPublicVersion = fetchPublicVersion as jest.MockedFunction<typeof fetchPublicVersion>;

const POLL_MS = 15_000;

function backend(version: string) {
  return { ok: true, version, updatedAt: '2026-09-01T00:00:00.000Z', source: 'backend' as const };
}

function fallback(version: string) {
  return { ok: true, version, updatedAt: '2026-01-05T22:02:36.817Z', source: 'fallback' as const };
}

describe('usePublicVersion refresh dispatching', () => {
  let refreshEvents: any[];
  let listener: (event: Event) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    refreshEvents = [];
    listener = (event: Event) => {
      refreshEvents.push((event as CustomEvent).detail);
    };
    window.addEventListener(PUBLIC_DATA_REFRESH_EVENT, listener);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  afterEach(() => {
    window.removeEventListener(PUBLIC_DATA_REFRESH_EVENT, listener);
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  async function advanceOnePoll() {
    await act(async () => {
      jest.advanceTimersByTime(POLL_MS + 1);
    });
  }

  test('an identical version never triggers a refresh', async () => {
    mockedFetchPublicVersion.mockResolvedValue(backend('v-1'));

    renderHook(() => usePublicVersion());
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    await advanceOnePoll();
    await advanceOnePoll();

    expect(refreshEvents).toHaveLength(0);
  });

  test('a genuine backend version change still triggers exactly one refresh', async () => {
    mockedFetchPublicVersion
      .mockResolvedValueOnce(backend('v-1'))
      .mockResolvedValueOnce(backend('v-2'))
      .mockResolvedValue(backend('v-2'));

    renderHook(() => usePublicVersion());
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    await advanceOnePoll();
    await advanceOnePoll();

    expect(refreshEvents).toHaveLength(1);
    expect(refreshEvents[0]).toMatchObject({ version: 'v-2', previousVersion: 'v-1' });
  });

  test('a local fallback version never counts as a new publish', async () => {
    mockedFetchPublicVersion
      .mockResolvedValueOnce(backend('v-1'))
      .mockResolvedValueOnce(fallback('1767650556817'))
      .mockResolvedValue(backend('v-1'));

    renderHook(() => usePublicVersion());
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    await advanceOnePoll();
    await advanceOnePoll();

    expect(refreshEvents).toHaveLength(0);
  });

  test('backend flapping between live and fallback does not cause a refresh storm', async () => {
    mockedFetchPublicVersion.mockImplementation((() => {
      const call = mockedFetchPublicVersion.mock.calls.length;
      return Promise.resolve(call % 2 === 1 ? backend('v-1') : fallback('1767650556817'));
    }) as any);

    renderHook(() => usePublicVersion());
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    for (let i = 0; i < 8; i += 1) {
      await advanceOnePoll();
    }

    expect(mockedFetchPublicVersion.mock.calls.length).toBeGreaterThan(4);
    expect(refreshEvents).toHaveLength(0);
  });

  test('transient request failures never dispatch a refresh', async () => {
    mockedFetchPublicVersion
      .mockResolvedValueOnce(backend('v-1'))
      .mockRejectedValueOnce(new Error('PUBLIC_VERSION_FETCH_FAILED_502'))
      .mockRejectedValueOnce(new Error('PUBLIC_VERSION_FETCH_FAILED_502'))
      .mockResolvedValue(backend('v-1'));

    renderHook(() => usePublicVersion());
    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    await advanceOnePoll();
    await advanceOnePoll();
    await advanceOnePoll();

    expect(refreshEvents).toHaveLength(0);
  });
});
