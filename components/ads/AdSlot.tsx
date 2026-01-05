"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import SpotlightFallback728 from "./SpotlightFallback728";
import { useAdSettings } from "../../hooks/useAdSettings";
import { useLanguage } from "../../src/i18n/language";

export type AdSlotName = "HOME_728x90" | "HOME_RIGHT_300x250";

export type AdSlotProps = {
  slot: AdSlotName;
  className?: string;
  fallback?: React.ReactNode;
};

type PublicAd = {
  id: string | number;
  _id?: string;
  title?: string;
  imageUrl?: string;
  targetUrl?: string;
  isClickable?: boolean;
};

function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").toString().trim();
  return raw.replace(/\/+$/, "");
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

export default function AdSlot({ slot, className = "", fallback }: AdSlotProps) {
  const { slotEnabled } = useAdSettings();
  const isDisabled = slotEnabled?.[slot] === false;

  const [ad, setAd] = useState<PublicAd | null>(null);
  const [loaded, setLoaded] = useState(false);
  const firedImpressionFor = useRef<string | number | null>(null);

  const base = useMemo(() => getApiBase(), []);
  const sizes = useMemo(() => slotSizing(slot), [slot]);

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
        const url = `${base ? `${base}` : ""}/api/public/ads/slot/${encodeURIComponent(slot)}`;
        const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
        const json = await res.json().catch(() => null as any);
        const nextAd = (json && (json.ad ?? null)) ? (json.ad as PublicAd) : pickAd(json);

        if (!mounted) return;
        // Image-only ads supported; click-through is optional.
        if (nextAd?.imageUrl) setAd(nextAd);
        else setAd(null);
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

  // Respect global ON/OFF switch. Return null only after all hooks.
  if (isDisabled) return null;

  if (!ad) {
    // While loading, still show fallback to keep layout stable.
    return <div className={`${sizes.wrap} ${className}`}>{fallback ?? <DefaultFallback slot={slot} />}</div>;
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
