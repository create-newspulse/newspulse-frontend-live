import { useEffect, useState } from 'react';

import { subscribePublicDataRefresh } from '../lib/publicDataRefresh';

export type PublicAd = {
  id?: string | number;
  _id?: string;
  title?: string;
  name?: string;
  brand?: string;
  brandName?: string;
  sponsor?: string;
  sponsorName?: string;
  advertiser?: string;
  advertiserName?: string;
  imageUrl?: string;
  imageURL?: string;
  image?: string;
  imageSrc?: string;
  creativeUrl?: string;
  creativeURL?: string;
  targetUrl?: string;
  clickUrl?: string;
  url?: string;
  isClickable?: boolean;
  width?: number | string;
  height?: number | string;
  imageWidth?: number | string;
  imageHeight?: number | string;
  creativeWidth?: number | string;
  creativeHeight?: number | string;
};

type PublicAdsResponse = {
  ok?: boolean;
  enabled?: boolean;
  ad?: PublicAd | null;
  ads?: PublicAd[];
  data?: any;
};

type UsePublicAdSlotOptions = {
  slot: string;
  language?: string;
  allowWithoutImage?: boolean;
  refreshIntervalMs?: number;
};

export type UsePublicAdSlotResult = {
  enabled: boolean;
  ad: PublicAd | null;
  isLoading: boolean;
  hasResolved: boolean;
};

type CachedAdSlotEntry = {
  enabled: boolean;
  ad: PublicAd | null;
  fetchedAt: number;
};

const AD_SLOT_CACHE_TTL_MS = 15_000;
const adSlotCache = new Map<string, CachedAdSlotEntry>();
const inFlightByKey = new Map<string, Promise<CachedAdSlotEntry>>();

function normalizeBase(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/?$/, '');
}

function resolveBackendBase(): string {
  return normalizeBase(String(process.env.NEXT_PUBLIC_BACKEND_URL || ''));
}

function normalizeLanguage(raw: unknown): string {
  return String(raw || 'en').toLowerCase().trim() || 'en';
}

function buildCacheKey(slot: string, lang: string): string {
  return `${slot}_${lang}`;
}

function getFreshCacheEntry(cacheKey: string, ttlMs: number): CachedAdSlotEntry | null {
  const cached = adSlotCache.get(cacheKey) || null;
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > ttlMs) return null;
  return cached;
}

function resolveAdImageUrl(ad: any): string {
  if (!ad) return '';
  return String(
    ad.imageUrl || ad.imageURL || ad.image || ad.imageSrc || ad.creativeUrl || ad.creativeURL || ''
  ).trim();
}

function pickAd(payload: any): any {
  if (!payload) return null;
  if (payload.ad) return payload.ad;
  if (Array.isArray(payload.ads)) return payload.ads[0] || null;
  if (Array.isArray(payload)) return payload[0] || null;
  if (payload.data) {
    if (Array.isArray(payload.data)) return payload.data[0] || null;
    return payload.data;
  }
  return payload;
}

function normalizeAd(ad: any, allowWithoutImage: boolean): PublicAd | null {
  if (!ad) return null;
  const imageUrl = resolveAdImageUrl(ad);
  if (!allowWithoutImage && !imageUrl) return null;
  return imageUrl ? { ...(ad as PublicAd), imageUrl } : ({ ...(ad as PublicAd) } as PublicAd);
}

async function fetchPublicAdSlot(slot: string, lang: string, ttlMs: number, force = false): Promise<CachedAdSlotEntry> {
  const cacheKey = buildCacheKey(slot, lang);
  if (!force) {
    const fresh = getFreshCacheEntry(cacheKey, ttlMs);
    if (fresh) return fresh;
  }

  const existingInFlight = inFlightByKey.get(cacheKey);
  if (existingInFlight) return existingInFlight;

  const base = resolveBackendBase();
  const qs = `slot=${encodeURIComponent(slot)}&lang=${encodeURIComponent(lang)}`;
  const backendUrl = base ? `${base}/api/public/ads?${qs}` : '';
  const proxyUrl = `/api/public/ads?${qs}`;

  async function fetchJson(url: string) {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const json = (await res.json().catch(() => null)) as PublicAdsResponse | any;
    return { res, json };
  }

  const request = (async () => {
    try {
      const { json } = backendUrl ? await fetchJson(backendUrl) : await fetchJson(proxyUrl);
      const enabledRaw = json && typeof json === 'object' ? (json as any).enabled : undefined;
      const enabled = enabledRaw === false ? false : true;
      const picked = json && typeof json === 'object' ? ((json as any).ad ?? pickAd(json)) : null;
      const entry: CachedAdSlotEntry = {
        enabled,
        ad: enabled ? ((picked as PublicAd | null) || null) : null,
        fetchedAt: Date.now(),
      };
      adSlotCache.set(cacheKey, entry);
      return entry;
    } catch {
      const fallback = adSlotCache.get(cacheKey) || null;
      if (fallback) return fallback;

      if (!backendUrl) {
        const entry: CachedAdSlotEntry = {
          enabled: true,
          ad: null,
          fetchedAt: Date.now(),
        };
        adSlotCache.set(cacheKey, entry);
        return entry;
      }

      try {
        const { json } = await fetchJson(proxyUrl);
        const enabledRaw = json && typeof json === 'object' ? (json as any).enabled : undefined;
        const enabled = enabledRaw === false ? false : true;
        const picked = json && typeof json === 'object' ? ((json as any).ad ?? pickAd(json)) : null;
        const entry: CachedAdSlotEntry = {
          enabled,
          ad: enabled ? ((picked as PublicAd | null) || null) : null,
          fetchedAt: Date.now(),
        };
        adSlotCache.set(cacheKey, entry);
        return entry;
      } catch {
        const cached = adSlotCache.get(cacheKey) || null;
        if (cached) return cached;

        const entry: CachedAdSlotEntry = {
          enabled: true,
          ad: null,
          fetchedAt: Date.now(),
        };
        adSlotCache.set(cacheKey, entry);
        return entry;
      }
    } finally {
      inFlightByKey.delete(cacheKey);
    }
  })();

  inFlightByKey.set(cacheKey, request);
  return request;
}

export function usePublicAdSlot({
  slot,
  language,
  allowWithoutImage = false,
  refreshIntervalMs = 15_000,
}: UsePublicAdSlotOptions): UsePublicAdSlotResult {
  const normalizedSlot = String(slot || '').trim();
  const normalizedLang = normalizeLanguage(language);
  void refreshIntervalMs;
  const initialCache = normalizedSlot ? getFreshCacheEntry(buildCacheKey(normalizedSlot, normalizedLang), AD_SLOT_CACHE_TTL_MS) : null;
  const initialAd = initialCache ? normalizeAd(initialCache.ad, allowWithoutImage) : null;
  const [enabled, setEnabled] = useState(initialCache ? initialCache.enabled : true);
  const [ad, setAd] = useState<PublicAd | null>(initialCache && initialCache.enabled ? initialAd : null);
  const [isLoading, setIsLoading] = useState(normalizedSlot ? !initialCache : false);
  const [hasResolved, setHasResolved] = useState(normalizedSlot ? Boolean(initialCache) : true);

  useEffect(() => {
    if (!normalizedSlot) {
      setEnabled(true);
      setAd(null);
      setIsLoading(false);
      setHasResolved(true);
      return;
    }

    let cancelled = false;

    const applyEntry = (entry: CachedAdSlotEntry) => {
      if (cancelled) return;
      const nextAd = normalizeAd(entry.ad, allowWithoutImage);
      setEnabled(entry.enabled);
      setAd(entry.enabled ? nextAd : null);
      setHasResolved(true);
      setIsLoading(false);
    };

    const fresh = getFreshCacheEntry(buildCacheKey(normalizedSlot, normalizedLang), AD_SLOT_CACHE_TTL_MS);
    if (fresh) {
      applyEntry(fresh);
    } else {
      setIsLoading(true);
      setHasResolved(false);
      void fetchPublicAdSlot(normalizedSlot, normalizedLang, AD_SLOT_CACHE_TTL_MS).then(applyEntry);
    }

    const refreshOnce = (force = false) => {
      void fetchPublicAdSlot(normalizedSlot, normalizedLang, AD_SLOT_CACHE_TTL_MS, force).then(applyEntry);
    };

    const unsubscribe = subscribePublicDataRefresh(() => {
      refreshOnce(true);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [normalizedSlot, normalizedLang, allowWithoutImage]);

  return { enabled, ad, isLoading, hasResolved };
}