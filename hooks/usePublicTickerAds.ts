import { useEffect, useMemo, useState } from 'react';

import { subscribePublicDataRefresh } from '../lib/publicDataRefresh';
import type { BroadcastLang } from '../lib/publicBroadcast';
import {
  normalizePublicTickerAds,
  type PublicTickerAd,
  type TickerChannel,
  type PublicTickerAdsPayload,
} from '../lib/publicTickerAds';

type UsePublicTickerAdsOptions = {
  lang: BroadcastLang;
  channel: TickerChannel;
  enabled?: boolean;
  refreshIntervalMs?: number;
};

type UsePublicTickerAdsResult = {
  ads: PublicTickerAd[];
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: number | null;
  refetch: (force?: boolean) => void;
};

type CachedTickerAdsEntry = PublicTickerAdsPayload & {
  fetchedAt: number;
};

const TICKER_ADS_CACHE_TTL_MS = 15_000;
const tickerAdsCache = new Map<string, CachedTickerAdsEntry>();
const inFlightByKey = new Map<string, Promise<CachedTickerAdsEntry>>();

function buildCacheKey(lang: BroadcastLang, channel: TickerChannel): string {
  return `${lang}_${channel}`;
}

function getFreshCacheEntry(cacheKey: string, ttlMs: number): CachedTickerAdsEntry | null {
  const cached = tickerAdsCache.get(cacheKey) || null;
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > ttlMs) return null;
  return cached;
}

async function fetchPublicTickerAds(lang: BroadcastLang, channel: TickerChannel, force = false): Promise<CachedTickerAdsEntry> {
  const cacheKey = buildCacheKey(lang, channel);
  if (!force) {
    const fresh = getFreshCacheEntry(cacheKey, TICKER_ADS_CACHE_TTL_MS);
    if (fresh) return fresh;

    const existingInFlight = inFlightByKey.get(cacheKey);
    if (existingInFlight) return existingInFlight;
  }

  const request = (async () => {
    const endpoint = `/api/public/ticker-ads/active?lang=${encodeURIComponent(lang)}&channel=${encodeURIComponent(channel)}`;

    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      });

      const body = await res.json().catch(() => null);
      const normalized = normalizePublicTickerAds(body, { lang, fallbackChannel: channel });
      const entry: CachedTickerAdsEntry = {
        ...normalized,
        ok: res.ok && normalized.ok,
        fetchedAt: Date.now(),
      };
      tickerAdsCache.set(cacheKey, entry);
      return entry;
    } catch {
      const fallback = getFreshCacheEntry(cacheKey, Number.MAX_SAFE_INTEGER);
      if (fallback) return fallback;

      const entry: CachedTickerAdsEntry = {
        ok: false,
        enabled: true,
        ads: [],
        fetchedAt: Date.now(),
      };
      tickerAdsCache.set(cacheKey, entry);
      return entry;
    } finally {
      inFlightByKey.delete(cacheKey);
    }
  })();

  inFlightByKey.set(cacheKey, request);
  return request;
}

export function usePublicTickerAds({
  lang,
  channel,
  enabled = true,
  refreshIntervalMs = 15_000,
}: UsePublicTickerAdsOptions): UsePublicTickerAdsResult {
  void refreshIntervalMs;
  const cacheKey = useMemo(() => buildCacheKey(lang, channel), [lang, channel]);
  const initialCache = enabled ? getFreshCacheEntry(cacheKey, TICKER_ADS_CACHE_TTL_MS) : null;

  const [ads, setAds] = useState<PublicTickerAd[]>(initialCache?.enabled ? initialCache.ads : []);
  const [isLoading, setIsLoading] = useState(Boolean(enabled && !initialCache));
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(initialCache?.fetchedAt ?? null);

  useEffect(() => {
    if (!enabled) {
      setAds([]);
      setIsLoading(false);
      setError(null);
      setLastUpdatedAt(null);
      return;
    }

    let cancelled = false;

    const applyEntry = (entry: CachedTickerAdsEntry) => {
      if (cancelled) return;
      setAds(entry.enabled ? entry.ads : []);
      setIsLoading(false);
      setError(entry.ok ? null : 'TICKER_ADS_FETCH_FAILED');
      setLastUpdatedAt(entry.fetchedAt);
    };

    const refreshOnce = (force = false) => {
      if (cancelled) return;
      if (!force) {
        const fresh = getFreshCacheEntry(cacheKey, TICKER_ADS_CACHE_TTL_MS);
        if (fresh) {
          applyEntry(fresh);
          return;
        }
      }

      setIsLoading((prev) => (ads.length ? prev : true));
      void fetchPublicTickerAds(lang, channel, force).then(applyEntry);
    };

    refreshOnce(false);

    const unsubscribe = subscribePublicDataRefresh(() => {
      refreshOnce(true);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [ads.length, cacheKey, channel, enabled, lang]);

  const refetch = (force = true) => {
    if (!enabled) return;
    setIsLoading((prev) => (ads.length ? prev : true));
    void fetchPublicTickerAds(lang, channel, force).then((entry) => {
      setAds(entry.enabled ? entry.ads : []);
      setIsLoading(false);
      setError(entry.ok ? null : 'TICKER_ADS_FETCH_FAILED');
      setLastUpdatedAt(entry.fetchedAt);
    });
  };

  return { ads, isLoading, error, lastUpdatedAt, refetch };
}