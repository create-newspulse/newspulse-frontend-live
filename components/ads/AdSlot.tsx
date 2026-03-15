"use client";

import React, { useEffect, useRef, useState } from "react";

export type AdSlotName =
  | "HOME_728x90"
  | "HOME_RIGHT_300x250"
  | "ARTICLE_INLINE"
  | "ARTICLE_END"
  | (string & {});

export type AdSlotProps = {
  slot: AdSlotName;
  className?: string;
};

type PublicAd = {
  id?: string | number;
  _id?: string;
  title?: string;
  imageUrl?: string;
  targetUrl?: string;
  isClickable?: boolean;
};

type PublicAdSlotResponse = {
  ok?: boolean;
  enabled?: boolean;
  ad?: PublicAd | null;
  message?: string;
};

function resolveAdImageUrl(ad: any): string {
  if (!ad) return '';
  return String(
    ad.imageUrl ||
      ad.imageURL ||
      ad.image ||
      ad.imageSrc ||
      ad.creativeUrl ||
      ad.creativeURL ||
      ''
  ).trim();
}

function normalizeAd(ad: any): PublicAd | null {
  if (!ad) return null;
  const imageUrl = resolveAdImageUrl(ad);
  if (!imageUrl) return null;
  return {
    ...(ad as PublicAd),
    imageUrl,
  };
}

function pickAd(payload: any): PublicAd | null {
  if (!payload) return null;

  if (Array.isArray(payload)) return (payload[0] as PublicAd) || null;
  if (Array.isArray(payload.ads)) return (payload.ads[0] as PublicAd) || null;
  if (payload.ad) return payload.ad as PublicAd;
  if (payload.data) {
    if (Array.isArray(payload.data)) return (payload.data[0] as PublicAd) || null;
    return payload.data as PublicAd;
  }

  return payload as PublicAd;
}

function AdPlaceholder({ slot }: { slot: AdSlotName }) {
  return (
    <section
      className="not-prose my-6"
      aria-label="Advertisement"
      data-ad-slot={slot}
    >
      <div className="mx-auto w-full max-w-[728px] rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">ADVERTISEMENT</div>
        <a href="/advertise" className="mt-2 inline-block text-sm font-semibold underline text-slate-700">
          Advertise Here
        </a>
      </div>
    </section>
  );
}

export default function AdSlot({
  slot,
  className = "",
}: AdSlotProps) {
  const pollSec = (() => {
    const raw = Number(process.env.NEXT_PUBLIC_PUBLIC_ADS_POLL_SEC || 0);
    return Number.isFinite(raw) && raw > 0 ? Math.min(300, Math.max(5, raw)) : 0;
  })();

  const [ad, setAd] = useState<PublicAd | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const firedImpressionFor = useRef<string | number | null>(null);

  const FALLBACK_CREATIVE_SRC = '/ads/placeholder.png';
  const [creativeSrc, setCreativeSrc] = useState<string>('');

  useEffect(() => {
    const next = String(ad?.imageUrl || '').trim();
    setCreativeSrc(next);
  }, [ad?.imageUrl]);

  const [adsDebug, setAdsDebug] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const v = new URLSearchParams(window.location.search).get('adsDebug');
      setAdsDebug(String(v || '') === '1');
    } catch {
      setAdsDebug(false);
    }
  }, []);

  const fetchAd = React.useCallback(async (signal?: AbortSignal) => {
    const url = `/api/public/ads?slot=${encodeURIComponent(String(slot))}`;

    try {
      setLoadError(null);
      const res = await fetch(url, {
        signal,
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      });
      if (signal?.aborted) return;

      const json = (await res.json().catch(() => null)) as PublicAdSlotResponse | any;
      if (signal?.aborted) return;

      const enabledRaw = json && typeof json === 'object' ? (json as any).enabled : undefined;
      const nextEnabled = enabledRaw === false ? false : true;

      const picked = json && typeof json === 'object' ? ((json as any).ad ?? pickAd(json)) : null;
      const nextAd = normalizeAd(picked);

      setEnabled(nextEnabled);
      setAd(nextAd);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setLoadError(String(err?.message || 'FAILED_TO_FETCH'));
      setEnabled(true);
      setAd(null);
    }
  }, [slot]);

  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    async function run() {
      try {
        await fetchAd(ac.signal);

        if (!mounted) return;
      } catch {
        if (!mounted) return;
        setAd(null);
      } finally {
        if (!mounted) return;
        setLoaded(true);
      }
    }

    run();

    return () => {
      mounted = false;
      ac.abort();
    };
  }, [fetchAd, slot]);

  // Auto-refetch ad creative without a full page reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ac = new AbortController();
    const onMaybeRefresh = () => {
      try {
        if (document.visibilityState && document.visibilityState !== 'visible') return;
      } catch {}
      void fetchAd(ac.signal).catch(() => undefined);
    };

    window.addEventListener('focus', onMaybeRefresh);
    document.addEventListener('visibilitychange', onMaybeRefresh);

    let intervalId: number | null = null;
    if (pollSec) {
      intervalId = window.setInterval(onMaybeRefresh, pollSec * 1000);
    }

    return () => {
      window.removeEventListener('focus', onMaybeRefresh);
      document.removeEventListener('visibilitychange', onMaybeRefresh);
      if (intervalId != null) window.clearInterval(intervalId);
      ac.abort();
    };
  }, [fetchAd, pollSec]);

  useEffect(() => {
    const adId = (ad as any)?.id ?? (ad as any)?._id;
    if (!adId) return;
    if (firedImpressionFor.current === adId) return;

    firedImpressionFor.current = adId;

    const url = `/api/public/ads/${encodeURIComponent(String(adId))}/impression`;

    // best-effort tracking; don't block UI
    try {
      fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
    } catch {
      // ignore
    }
  }, [ad]);

  const onClick = () => {
    const adId = (ad as any)?.id ?? (ad as any)?._id;
    if (!adId) return;

    const url = `/api/public/ads/${encodeURIComponent(String(adId))}/click`;
    try {
      fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
    } catch {
      // ignore
    }
  };

  const isClickable = !!ad?.isClickable && !!ad?.targetUrl;
  const creativeImgStyle: React.CSSProperties = { maxWidth: '100%', height: 'auto', display: 'block' };

  const onCreativeError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const current = String(img.getAttribute('src') || '').trim();
    if (!current) return;
    if (current === FALLBACK_CREATIVE_SRC) return;
    // Swap immediately to avoid a broken icon flash.
    img.src = FALLBACK_CREATIVE_SRC;
    setCreativeSrc(FALLBACK_CREATIVE_SRC);
  };

  if (!enabled) return null;

  const debugText = `adsDebug: slot=${String(slot)} enabled=${String(enabled)} loaded=${String(loaded)} hasAd=${String(
    Boolean(ad?.imageUrl)
  )}${loadError ? ` error=${loadError}` : ''}`;

  const debugLine = adsDebug ? (
    <div className="not-prose mt-2 text-[11px] font-semibold text-slate-500" data-ads-debug>
      {debugText}
    </div>
  ) : null;

  if (!ad) {
    return (
      <div className={className}>
        <AdPlaceholder slot={slot} />
        {debugLine}
      </div>
    );
  }

  const adId = (ad as any)?.id ?? (ad as any)?._id;
  const body = (
    <img
      src={creativeSrc || FALLBACK_CREATIVE_SRC}
      alt={ad.title || 'Advertisement'}
      loading="lazy"
      decoding="async"
      style={creativeImgStyle}
      onError={onCreativeError}
    />
  );

  return (
    <section
      className={`not-prose my-6 ${className}`}
      aria-label="Advertisement"
      data-ad-slot={slot}
      data-ad-id={adId ? String(adId) : undefined}
    >
      <div className="mx-auto w-full max-w-[728px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {isClickable ? (
          <a
            href={ad.targetUrl}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            onClick={onClick}
            className="block w-full"
          >
            {body}
          </a>
        ) : (
          <div className="block w-full">{body}</div>
        )}
      </div>
      {debugLine}
    </section>
  );
}
