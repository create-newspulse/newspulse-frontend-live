import React from 'react';

import { normalizeSlot } from '../../lib/adSlots';
import { useLanguage } from '../../i18n/language';

type Variant = 'homeBanner' | 'banner728x90' | 'right300' | 'articleInline' | 'articleEnd';

type PublicAd = {
  id?: string | number;
  _id?: string;
  title?: string;
  imageUrl?: string;
  targetUrl?: string;
  isClickable?: boolean;
};

type PublicAdsResponse = {
  ok?: boolean;
  enabled?: boolean;
  ad?: PublicAd | null;
  ads?: PublicAd[];
  data?: any;
};

export type AdSlotProps = {
  slot: string;
  variant?: Variant;
  className?: string;
};

function normalizeBase(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/?$/, '');
}

function resolveBackendBase(): string {
  // Required contract for public ads.
  const configured = normalizeBase(String(process.env.NEXT_PUBLIC_BACKEND_URL || ''));
  return configured;
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

function normalizeAd(ad: any): PublicAd | null {
  if (!ad) return null;
  const imageUrl = resolveAdImageUrl(ad);
  if (!imageUrl) return null;
  return { ...(ad as PublicAd), imageUrl };
}

function defaultVariantForSlot(normalizedSlot: string): Variant {
  switch (normalizedSlot) {
    case 'HOME_728x90':
      return 'homeBanner';
    case 'FOOTER_BANNER_728x90':
      return 'homeBanner';
    case 'HOME_RIGHT_300x250':
      return 'right300';
    case 'ARTICLE_END':
      return 'articleEnd';
    case 'ARTICLE_INLINE':
    default:
      return 'articleInline';
  }
}

function AdBadge() {
  return (
    <span className="text-[11px] font-extrabold px-2 py-1 rounded-full border border-slate-200 bg-white/80 text-slate-700">
      AD
    </span>
  );
}

function AdvertiseLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="/advertise"
      className="shrink-0 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-bold border border-slate-200 bg-white/90 text-slate-900 hover:bg-white"
    >
      {children}
    </a>
  );
}

function HomeBannerPlaceholder() {
  const { t } = useLanguage();

  const chips = [
    t('categories.breaking'),
    t('categories.regional'),
    t('categories.national'),
    t('categories.international'),
    t('categories.business'),
    t('categories.scienceTechnology'),
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur px-4 py-3 shadow-sm">
      <div className="min-h-[56px] md:min-h-[72px] flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <AdBadge />

          <div className="min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <div className="font-extrabold text-slate-900 truncate">{t('brand.name') || 'News Pulse'}</div>
              <div className="text-xs text-slate-500 truncate">{t('brand.tagline') || "Your pulse on the world's latest news"}</div>
            </div>

            {chips ? <div className="text-[12px] text-slate-600 truncate">{chips}</div> : null}
          </div>
        </div>

        <AdvertiseLink>{t('common.advertiseHere') || 'Advertise Here'}</AdvertiseLink>
      </div>
    </div>
  );
}

function BannerImageBlockedPlaceholder() {
  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur px-4 py-3 shadow-sm">
      <div className="min-h-[56px] md:min-h-[72px] flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <AdBadge />

          <div className="min-w-0">
            <div className="font-extrabold text-slate-900 truncate">Image blocked (untrusted domain)</div>
            <div className="text-xs text-slate-600 truncate">Please host/upload the banner image (preferred).</div>
          </div>
        </div>

        <AdvertiseLink>Advertise Here</AdvertiseLink>
      </div>
    </div>
  );
}

function Right300Placeholder() {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AdBadge />
          <div className="font-extrabold text-slate-900">{t('brand.name') || 'News Pulse'}</div>
        </div>
        <a href="/advertise" className="text-xs font-semibold underline text-slate-700">
          {t('common.advertiseHere') || 'Advertise Here'}
        </a>
      </div>

      <div className="p-4">
        <div className="rounded-2xl border border-dashed border-slate-300/80 bg-white/40 flex items-center justify-center mx-auto w-full max-w-[300px] h-[250px] text-slate-500">
          300×250
        </div>
      </div>
    </div>
  );
}

function FooterBanner728Placeholder() {
  return (
    <div className="mx-auto w-full max-w-[728px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden h-[90px] flex items-center justify-between gap-4 px-4">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">ADVERTISEMENT</div>
      <a href="/advertise" className="shrink-0 text-sm font-semibold underline text-slate-700">
        Advertise Here
      </a>
    </div>
  );
}

function ArticleCompactPlaceholder({ reserveHeightClass }: { reserveHeightClass: string }) {
  return (
    <div className={`mx-auto w-full max-w-[728px] rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center ${reserveHeightClass}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-500">ADVERTISEMENT</div>
      <a href="/advertise" className="mt-2 inline-block text-sm font-semibold underline text-slate-700">
        Advertise Here
      </a>
    </div>
  );
}

function sizing(variant: Variant) {
  switch (variant) {
    case 'homeBanner':
      return { wrap: 'w-full', reserve: 'min-h-[72px]' };
    case 'banner728x90':
      return { wrap: 'w-full', reserve: 'min-h-[90px]' };
    case 'right300':
      return { wrap: 'w-full', reserve: 'min-h-[250px]' };
    case 'articleEnd':
    case 'articleInline':
    default:
      return { wrap: 'w-full', reserve: 'min-h-[90px]' };
  }
}

export default function AdSlot({ slot, variant, className = '' }: AdSlotProps) {
  const { t, language } = useLanguage();

  const normalizedSlot = React.useMemo(() => normalizeSlot(slot), [slot]);
  const effectiveVariant = variant ?? defaultVariantForSlot(normalizedSlot);
  const { reserve } = sizing(effectiveVariant);

  const [enabled, setEnabled] = React.useState(true);
  const [ad, setAd] = React.useState<PublicAd | null>(null);

  const [imgError, setImgError] = React.useState(false);
  React.useEffect(() => {
    setImgError(false);
  }, [ad?.imageUrl]);

  React.useEffect(() => {
    if (!normalizedSlot) {
      setEnabled(true);
      setAd(null);
      return;
    }

    const REFRESH_INTERVAL_MS = 10_000;
    const lang = String(language || 'en').toLowerCase();
    const base = resolveBackendBase();
    const qs = `slot=${encodeURIComponent(normalizedSlot)}&lang=${encodeURIComponent(lang)}`;
    const backendUrl = base ? `${base}/api/public/ads?${qs}` : '';
    const proxyUrl = `/api/public/ads?${qs}`;

    let activeController: AbortController | null = null;
    const abortActive = () => {
      if (!activeController) return;
      try {
        activeController.abort();
      } catch {
        // ignore
      }
      activeController = null;
    };

    async function fetchJson(url: string, signal: AbortSignal) {
      const res = await fetch(url, {
        method: 'GET',
        signal,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const json = (await res.json().catch(() => null)) as PublicAdsResponse | any;
      return { res, json };
    }

    const applyPayload = (json: any) => {
      const enabledRaw = json && typeof json === 'object' ? (json as any).enabled : undefined;
      const nextEnabled = enabledRaw === false ? false : true;
      const picked = json && typeof json === 'object' ? ((json as any).ad ?? pickAd(json)) : null;
      const nextAd = normalizeAd(picked);

      setEnabled(nextEnabled);
      setAd(nextEnabled ? nextAd : null);
    };

    async function refreshOnce() {
      abortActive();
      activeController = new AbortController();
      const signal = activeController.signal;

      try {
        const { json } = backendUrl ? await fetchJson(backendUrl, signal) : await fetchJson(proxyUrl, signal);
        if (signal.aborted) return;
        applyPayload(json);
      } catch {
        if (signal.aborted) return;
        // If direct backend fetch failed (CORS/network), retry via same-origin proxy.
        if (!backendUrl) {
          setEnabled(true);
          setAd(null);
          return;
        }

        try {
          const { json } = await fetchJson(proxyUrl, signal);
          if (signal.aborted) return;
          applyPayload(json);
        } catch {
          if (signal.aborted) return;
          setEnabled(true);
          setAd(null);
        }
      }
    }

    // Initial fetch + auto refresh.
    void refreshOnce();
    const intervalId = window.setInterval(() => {
      void refreshOnce();
    }, REFRESH_INTERVAL_MS);

    // Revalidate on focus/visibility.
    const onFocus = () => {
      void refreshOnce();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refreshOnce();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      abortActive();
    };
  }, [normalizedSlot, language]);

  if (!enabled) return null;

  const imageUrl = (ad?.imageUrl || '').trim();

  const renderPlaceholder = () => {
    if (effectiveVariant === 'homeBanner') return <HomeBannerPlaceholder />;
    if (effectiveVariant === 'banner728x90') return <FooterBanner728Placeholder />;
    if (effectiveVariant === 'right300') return <Right300Placeholder />;
    return <ArticleCompactPlaceholder reserveHeightClass={reserve} />;
  };

  if (!ad || !imageUrl || imgError) {
    const placeholder = imgError && (effectiveVariant === 'homeBanner' || effectiveVariant === 'banner728x90')
      ? <BannerImageBlockedPlaceholder />
      : renderPlaceholder();

    return <div className={className}>{placeholder}</div>;
  }

  const onCreativeError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = 'none';
    setImgError(true);
  };

  const imgClassName = (() => {
    switch (effectiveVariant) {
      case 'right300':
        return 'mx-auto w-full max-w-[300px] h-[250px] object-contain';
      case 'homeBanner':
        return 'w-full h-auto max-h-[90px] object-contain';
      case 'banner728x90':
        return 'w-full h-full object-cover block';
      case 'articleEnd':
      case 'articleInline':
      default:
        return 'h-auto w-full object-contain';
    }
  })();

  const body = (
    <img
      src={imageUrl}
      alt={ad.title || 'Advertisement'}
      loading="lazy"
      decoding="async"
      onError={onCreativeError}
      className={imgClassName}
    />
  );

  const isClickable = Boolean(ad.isClickable && ad.targetUrl);

  if (effectiveVariant === 'right300') {
    return (
      <div className={`${className} not-prose`} data-ad-slot={normalizedSlot}>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AdBadge />
              <div className="font-extrabold text-slate-900">{t('brand.name') || 'News Pulse'}</div>
            </div>
            <a href="/advertise" className="text-xs font-semibold underline text-slate-700">
              {t('common.advertiseHere') || 'Advertise Here'}
            </a>
          </div>

          <div className="p-4">
            {isClickable ? (
              <a
                href={String(ad.targetUrl)}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                className="block w-full"
              >
                {body}
              </a>
            ) : (
              <div className="block w-full">{body}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const frameClassName =
    effectiveVariant === 'homeBanner'
      ? 'w-full rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur px-4 py-3 shadow-sm'
      : effectiveVariant === 'banner728x90'
        ? 'mx-auto w-full max-w-[728px] rounded-2xl border border-slate-200 bg-white overflow-hidden h-[90px]'
        : 'mx-auto w-full max-w-[728px] rounded-2xl border border-slate-200 bg-white p-3';

  const containerClassName =
    effectiveVariant === 'banner728x90'
      ? `${frameClassName} flex items-stretch`
      : `${frameClassName} ${reserve} flex items-center justify-center`;

  const fillClassName = effectiveVariant === 'banner728x90' ? 'block w-full h-full' : 'block w-full';

  return (
    <div className={`${className} not-prose`} data-ad-slot={normalizedSlot}>
      <div className={containerClassName}>
        {isClickable ? (
          <a
            href={String(ad.targetUrl)}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            className={fillClassName}
          >
            {body}
          </a>
        ) : (
          <div className={fillClassName}>{body}</div>
        )}
      </div>
    </div>
  );
}
