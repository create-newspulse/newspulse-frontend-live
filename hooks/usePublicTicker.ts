import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribePublicDataRefresh } from '../lib/publicDataRefresh';
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

const REFETCH_DEDUPE_MS = 5_000;

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
  void options.pollMs;

  const [items, setItems] = useState<PublicTickerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const inFlightRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const lastFetchStartedAtRef = useRef(0);

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

      const force = reason === 'manual' || reason === 'version';
      const now = Date.now();
      if (inFlightRef.current) return;
      if (!force && now - lastFetchStartedAtRef.current < REFETCH_DEDUPE_MS) return;

      const controller = new AbortController();
      inFlightRef.current = controller;
      lastFetchStartedAtRef.current = now;

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
        })
        .finally(() => {
          if (inFlightRef.current === controller) inFlightRef.current = null;
        });
    },
    [applyItems, enabled, items.length, kind, lang]
  );

  // Initial fetch only; version-change events drive background refreshes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!enabled) return;

    mountedRef.current = true;
    refetch('initial');

    const unsubscribe = subscribePublicDataRefresh(() => {
      refetch('version');
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
      inFlightRef.current?.abort();
    };
  }, [enabled, refetch]);

  return { items, isLoading, error, lastUpdatedAt, refetch };
}
