"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SpotlightFallback728 from "./SpotlightFallback728";
import { useAdSettings } from "../../hooks/useAdSettings";
import { useLanguage } from "../../src/i18n/language";
import { getPublicApiBaseUrl } from "../../lib/publicApiBase";
import { isSafeMode } from "../../utils/safeMode";

export type AdSlotName = "HOME_728x90" | "HOME_RIGHT_300x250" | "ARTICLE_INLINE";

export type AdSlotProps = {
  slot: AdSlotName;
  className?: string;
  fallback?: React.ReactNode;
  hideWhenEmpty?: boolean;
  showAdvertisementLabel?: boolean;
};

type PublicAd = {
  id?: string | number;
  _id?: string;
  title?: string;
  imageUrl?: string;
  targetUrl?: string;
  isClickable?: boolean;
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

function getApiBase(): string {
  return getPublicApiBaseUrl();
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

function slotSizing(slot: AdSlotName) {
  switch (slot) {
    case "ARTICLE_INLINE":
      return {
        wrap: "w-full",
        frame: "mx-auto w-full max-w-[728px]",
        img: "h-auto w-full object-contain",
      };
    case "HOME_RIGHT_300x250":
      return {
        wrap: "w-full",
        frame: "w-full h-[250px]",
        img: "mx-auto w-full max-w-[300px] h-full object-contain",
      };
    case "HOME_728x90":
    default:
      return {
        wrap: "w-full",
        frame: "mx-auto w-full max-w-[728px] min-h-[56px] md:min-h-[72px]",
        img: "w-full h-auto max-h-[90px] object-contain",
      };
  }
}

function DefaultFallback({ slot }: { slot: AdSlotName }) {
  const { t } = useLanguage();

  if (slot === "HOME_728x90") return <SpotlightFallback728 />;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/35 shadow-sm p-4">
      <div className="h-8 flex items-center justify-between">
        <span className="text-[11px] font-extrabold px-2 py-1 rounded-full border border-slate-200 bg-white/80 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
          AD
        </span>

        <Link href="/advertise" className="text-xs font-semibold underline text-slate-700 dark:text-slate-200">
          {t('common.advertiseHere')}
        </Link>
      </div>

      <div className="mt-3 flex items-center justify-center pb-2">
        <div className="w-[300px] max-w-full aspect-[6/5] rounded-2xl border border-dashed border-slate-300/80 dark:border-slate-700 bg-white/40 dark:bg-slate-900/20 flex items-center justify-center text-slate-500 dark:text-slate-400">
          300×250
        </div>
      </div>
    </div>
  );
}

function AdBadge() {
  return (
    <span className="pointer-events-none absolute left-2 top-2 z-10 text-[11px] font-extrabold px-2 py-1 rounded-full border border-slate-200 bg-white/90 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
      AD
    </span>
  );
}

export default function AdSlot({
  slot,
  className = "",
  fallback,
  hideWhenEmpty: hideWhenEmptyProp,
  showAdvertisementLabel: showAdvertisementLabelProp,
}: AdSlotProps) {
  const { slotEnabled } = useAdSettings();
  const slotEnabledValue = slotEnabled?.[slot];
  const isExplicitlyEnabled = slotEnabledValue === true;
  const isDisabled = slotEnabledValue === false;
  const SAFE_MODE = isSafeMode();
  const hideWhenEmpty = hideWhenEmptyProp ?? slot === "ARTICLE_INLINE";
  const showAdvertisementLabel = showAdvertisementLabelProp ?? slot === "ARTICLE_INLINE";

  const pollSec = (() => {
    const raw = Number(process.env.NEXT_PUBLIC_PUBLIC_ADS_POLL_SEC || 0);
    return Number.isFinite(raw) && raw > 0 ? Math.min(300, Math.max(5, raw)) : 0;
  })();

  const [ad, setAd] = useState<PublicAd | null>(null);
  const [loaded, setLoaded] = useState(false);
  const firedImpressionFor = useRef<string | number | null>(null);

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const debugAdsFlag = String(process.env.NEXT_PUBLIC_DEBUG_ADS || '').trim().toLowerCase();
  const debugAdsEnabled = debugAdsFlag === '1' || debugAdsFlag === 'true' || debugAdsFlag === 'yes';

  const isLocalhostDev =
    hasMounted &&
    process.env.NODE_ENV !== 'production' &&
    debugAdsEnabled &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const devDebugText = (() => {
    if (!isLocalhostDev) return null;
    if (slot !== 'ARTICLE_INLINE') return null;

    // IMPORTANT: when placement is OFF, show nothing at all.
    if (!isExplicitlyEnabled) return null;

    if (loaded && !ad) return 'ARTICLE_INLINE: enabled but no ad found';
    return null;
  })();

  const DevDebugLine = devDebugText ? (
    <div className="not-prose mb-2 text-[11px] font-semibold text-slate-500">{devDebugText}</div>
  ) : null;

  const base = useMemo(() => getApiBase(), []);
  const sizes = useMemo(() => slotSizing(slot), [slot]);

  const fetchAd = React.useCallback(
    async (signal?: AbortSignal) => {
      if (isDisabled) return;
      const url = `${base ? `${base}` : ""}/api/public/ads/slot/${encodeURIComponent(slot)}`;
      try {
        const res = await fetch(url, {
          signal,
          cache: "no-store",
          headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
        });

        if (signal?.aborted) return;

        if (!res.ok) {
          setAd(null);
          return;
        }

        const json = await res.json().catch(() => null as any);
        if (signal?.aborted) return;

        const picked = (json && (json.ad ?? null)) ? (json.ad as PublicAd) : pickAd(json);
        const nextAd = normalizeAd(picked);
        // Image-only ads supported; click-through is optional.
        setAd(nextAd);
      } catch (err: any) {
        // Common in dev when ad blockers/CORS/offline interfere. Don't crash the page.
        if (err?.name === "AbortError") return;
        setAd(null);
      }
    },
    [base, slot, isDisabled]
  );

  useEffect(() => {
    // If the slot gets disabled (or settings are still loading), ensure we don't keep stale ads around.
    if (!isDisabled) return;
    setAd(null);
    setLoaded(false);
    firedImpressionFor.current = null;
  }, [isDisabled]);

  useEffect(() => {
    let mounted = true;
    const ac = new AbortController();

    async function run() {
      try {
        if (isDisabled) return;
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
  }, [base, slot, isDisabled]);

  // Auto-refetch ad creative without a full page reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isDisabled) return;
    if (SAFE_MODE) return;

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
  }, [SAFE_MODE, fetchAd, isDisabled, pollSec]);

  useEffect(() => {
    if (isDisabled) return;
    const adId = (ad as any)?.id ?? (ad as any)?._id;
    if (!adId) return;
    if (firedImpressionFor.current === adId) return;

    firedImpressionFor.current = adId;

    const url = `${base}/api/public/ads/${encodeURIComponent(String(adId))}/impression`;

    // best-effort tracking; don't block UI
    try {
      fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
    } catch {
      // ignore
    }
  }, [ad, base, isDisabled]);

  const onClick = () => {
    const adId = (ad as any)?.id ?? (ad as any)?._id;
    if (!adId) return;

    const url = `${base}/api/public/ads/${encodeURIComponent(String(adId))}/click`;
    try {
      fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
    } catch {
      // ignore
    }
  };

  const isClickable = !!ad?.isClickable && !!ad?.targetUrl;

  // Respect global ON/OFF switch. When OFF, render nothing (including no dev debug line).
  if (isDisabled) return null;

  if (!ad) {
    // For inline article placements we must not render placeholders on production.
    if (hideWhenEmpty) {
      if (DevDebugLine) return DevDebugLine;
      return null;
    }

    // While loading (or empty), show fallback to keep layout stable.
    return (
      <>
        {DevDebugLine}
        <div className={`${sizes.wrap} ${className}`}>{fallback ?? <DefaultFallback slot={slot} />}</div>
      </>
    );
  }

  if (showAdvertisementLabel) {
    const adId = (ad as any)?.id ?? (ad as any)?._id;
    return (
      <section className={`not-prose my-8 block md:my-10 ${className}`} aria-label="Advertisement" data-ad-slot={slot} data-ad-id={adId ? String(adId) : undefined}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 shadow-sm md:px-5">
          <div className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
            Advertisement
          </div>
          <div className="mx-auto w-full max-w-[728px] overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            {isClickable ? (
              <a href={ad.targetUrl} target="_blank" rel="sponsored noopener noreferrer" onClick={onClick} className="block w-full cursor-pointer">
                <img src={ad.imageUrl} alt={ad.title || "Advertisement"} className={sizes.img} loading={loaded ? "eager" : "lazy"} />
              </a>
            ) : (
              <div className="block w-full cursor-default">
                <img src={ad.imageUrl} alt={ad.title || "Advertisement"} className={sizes.img} loading={loaded ? "eager" : "lazy"} />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className={`${sizes.wrap} ${className}`}>
      <div className={`${sizes.frame} relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/35 overflow-hidden shadow-sm`}>
        <AdBadge />
        {isClickable ? (
          <a href={ad.targetUrl} target="_blank" rel="noopener noreferrer" onClick={onClick} className="block w-full h-full cursor-pointer">
            <img
              src={ad.imageUrl}
              alt={ad.title || "Advertisement"}
              className={sizes.img}
              loading={loaded ? "eager" : "lazy"}
            />
          </a>
        ) : (
          <div className="block w-full h-full cursor-default">
            <img
              src={ad.imageUrl}
              alt={ad.title || "Advertisement"}
              className={sizes.img}
              loading={loaded ? "eager" : "lazy"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
