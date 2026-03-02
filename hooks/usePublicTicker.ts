import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchPublicBroadcast,
  itemToTickerText,
  type BroadcastItem,
  type BroadcastLang,
  type BroadcastType,
} from '../lib/publicBroadcast';

export type PublicTickerKind = Extract<BroadcastType, 'breaking' | 'live'>;

export type PublicTickerItem = {
  id: string;
  text: string;
  timeText: string;
  ts: number | null;
  raw: BroadcastItem;
};

function clampPollMs(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  // Keep parity with broadcast hook: avoid hammering the backend.
  return Math.max(10_000, n);
}

function itemTimestampMs(it: BroadcastItem): number | null {
  const candidates = [it.publishedAt, it.createdAt, it.updatedAt];
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (!s) continue;
    const ms = Date.parse(s);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

function isSameLocalDay(aMs: number, bMs: number): boolean {
  const a = new Date(aMs);
  const b = new Date(bMs);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTimeText(ms: number | null): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function usePublicTicker(options: {
  kind: PublicTickerKind;
  lang: BroadcastLang;
  pollMs?: number;
  enabled?: boolean;
  todayOnly?: boolean;
}): {
  items: PublicTickerItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: number | null;
  refetch: (reason?: string) => void;
} {
  const { kind, lang, enabled = true, todayOnly = false } = options;
  const pollMs = useMemo(() => clampPollMs(options.pollMs, 45_000), [options.pollMs]);

  const [items, setItems] = useState<PublicTickerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const inFlightRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<any>(null);
  const mountedRef = useRef(false);

  const applyItems = useCallback(
    (rawItems: BroadcastItem[]) => {
      const now = Date.now();

      const mapped = (rawItems || [])
        .map((it, idx) => {
          const idRaw = String((it as any)?._id || (it as any)?.id || '').trim();
          const id = idRaw || `${kind}-${idx}`;
          const text = itemToTickerText(it, { lang }) || '';
          const ts = itemTimestampMs(it);
          const timeText = formatTimeText(ts);
          return { id, text, ts, timeText, raw: it } satisfies PublicTickerItem;
        })
        .filter((x) => String(x.text || '').trim().length > 0);

      const filtered = todayOnly
        ? mapped.filter((x) => {
            if (!x.ts) return true;
            return isSameLocalDay(x.ts, now);
          })
        : mapped;

      // Newest first (recommended).
      filtered.sort((a, b) => {
        const ta = a.ts ?? 0;
        const tb = b.ts ?? 0;
        return tb - ta;
      });

      setItems(filtered);
      setLastUpdatedAt(Date.now());
    },
    [kind, lang, todayOnly]
  );

  const refetch = useCallback(
    (reason?: string) => {
      if (typeof window === 'undefined') return;
      if (!enabled) return;

      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;

      // Only show loading state when we have nothing yet.
      setIsLoading((prev) => (items.length ? prev : true));

      fetchPublicBroadcast({ signal: controller.signal, lang })
        .then((b) => {
          if (!mountedRef.current || controller.signal.aborted) return;
          const list = kind === 'breaking' ? (b.items.breaking as BroadcastItem[]) : (b.items.live as BroadcastItem[]);
          applyItems(list || []);
          setError(null);
          setIsLoading(false);
        })
        .catch((e: any) => {
          if (!mountedRef.current || controller.signal.aborted) return;
          setError(String(e?.message || reason || 'TICKER_FETCH_FAILED'));
          setIsLoading(false);
        });
    },
    [applyItems, enabled, items.length, kind, lang]
  );

  // Polling + focus/visibility refetch.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!enabled) return;

    mountedRef.current = true;

    const stop = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const start = () => {
      stop();
      pollTimerRef.current = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        refetch('poll');
      }, pollMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetch('visible');
        start();
      } else {
        stop();
      }
    };

    const onFocus = () => refetch('focus');

    start();
    refetch('initial');

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      stop();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      inFlightRef.current?.abort();
    };
  }, [enabled, pollMs, refetch]);

  return { items, isLoading, error, lastUpdatedAt, refetch };
}
