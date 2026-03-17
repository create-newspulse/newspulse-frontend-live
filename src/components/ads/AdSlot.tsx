import React from 'react';

import { normalizeSlot } from '../../lib/adSlots';
import { useLanguage } from '../../i18n/language';

type Variant =
  | 'homeBanner'
  | 'banner728x90'
  | 'billboard970x250'
  | 'right300'
  | 'right300x600'
  | 'articleInline'
  | 'articleEnd';

type PublicAd = {
  id?: string | number;
  _id?: string;
  title?: string;
  imageUrl?: string;
  targetUrl?: string;
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

type StrictSlotConfig = {
  w: number;
  h: number;
  maxW: number;
  objectFit: 'contain' | 'cover';
};

type HomepageUnitConfig = {
  w: number;
  h: number;
  maxW: number;
  objectFit: 'contain' | 'cover';
  label: string;
  wrapperClassName: string;
  panelClassName: string;
  mediaClassName: string;
};

const STRICT_SLOT_CONFIG: Record<string, StrictSlotConfig> = {
  HOME_BILLBOARD_970x250: { w: 970, h: 250, maxW: 970, objectFit: 'cover' },
  HOME_RIGHT_300x600: { w: 300, h: 600, maxW: 300, objectFit: 'contain' },
};

const HOMEPAGE_UNIT_CONFIG: Record<string, HomepageUnitConfig> = {
  HOME_728x90: {
    w: 728,
    h: 90,
    maxW: 728,
    objectFit: 'cover',
    label: '728×90',
    wrapperClassName: 'max-w-[728px] xl:max-w-[900px]',
    panelClassName: 'overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm p-0',
    mediaClassName: '',
  },
  HOME_BILLBOARD_970x250: {
    w: 970,
    h: 250,
    maxW: 970,
    objectFit: 'cover',
    label: '970×250',
    wrapperClassName: 'max-w-[970px] xl:max-w-[1200px]',
    panelClassName: 'overflow-hidden rounded-2xl border border-black/10 bg-white shadow-md p-0',
    mediaClassName: '',
  },
};

export type AdSlotProps = {
  slot: string;
  variant?: Variant;
  className?: string;
  renderMode?: 'default' | 'articleDisplay';
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
    case 'HOME_BILLBOARD_970x250':
      return 'billboard970x250';
    case 'FOOTER_BANNER_728x90':
      return 'homeBanner';
    case 'HOME_RIGHT_300x250':
      return 'right300';
    case 'HOME_RIGHT_300x600':
      return 'right300x600';
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

function getStrictSlotConfig(normalizedSlot: string): StrictSlotConfig | null {
  if (!normalizedSlot) return null;
  return STRICT_SLOT_CONFIG[normalizedSlot] || null;
}

function getHomepageUnitConfig(normalizedSlot: string): HomepageUnitConfig | null {
  if (!normalizedSlot) return null;
  return HOMEPAGE_UNIT_CONFIG[normalizedSlot] || null;
}

function HomepageUnitFrame({
  normalizedSlot,
  config,
  children,
}: {
  normalizedSlot: string;
  config: HomepageUnitConfig;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto w-full ${config.wrapperClassName}`} style={{ width: '100%' }} data-ad-slot={normalizedSlot}>
      <div className="mb-1 px-1 text-left">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">Advertisement</span>
      </div>
      <div className={config.panelClassName}>
        <div
          className={`relative w-full overflow-hidden bg-white ${config.mediaClassName}`}
          style={{ aspectRatio: `${config.w} / ${config.h}` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function AdPlaceholder({
  normalizedSlot,
  config,
}: {
  normalizedSlot: string;
  config: HomepageUnitConfig;
}) {
  const { t } = useLanguage();
  const compact = normalizedSlot === 'HOME_728x90';
  const categories = [
    t('categories.breaking') || 'Breaking',
    t('categories.regional') || 'Regional',
    t('categories.national') || 'National',
    t('categories.international') || 'International',
    t('categories.business') || 'Business',
    t('categories.scienceTechnology') || 'Science & Technology',
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <HomepageUnitFrame normalizedSlot={normalizedSlot} config={config}>
      <div
        className={compact
          ? 'flex h-full w-full items-center justify-between gap-3 px-3 sm:px-4'
          : 'flex h-full w-full flex-col justify-between gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-6'}
      >
        <div className="min-w-0 flex items-center gap-3">
          <AdBadge />

          <div className="min-w-0">
            <div className={compact ? 'flex items-baseline gap-2 min-w-0' : 'min-w-0'}>
              <div className={compact ? 'truncate font-extrabold text-slate-900' : 'font-extrabold text-lg text-slate-900'}>
                {t('brand.name') || 'News Pulse'}
              </div>
              <div className={compact ? 'truncate text-xs text-slate-500' : 'mt-1 text-sm text-slate-500'}>
                {t('brand.tagline') || "Your pulse on the world's latest news"}
              </div>
            </div>

            {categories ? (
              <div className={compact ? 'truncate text-[12px] text-slate-600' : 'mt-2 text-sm leading-relaxed text-slate-600'}>
                {categories}
              </div>
            ) : null}
          </div>
        </div>

        <AdvertiseLink>{t('common.advertiseHere') || 'Advertise Here'}</AdvertiseLink>
      </div>
    </HomepageUnitFrame>
  );
}

function HomepageUnitSkeleton({
  normalizedSlot,
  config,
}: {
  normalizedSlot: string;
  config: HomepageUnitConfig;
}) {
  return (
    <HomepageUnitFrame normalizedSlot={normalizedSlot} config={config}>
      <div className="h-full w-full animate-pulse bg-slate-100" />
    </HomepageUnitFrame>
  );
}

function coercePositiveNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function resolveAdDimensions(ad: PublicAd | null | undefined, fallback: { width: number; height: number }) {
  const width =
    coercePositiveNumber(ad?.width) ??
    coercePositiveNumber(ad?.imageWidth) ??
    coercePositiveNumber(ad?.creativeWidth) ??
    fallback.width;
  const height =
    coercePositiveNumber(ad?.height) ??
    coercePositiveNumber(ad?.imageHeight) ??
    coercePositiveNumber(ad?.creativeHeight) ??
    fallback.height;

  return { width, height };
}

function ArticleAdBlock({
  normalizedSlot,
  children,
}: {
  normalizedSlot: string;
  children: React.ReactNode;
}) {
  return (
    <div className="not-prose clear-both mx-auto my-6 w-full max-w-[336px]" data-ad-slot={normalizedSlot}>
      <div className="mb-1 text-left">
        <span className="text-xs uppercase tracking-wide text-slate-500">ADVERTISEMENT</span>
      </div>
      {children}
    </div>
  );
}

function ArticleAdPlaceholder({ normalizedSlot }: { normalizedSlot: string }) {
  return (
    <ArticleAdBlock normalizedSlot={normalizedSlot}>
      <a
        href="/advertise"
        className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        style={{ aspectRatio: '300 / 250' }}
      >
        Advertise Here
      </a>
    </ArticleAdBlock>
  );
}

function BareArticleAdFrame({
  dimensions,
  children,
}: {
  dimensions: { width: number; height: number };
  children: React.ReactNode;
}) {
  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
    >
      {children}
    </div>
  );
}

function BareArticleAdPlaceholder() {
  return (
    <BareArticleAdFrame dimensions={{ width: 300, height: 250 }}>
      <a
        href="/advertise"
        className="flex h-full w-full items-center justify-center px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Advertise Here
      </a>
    </BareArticleAdFrame>
  );
}

function BareArticleAdSkeleton() {
  return (
    <BareArticleAdFrame dimensions={{ width: 300, height: 250 }}>
      <div className="h-full w-full animate-pulse bg-slate-100" />
    </BareArticleAdFrame>
  );
}

function ArticleAdSkeleton({ normalizedSlot }: { normalizedSlot: string }) {
  return (
    <ArticleAdBlock normalizedSlot={normalizedSlot}>
      <div className="w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100 shadow-sm" style={{ aspectRatio: '300 / 250' }} />
    </ArticleAdBlock>
  );
}

function StrictFramedAd({
  normalizedSlot,
  config,
  imageUrl,
  title,
  isClickable,
  targetUrl,
  onCreativeError,
}: {
  normalizedSlot: string;
  config: StrictSlotConfig;
  imageUrl: string;
  title?: string;
  isClickable: boolean;
  targetUrl?: string;
  onCreativeError: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const ratio = `${config.w} / ${config.h}`;
  const img = (
    <img
      src={imageUrl}
      alt={title || 'Advertisement'}
      loading="lazy"
      decoding="async"
      onError={onCreativeError}
      className="absolute inset-0 w-full h-full"
      style={{ objectFit: config.objectFit, objectPosition: 'center' }}
    />
  );

  const inner = isClickable ? (
    <a
      href={String(targetUrl)}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className="absolute inset-0 block"
    >
      {img}
    </a>
  ) : (
    img
  );

  return (
    <div className="mx-auto w-full" style={{ maxWidth: config.maxW }} data-ad-slot={normalizedSlot}>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-2">
        <div className="relative w-full overflow-hidden rounded-xl bg-white" style={{ aspectRatio: ratio }}>
          <div className="absolute top-2 left-2 z-10">
            <AdBadge />
          </div>
          {inner}
        </div>
      </div>
    </div>
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

function Billboard970Placeholder() {
  return (
    <div className="mx-auto w-full max-w-[970px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="relative w-full h-[250px] flex items-center justify-center bg-white">
        <div className="absolute top-3 left-3">
          <AdBadge />
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300/80 bg-white/40 flex items-center justify-center w-[calc(100%-2rem)] h-[calc(100%-2rem)] text-slate-500">
          970×250
        </div>
      </div>
    </div>
  );
}

function Right300x600Placeholder() {
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="relative w-full h-[600px] flex items-center justify-center bg-white">
        <div className="absolute top-3 left-3">
          <AdBadge />
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300/80 bg-white/40 flex items-center justify-center w-[calc(100%-2rem)] h-[calc(100%-2rem)] text-slate-500">
          300×600
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
    case 'billboard970x250':
      return { wrap: 'w-full', reserve: 'min-h-[250px]' };
    case 'right300':
      return { wrap: 'w-full', reserve: 'min-h-[250px]' };
    case 'right300x600':
      return { wrap: 'w-full', reserve: 'min-h-[600px]' };
    case 'articleEnd':
    case 'articleInline':
    default:
      return { wrap: 'w-full', reserve: 'min-h-[90px]' };
  }
}

export default function AdSlot({ slot, variant, className = '', renderMode = 'default' }: AdSlotProps) {
  const { t, language } = useLanguage();

  const normalizedSlot = React.useMemo(() => normalizeSlot(slot), [slot]);
  const effectiveVariant = variant ?? defaultVariantForSlot(normalizedSlot);
  const { reserve } = sizing(effectiveVariant);

  const strictConfig = getStrictSlotConfig(normalizedSlot);
  const homepageUnitConfig = getHomepageUnitConfig(normalizedSlot);

  const [enabled, setEnabled] = React.useState(true);
  const [ad, setAd] = React.useState<PublicAd | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasResolved, setHasResolved] = React.useState(false);

  const [imgError, setImgError] = React.useState(false);
  React.useEffect(() => {
    setImgError(false);
  }, [ad?.imageUrl]);

  React.useEffect(() => {
    if (!normalizedSlot) {
      setEnabled(true);
      setAd(null);
      setIsLoading(false);
      setHasResolved(true);
      return;
    }

    setIsLoading(true);
    setHasResolved(false);

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
      setHasResolved(true);
      setIsLoading(false);
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
          setHasResolved(true);
          setIsLoading(false);
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
          setHasResolved(true);
          setIsLoading(false);
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
  const isArticleVariant = effectiveVariant === 'articleInline' || effectiveVariant === 'articleEnd';
  const isArticleDisplayMode = renderMode === 'articleDisplay' && isArticleVariant;

  if (isArticleDisplayMode && isLoading && !hasResolved) {
    return <div className={`${className} not-prose`}><BareArticleAdSkeleton /></div>;
  }

  if ((effectiveVariant === 'articleInline' || effectiveVariant === 'articleEnd') && isLoading && !hasResolved) {
    return <ArticleAdSkeleton normalizedSlot={normalizedSlot} />;
  }

  if (homepageUnitConfig && isLoading && !hasResolved) {
    return <div className={className}><HomepageUnitSkeleton normalizedSlot={normalizedSlot} config={homepageUnitConfig} /></div>;
  }

  const renderPlaceholder = () => {
    if (homepageUnitConfig) {
      return <AdPlaceholder normalizedSlot={normalizedSlot} config={homepageUnitConfig} />;
    }
    if (effectiveVariant === 'homeBanner') return <HomeBannerPlaceholder />;
    if (effectiveVariant === 'banner728x90') return <FooterBanner728Placeholder />;
    if (effectiveVariant === 'billboard970x250') return <Billboard970Placeholder />;
    if (effectiveVariant === 'right300') return <Right300Placeholder />;
    if (effectiveVariant === 'right300x600') return <Right300x600Placeholder />;
    return <ArticleCompactPlaceholder reserveHeightClass={reserve} />;
  };

  if (!ad || !imageUrl || imgError) {
    if (homepageUnitConfig) {
      return <div className={className}>{renderPlaceholder()}</div>;
    }

    if (isArticleDisplayMode) {
      return <div className={`${className} not-prose`}><BareArticleAdPlaceholder /></div>;
    }

    if (effectiveVariant === 'articleInline' || effectiveVariant === 'articleEnd') {
      return <ArticleAdPlaceholder normalizedSlot={normalizedSlot} />;
    }

    const placeholder = imgError && !homepageUnitConfig && (effectiveVariant === 'homeBanner' || effectiveVariant === 'banner728x90')
      ? <BannerImageBlockedPlaceholder />
      : renderPlaceholder();

    return <div className={className}>{placeholder}</div>;
  }

  const onCreativeError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = 'none';
    setImgError(true);
  };

  if (isArticleDisplayMode) {
    const isClickable = Boolean(ad.isClickable && ad.targetUrl);
    const dimensions = resolveAdDimensions(ad, { width: 300, height: 250 });
    const image = (
      <img
        src={imageUrl}
        alt={ad.title || 'Advertisement'}
        loading="lazy"
        decoding="async"
        sizes="(max-width: 640px) 100vw, 336px"
        onError={onCreativeError}
        className="absolute inset-0 block h-full w-full object-contain"
      />
    );

    return (
      <div className={`${className} not-prose`}>
        <BareArticleAdFrame dimensions={dimensions}>
          {isClickable ? (
            <a
              href={String(ad.targetUrl)}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="relative block h-full w-full"
            >
              {image}
            </a>
          ) : (
            <div className="relative h-full w-full">{image}</div>
          )}
        </BareArticleAdFrame>
      </div>
    );
  }

  if (effectiveVariant === 'articleInline' || effectiveVariant === 'articleEnd') {
    const isClickable = Boolean(ad.isClickable && ad.targetUrl);
    const dimensions = resolveAdDimensions(ad, { width: 300, height: 250 });
    const image = (
      <img
        src={imageUrl}
        alt={ad.title || 'Advertisement'}
        loading="lazy"
        decoding="async"
        sizes="(max-width: 640px) 100vw, 336px"
        onError={onCreativeError}
        className="absolute inset-0 block h-full w-full object-contain"
      />
    );

    return (
      <ArticleAdBlock normalizedSlot={normalizedSlot}>
        <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}>
          {isClickable ? (
            <a
              href={String(ad.targetUrl)}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="relative block h-full w-full"
            >
              {image}
            </a>
          ) : (
            <div className="relative h-full w-full">{image}</div>
          )}
        </div>
      </ArticleAdBlock>
    );
  }

  if (homepageUnitConfig) {
    const isClickable = Boolean(ad.isClickable && ad.targetUrl);
    const image = (
      <img
        src={imageUrl}
        alt={ad.title || 'Advertisement'}
        loading="lazy"
        decoding="async"
        onError={onCreativeError}
        className="absolute inset-0 block h-full w-full"
        style={{ objectFit: homepageUnitConfig.objectFit, objectPosition: 'center' }}
      />
    );

    return (
      <div className={`${className} not-prose`}>
        <HomepageUnitFrame normalizedSlot={normalizedSlot} config={homepageUnitConfig}>
          {isClickable ? (
            <a
              href={String(ad.targetUrl)}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="block h-full w-full"
            >
              {image}
            </a>
          ) : (
            image
          )}
        </HomepageUnitFrame>
      </div>
    );
  }

  if (strictConfig) {
    const isClickable = Boolean(ad.isClickable && ad.targetUrl);
    return (
      <div className={`${className} not-prose`}>
        <StrictFramedAd
          normalizedSlot={normalizedSlot}
          config={strictConfig}
          imageUrl={imageUrl}
          title={ad.title}
          isClickable={isClickable}
          targetUrl={ad.targetUrl}
          onCreativeError={onCreativeError}
        />
      </div>
    );
  }

  const imgClassName = (() => {
    switch (effectiveVariant) {
      case 'right300':
        return 'mx-auto w-full max-w-[300px] h-[250px] object-contain';
      case 'right300x600':
        return 'block w-full h-full object-contain';
      case 'billboard970x250':
        return 'block w-full h-full object-cover';
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

  if (effectiveVariant === 'right300x600') {
    return (
      <div className={`${className} not-prose`} data-ad-slot={normalizedSlot}>
        <div className="mx-auto w-full max-w-[300px]" style={{ maxWidth: 300 }}>
          <div
            className="relative rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden w-full h-[600px]"
            style={{ aspectRatio: '300 / 600' }}
          >
            <div className="absolute top-3 left-3 z-10">
              <AdBadge />
            </div>

            {isClickable ? (
              <a
                href={String(ad.targetUrl)}
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                className="block w-full h-full"
              >
                {body}
              </a>
            ) : (
              <div className="block w-full h-full">{body}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const frameClassName =
    effectiveVariant === 'homeBanner'
      ? 'w-full rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur px-4 py-3 shadow-sm'
      : effectiveVariant === 'billboard970x250'
        ? 'mx-auto w-full max-w-[970px] rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden'
        : effectiveVariant === 'banner728x90'
          ? 'mx-auto w-full max-w-[728px] rounded-2xl border border-slate-200 bg-white overflow-hidden h-[90px]'
          : 'mx-auto w-full max-w-[728px] rounded-2xl border border-slate-200 bg-white p-3';

  const containerClassName =
    effectiveVariant === 'banner728x90'
      ? `${frameClassName} flex items-stretch`
      : effectiveVariant === 'billboard970x250'
        ? `${frameClassName} flex items-stretch h-[250px]`
        : `${frameClassName} ${reserve} flex items-center justify-center`;

  const containerStyle: React.CSSProperties | undefined =
    effectiveVariant === 'banner728x90'
      ? { aspectRatio: '728 / 90' }
      : effectiveVariant === 'billboard970x250'
        ? { aspectRatio: '970 / 250' }
        : undefined;

  const fillClassName =
    effectiveVariant === 'banner728x90' || effectiveVariant === 'billboard970x250'
      ? 'block w-full h-full'
      : 'block w-full';

  return (
    <div className={`${className} not-prose`} data-ad-slot={normalizedSlot}>
      <div className={containerClassName} style={containerStyle}>
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
