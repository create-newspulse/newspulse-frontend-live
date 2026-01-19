import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchPublicBroadcast,
  normalizePublicBroadcast,
  toTickerTexts,
  type BroadcastLang,
  type PublicBroadcast,
} from '../lib/publicBroadcast';

export type PublicBroadcastTickerState = {
  broadcast: PublicBroadcast;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: number | null;
  source: 'poll' | 'sse' | null;
  breakingTexts: string[];
  liveTexts: string[];
  breakingEnabled: boolean | null;
  liveEnabled: boolean | null;
  breakingSpeedSec: number | null;
  liveSpeedSec: number | null;
};

function clampSpeedSec(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(10, n));
}

function fingerprint(b: PublicBroadcast): string {
  // Back-compat wrapper for older call sites.
  return fingerprintWithLang(b, 'en');
}

function fingerprintWithLang(b: PublicBroadcast, lang: BroadcastLang): string {
  // Important: include the *language-specific* derived texts in the fingerprint.
  // Some backends return a stable item id + a translation map that changes per lang.
  // If the fingerprint ignores translations, switching language may appear to “do nothing”.
  const bTexts = toTickerTexts((b.items?.breaking || []) as any, { lang }).slice(0, 50).join('|');
  const lTexts = toTickerTexts((b.items?.live || []) as any, { lang }).slice(0, 50).join('|');
  const s = b.settings || ({} as any);
  const sKey = `${s?.breaking?.enabled}:${s?.breaking?.mode}:${s?.breaking?.speedSec}|${s?.live?.enabled}:${s?.live?.mode}:${s?.live?.speedSec}`;
  return `${lang}#${bTexts}#${lTexts}#${sKey}`;
}

export function usePublicBroadcastTicker(options: {
  lang: BroadcastLang;
  pollMs?: number;
  enableSse?: boolean;
}): PublicBroadcastTickerState {
  const { lang, pollMs = 10_000, enableSse = true } = options;

  const [broadcast, setBroadcast] = useState<PublicBroadcast>(() =>
    normalizePublicBroadcast({
      ok: false,
      _meta: { hasSettings: false },
      settings: {
        breaking: { enabled: true, mode: 'AUTO', speedSec: 18 },
        live: { enabled: true, mode: 'AUTO', speedSec: 24 },
      },
      items: { breaking: [], live: [] },
    })
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [source, setSource] = useState<'poll' | 'sse' | null>(null);

  const inFlightRef = useRef<AbortController | null>(null);
  const fpRef = useRef<string>('');
  const pollTimerRef = useRef<any>(null);
  const sseRef = useRef<EventSource | null>(null);
  const sseFailedRef = useRef(false);
  const focusCooldownRef = useRef<number>(0);

  const applyBroadcast = useCallback(
    (raw: unknown, nextSource: 'poll' | 'sse') => {
      const normalized = normalizePublicBroadcast(raw);
      const fp = fingerprintWithLang(normalized, lang);
      if (fp && fp === fpRef.current) return;
      fpRef.current = fp;
      setBroadcast(normalized);
      setLastUpdatedAt(Date.now());
      setSource(nextSource);
    },
    [lang]
  );

  const refetch = useCallback(
    async (reason?: string) => {
      if (typeof window === 'undefined') return;

      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;

      // Only show loading spinner on the very first fetch.
      setIsLoading((prev) => prev);

      try {
        const res = await fetchPublicBroadcast({ signal: controller.signal, lang });
        if (controller.signal.aborted) return;
        applyBroadcast(res, 'poll');
        setError(null);
        setIsLoading(false);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setError(String(e?.message || reason || 'BROADCAST_FETCH_FAILED'));
        setIsLoading(false);
      }
    },
    [applyBroadcast, lang]
  );

  // Polling + focus/visibility refetch
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      pollTimerRef.current = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        // If SSE is active, avoid double-fetch.
        if (sseRef.current && !sseFailedRef.current) return;
        refetch('poll');
      }, pollMs);
    };

    const onFocusLike = () => {
      const now = Date.now();
      if (now - focusCooldownRef.current < 1000) return;
      focusCooldownRef.current = now;
      if (document.visibilityState !== 'visible') return;
      if (sseRef.current && !sseFailedRef.current) return;
      refetch('focus');
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        onFocusLike();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    refetch('initial');

    window.addEventListener('focus', onFocusLike);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopPolling();
      window.removeEventListener('focus', onFocusLike);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pollMs, refetch]);

  // SSE (Phase 2)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!enableSse) return;
    if (typeof EventSource === 'undefined') return;

    sseFailedRef.current = false;

    const close = () => {
      try {
        sseRef.current?.close();
      } catch {
        // ignore
      }
      sseRef.current = null;
    };

    close();

    const url = `/public/broadcast/stream?lang=${encodeURIComponent(lang)}`;
    const es = new EventSource(url);
    sseRef.current = es;

    es.addEventListener('open', () => {
      setSource('sse');
    });

    es.addEventListener('broadcast_updated', (evt: any) => {
      try {
        const json = JSON.parse(String(evt?.data || 'null'));
        applyBroadcast(json, 'sse');
        setError(null);
        setIsLoading(false);
      } catch {
        // ignore bad event payload
      }
    });

    es.addEventListener('error', () => {
      sseFailedRef.current = true;
      close();
      // Immediate fallback so UI recovers quickly.
      refetch('sse_error');
    });

    return () => {
      close();
    };
  }, [applyBroadcast, enableSse, lang, refetch]);

  const emptyText = useMemo(() => {
    if (lang === 'hi') return 'अभी कोई अपडेट नहीं — जुड़े रहें';
    if (lang === 'gu') return 'હમણાં કોઈ અપડેટ નથી — જોડાયેલા રહો';
    return 'No updates right now — stay tuned';
  }, [lang]);

  const breakingTexts = useMemo(() => {
    const texts = toTickerTexts(broadcast.items.breaking as any, { lang });
    return texts.length ? texts : [emptyText];
  }, [broadcast.items.breaking, emptyText, lang]);

  const liveTexts = useMemo(() => {
    const texts = toTickerTexts(broadcast.items.live as any, { lang });
    return texts.length ? texts : [emptyText];
  }, [broadcast.items.live, emptyText, lang]);

  const hasSettings = broadcast?.meta?.hasSettings === true;
  const breakingEnabled = hasSettings ? broadcast.settings.breaking.enabled === true : null;
  const liveEnabled = hasSettings ? broadcast.settings.live.enabled === true : null;

  const breakingSpeedSec = hasSettings ? clampSpeedSec(broadcast.settings.breaking.speedSec, 18) : null;
  const liveSpeedSec = hasSettings ? clampSpeedSec(broadcast.settings.live.speedSec, 24) : null;

  return {
    broadcast,
    isLoading,
    error,
    lastUpdatedAt,
    source,
    breakingTexts,
    liveTexts,
    breakingEnabled,
    liveEnabled,
    breakingSpeedSec,
    liveSpeedSec,
  };
}
