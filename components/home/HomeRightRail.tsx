import React from 'react';
import Link from 'next/link';
import { ChevronRight, GraduationCap, Play } from 'lucide-react';

import { useYouthPulse } from '../../features/youthPulse/useYouthPulse';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle } from '../../lib/contentFallback';
import { resolveArticleSlug } from '../../lib/articleSlugs';
import { buildNewsUrl } from '../../lib/newsRoutes';
import type { Article } from '../../lib/publicNewsApi';
import { COVER_PLACEHOLDER_SRC, resolveCoverFitMode, resolveCoverImageUrl } from '../../lib/coverImages';
import { debugStoryCard, getStoryId, getStoryReactKey, getStorySlug, getStoryTranslationGroupId } from '../../lib/storyIdentity';
import { formatEditorialDateTime, resolveStoryDateIso } from '../../lib/storyDateTime';
import { getStoryTitleHookColor, splitStoryTitleHook } from '../../lib/storyTitleHook';
import { getPublicViralVideoPosterUrl, normalizePublicViralVideosPayload, resolvePublicViralVideoMediaUrl, type PublicViralVideo } from '../../lib/publicViralVideos';
import OriginalTag from '../OriginalTag';
import NewsPulseVideoPlayer, { getViralVideoUiLabels } from '../viral-videos/NewsPulseVideoPlayer';
import AdSlot from '../../src/components/ads/AdSlot';
import { useI18n } from '../../src/i18n/LanguageProvider';

export type HomeRightRailLang = 'en' | 'hi' | 'gu';

export type HomeRightRailTheme = {
  mode: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  sub: string;
  accent: string;
  accent2: string;
};

export const DEFAULT_HOME_RIGHT_RAIL_THEME: HomeRightRailTheme = {
  mode: 'light',
  surface: 'rgba(255,255,255,0.92)',
  surface2: 'rgba(255,255,255,0.72)',
  border: 'rgba(15,23,42,0.10)',
  text: '#0b1220',
  sub: 'rgba(15,23,42,0.72)',
  accent: '#2563eb',
  accent2: '#7c3aed',
};

const HOME_YOUTH_TRENDING_VISIBLE_LIMIT = 9;
const HOME_YOUTH_TRENDING_FALLBACK_ITEMS = [
  {
    id: 'home-youth-trending-fallback-study-habits',
    title: 'How Students Can Build Better Study Habits With Simple Daily Routines',
  },
  {
    id: 'home-youth-trending-fallback-exam-stress',
    title: 'Smart Ways To Prepare For Exams Without Last-Minute Stress',
  },
  {
    id: 'home-youth-trending-fallback-career-skills',
    title: 'Simple Career Skills Every Student Should Learn Early',
  },
];

function safeTitle(raw: unknown): string {
  return String(raw || '').trim();
}

function localizePath(path: string, lang: HomeRightRailLang) {
  const safeLang = lang === 'hi' || lang === 'gu' ? lang : 'en';
  const normalized = String(path || '/').startsWith('/') ? String(path || '/') : `/${String(path || '/')}`;
  return safeLang === 'en' ? normalized : `/${safeLang}${normalized === '/' ? '' : normalized}`;
}

function normalizeCategoryKey(raw: unknown) {
  const value = String(raw || '').toLowerCase().trim();
  if (!value) return 'unknown';
  if (value.includes('sci') || value.includes('tech') || value.includes('science')) return 'science-tech';
  if (value.includes('international') || value.includes('world')) return 'international';
  if (value.includes('national')) return 'national';
  if (value.includes('business')) return 'business';
  if (value.includes('sport')) return 'sports';
  if (value.includes('lifestyle')) return 'lifestyle';
  if (value.includes('glamour') || value.includes('entertain')) return 'glamour';
  if (value.includes('regional') || value.includes('gujarat') || value.includes('local')) return 'regional';
  return 'unknown';
}

function categoryBadgeClasses(raw: unknown): string {
  const key = normalizeCategoryKey(raw);
  if (key === 'business') return 'bg-newsPulse-blue/10 text-newsPulse-blue border-newsPulse-blue/20';
  if (key === 'national') return 'bg-orange-50 text-orange-700 border-orange-100';
  if (key === 'international') return 'bg-purple-50 text-purple-700 border-purple-100';
  if (key === 'sports') return 'bg-green-50 text-green-700 border-green-100';
  if (key === 'science-tech') return 'bg-cyan-50 text-cyan-700 border-cyan-100';
  if (key === 'lifestyle') return 'bg-pink-50 text-pink-700 border-pink-100';
  if (key === 'glamour') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (key === 'regional') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return 'bg-slate-50 text-slate-700 border-slate-100';
}

export function articleToHomeRightRailFeedItem(article: Article, requestedLang: HomeRightRailLang) {
  const storyId = getStoryId(article as any) || undefined;
  const slug = resolveArticleSlug(article as any, requestedLang) || safeTitle((article as any)?.slug) || undefined;
  const titleRes = resolveArticleTitle(article as any, requestedLang);
  const descRes = resolveArticleSummaryOrExcerpt(article as any, requestedLang);
  const title = safeTitle(titleRes.text || (article as any)?.title) || 'Untitled';
  const desc = safeTitle(descRes.text || (article as any)?.summary || (article as any)?.excerpt) || '';
  const iso = resolveStoryDateIso(article as any);
  const time = formatEditorialDateTime(iso);
  const source = safeTitle((article as any)?.source?.name || (article as any)?.source) || 'News Pulse';
  const category = safeTitle((article as any)?.category) || '';
  const imageSrc = resolveCoverImageUrl(article as any, { lang: requestedLang }) || '';
  const coverFitMode = resolveCoverFitMode(article as any, { src: imageSrc, altText: title });

  return {
    _id: storyId,
    id: storyId || slug || title,
    lang: String((article as any)?.lang || (article as any)?.language || (article as any)?.sourceLang || (article as any)?.sourceLanguage || '').trim(),
    slug,
    translationGroupId: getStoryTranslationGroupId(article as any) || undefined,
    title,
    desc,
    titleIsOriginal: titleRes.isOriginal,
    descIsOriginal: descRes.isOriginal,
    time: time || '-',
    iso,
    source,
    category,
    imageSrc,
    coverFitMode,
  };
}

export function HomeRightRailLatestNews({ theme = DEFAULT_HOME_RIGHT_RAIL_THEME, items, lang }: { theme?: HomeRightRailTheme; items: any[] | null; lang: HomeRightRailLang }) {
  const { t } = useI18n();
  const safeLang = lang === 'hi' || lang === 'gu' ? lang : 'en';
  const prefix = safeLang === 'en' ? '' : `/${safeLang}`;
  const isLoading = items == null;
  const listItems = Array.isArray(items) ? items : [];
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'regional' | 'national' | 'international'>('all');

  const orderedItems = React.useMemo(() => {
    const picked: any[] = [];
    const pickedIds = new Set<string>();

    for (const item of listItems) {
      const id = getStoryId(item) || getStorySlug(item);
      if (!id || pickedIds.has(id)) continue;
      picked.push(item);
      pickedIds.add(id);
    }

    const filtered = activeFilter === 'all'
      ? picked
      : picked.filter((item) => normalizeCategoryKey(item?.category) === activeFilter);

    return filtered.slice(0, 8);
  }, [activeFilter, listItems]);

  if (!isLoading && !orderedItems.length) return null;

  const filterOptions = [
    { key: 'all', label: 'All' },
    { key: 'regional', label: 'Regional' },
    { key: 'national', label: 'National' },
    { key: 'international', label: 'International' },
  ] as const;

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/85 backdrop-blur shadow-[0_22px_48px_-38px_rgba(15,23,42,0.34)] transition hover:shadow-[0_28px_56px_-38px_rgba(15,23,42,0.38)]">
      <div
        className="border-b p-4"
        style={{
          borderColor: theme.border,
          background: theme.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(167,139,250,0.12), transparent 58%)'
            : 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,0.70) 58%)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" aria-hidden="true" style={{ background: theme.accent }} />
              <div className="truncate text-sm font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
                LATEST
              </div>
            </div>
            <div className="mt-1 text-base font-black tracking-tight" style={{ color: theme.text }}>
              News Pulse
            </div>
          </div>

          <Link
            href={`${prefix}/latest`}
            className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition"
            style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}
          >
            {t('common.viewAll')}
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {filterOptions.map((option) => {
            const isActive = activeFilter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveFilter(option.key)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.08em] transition"
                style={{
                  borderColor: isActive ? theme.accent : theme.border,
                  color: isActive ? theme.accent : theme.sub,
                  background: isActive
                    ? (theme.mode === 'dark' ? 'rgba(56,189,248,0.12)' : 'rgba(37,99,235,0.08)')
                    : theme.surface,
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-2 pb-2 pt-2">
        {isLoading ? (
          <div className="px-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`sk-${index}`} className="border-b border-slate-100 py-2.5 last:border-b-0">
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-4 w-full animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : !orderedItems.length ? (
          <div className="px-4 pb-4 pt-2 text-sm text-slate-500">No fresh updates right now</div>
        ) : (
          orderedItems.map((item: any) => {
            const storyId = getStoryId(item);
            const rawSlug = getStorySlug(item);
            const href = buildNewsUrl({ id: storyId || rawSlug, slug: rawSlug, lang: safeLang });
            const time = String(item?.time || '').trim();
            const category = String(item?.category || '').trim();
            const storyKey = getStoryReactKey(item, href);
            const titleText = String(item?.title || '').trim();
            const titleParts = splitStoryTitleHook(titleText);
            const titleHookColor = getStoryTitleHookColor(category);

            debugStoryCard('home-feed-list', item, item?.imageSrc);

            return (
              <Link
                key={storyKey}
                href={href}
                className="block rounded-[20px] border-b border-slate-100 px-3 py-2.5 transition last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {time ? (
                    <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{time}</div>
                  ) : null}

                  {category ? (
                    <span className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${categoryBadgeClasses(category)}`}>
                      {category}
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 flex items-start gap-2">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug" style={{ color: theme.text }}>
                    {titleParts.highlightedHook ? <span style={{ color: titleHookColor }}>{titleParts.highlightedHook}</span> : null}
                    {titleParts.remainingTitle ? <span>{` ${titleParts.remainingTitle}`}</span> : null}
                  </span>
                  {item?.titleIsOriginal ? <OriginalTag /> : null}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function getHomepageViralVideoText(video: PublicViralVideo | null): string {
  if (!video) return 'Short video';
  const raw = video.raw && typeof video.raw === 'object' ? video.raw : {};
  const nestedVideo = raw.video && typeof raw.video === 'object' && !Array.isArray(raw.video) ? raw.video as Record<string, any> : {};
  const candidates = [video.title, raw.title, nestedVideo.title, raw.headline, nestedVideo.headline, raw.shortTitle, nestedVideo.shortTitle, video.summary, raw.summary, nestedVideo.summary, raw.shortSummary, nestedVideo.shortSummary];

  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (text) return text;
  }

  return 'Short video';
}

export function HomeRightRailViralVideosBlock({ lang }: { theme?: HomeRightRailTheme; lang: HomeRightRailLang }) {
  const { t } = useI18n();
  const safeLang = lang === 'hi' || lang === 'gu' ? lang : 'en';
  const localizedHref = localizePath('/viral-videos', safeLang);
  const debugEnabled = process.env.NODE_ENV === 'development';
  const [resolved, setResolved] = React.useState(false);
  const [frontendEnabled, setFrontendEnabled] = React.useState(false);
  const [items, setItems] = React.useState<PublicViralVideo[]>([]);
  const [inlinePlayingId, setInlinePlayingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    let inFlightController: AbortController | null = null;
    const isFastRefreshEnv = process.env.NODE_ENV !== 'production'
      || (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname));
    const pollMs = isFastRefreshEnv ? 4000 : 20000;

    const loadFeaturedVideo = async (initial = false) => {
      inFlightController?.abort();
      const controller = new AbortController();
      inFlightController = controller;

      if (initial) setResolved(false);

      try {
        const fetchViralVideos = async (apiUrl: string) => {
          if (debugEnabled) {
            // eslint-disable-next-line no-console
            console.debug('[ShortVideoDesk] public viral videos API URL:', apiUrl);
          }

          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
          });
          const payload = await response.json().catch(() => null);
          const normalized = normalizePublicViralVideosPayload(payload);
          if (debugEnabled) {
            // eslint-disable-next-line no-console
            console.debug('[ShortVideoDesk] count returned:', normalized.items.length);
          }

          return { response, normalized };
        };

        const params = new URLSearchParams();
        if (safeLang) params.set('lang', safeLang);
        params.set('limit', '6');
        params.set('homepage', '1');
        const apiUrl = `/api/public/viral-videos?${params.toString()}`;
        let { response, normalized } = await fetchViralVideos(apiUrl);

        if (!mounted || controller.signal.aborted) return;
        if (!response.ok || normalized.settings.frontendEnabled !== true) {
          setFrontendEnabled(false);
          setItems([]);
          setResolved(true);
          return;
        }

        if (normalized.items.length === 0) {
          const fallback = await fetchViralVideos('/api/public/viral-videos?limit=6');
          if (!mounted || controller.signal.aborted) return;
          if (fallback.response.ok && fallback.normalized.settings.frontendEnabled === true && fallback.normalized.items.length > 0) {
            response = fallback.response;
            normalized = fallback.normalized;
          }
        }

        setFrontendEnabled(true);
        const selectedHomepageItems = normalized.items.filter((video) => video.showOnHomepage && video.globalFrontend !== false).slice(0, 6);
        const homepageItems = selectedHomepageItems.length
          ? selectedHomepageItems
          : normalized.items.filter((video) => video.globalFrontend !== false).slice(0, 6);
        setItems(homepageItems);
        setResolved(true);
      } catch {
        if (mounted && !controller.signal.aborted) {
          setFrontendEnabled(false);
          setItems([]);
          setResolved(true);
        }
      } finally {
        if (inFlightController === controller) inFlightController = null;
      }
    };

    void loadFeaturedVideo(true);
    const intervalId = window.setInterval(() => {
      void loadFeaturedVideo();
    }, pollMs);

    return () => {
      mounted = false;
      inFlightController?.abort();
      window.clearInterval(intervalId);
    };
  }, [debugEnabled, safeLang]);

  const featuredVideo = items[0] || null;
  const hasHomepageVideos = items.length > 0;
  const reelLabels = getViralVideoUiLabels(safeLang);
  const videoLabel = reelLabels.videoBadge;

  React.useEffect(() => {
    if (debugEnabled && resolved && frontendEnabled && !hasHomepageVideos) {
      // eslint-disable-next-line no-console
      console.debug('[ShortVideoDesk] empty state reason:', 'No homepage-featured public viral videos returned');
    }
  }, [debugEnabled, frontendEnabled, hasHomepageVideos, resolved]);

  const featuredDetailHref = featuredVideo
    ? localizePath(`/viral-videos/${encodeURIComponent(featuredVideo.slug || featuredVideo.id)}`, safeLang)
    : localizedHref;
  const featuredPoster = getPublicViralVideoPosterUrl(featuredVideo);
  const featuredImage = featuredPoster || COVER_PLACEHOLDER_SRC;
  const featuredText = getHomepageViralVideoText(featuredVideo);
  const featuredVideoSrc = resolvePublicViralVideoMediaUrl(featuredVideo?.videoFileUrl || '');
  const inlinePlaying = Boolean(featuredVideo && featuredVideoSrc && inlinePlayingId === featuredVideo.id);

  React.useEffect(() => {
    setInlinePlayingId(null);
  }, [featuredVideo?.id]);

  const handlePosterError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (debugEnabled) {
      // eslint-disable-next-line no-console
      console.debug('[ShortVideoDesk] poster failed to load:', event.currentTarget.src, featuredVideo?.id || featuredVideo?.slug || featuredVideo?.title || 'none');
    }
    if (event.currentTarget.src.endsWith(COVER_PLACEHOLDER_SRC)) return;
    event.currentTarget.src = COVER_PLACEHOLDER_SRC;
  };

  if (!resolved || !frontendEnabled || !featuredVideo) return null;

  return (
    <section
      aria-label={t('categories.viralVideos')}
      className="video-card-wrapper relative w-full overflow-hidden rounded-[24px] border-0 p-0 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.45)] outline-none"
      style={{ background: 'transparent', border: 'none', outline: 'none' }}
    >
      <div className="grid gap-3">
        <div
          className="video-card group relative block w-full overflow-hidden rounded-[24px] border-0 p-0 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.45)] outline-none"
          style={{ background: '#0f172a', border: 'none', outline: 'none', boxShadow: '0 14px 30px -28px rgba(15,23,42,0.45)' }}
        >
          <div className="video-card-media relative w-full overflow-hidden rounded-[24px] aspect-[9/16] min-h-[420px] max-h-[560px] border-0 outline-none">
            {inlinePlaying ? (
              <NewsPulseVideoPlayer
                key={featuredVideo.id}
                src={featuredVideoSrc}
                posterSrc={featuredImage}
                title={featuredText}
                readNewsHref=""
                labels={reelLabels}
                autoPlay
                showBottomTitle={false}
                compactReelControls
                hideTopBranding
                minHeightClassName="min-h-full"
              />
            ) : (
              <>
                <Link href={featuredDetailHref} aria-label={featuredText} className="absolute inset-0 z-10" />
                <img
                  src={featuredImage}
                  alt={featuredText}
                  className="block h-full w-full rounded-[24px] border-0 object-cover outline-none transition duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                  decoding="async"
                  onError={handlePosterError}
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.34)_0%,rgba(2,6,23,0.08)_30%,rgba(2,6,23,0.08)_50%,rgba(2,6,23,0.82)_100%)]" />
              </>
            )}
            <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 p-3">
              <span className="rounded-full bg-newsPulse-blue px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-newsPulse-white shadow-sm ring-1 ring-white/18 backdrop-blur">
                {videoLabel}
              </span>
              <Link
                href={localizedHref}
                onClick={(event) => event.stopPropagation()}
                className="relative z-40 rounded-full bg-black/48 px-2.5 py-1 text-[10px] font-bold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/62"
              >
                {reelLabels.viewMore}
              </Link>
            </div>
            {!inlinePlaying && featuredVideoSrc ? (
              <button type="button" onClick={() => setInlinePlayingId(featuredVideo.id)} aria-label={`Play ${featuredText}`} className="absolute left-1/2 top-1/2 z-30 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white shadow-[0_18px_36px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/34 backdrop-blur-md transition hover:scale-105 hover:bg-white/26 group-hover:scale-105 group-hover:bg-white/26">
                <Play className="ml-0.5 h-7 w-7 fill-current" />
              </button>
            ) : null}
            {!featuredVideoSrc ? (
              <div className="absolute inset-x-5 top-1/2 z-30 -translate-y-1/2 rounded-lg bg-black/58 p-3 text-center text-sm font-bold text-white shadow-xl ring-1 ring-white/15 backdrop-blur">
                Video source unavailable
              </div>
            ) : null}
            {!inlinePlaying ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4">
                <h3 className="line-clamp-3 text-[15px] font-black leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                  {featuredText}
                </h3>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeRightRailYouthDesk({ theme = DEFAULT_HOME_RIGHT_RAIL_THEME, lang }: { theme?: HomeRightRailTheme; lang: HomeRightRailLang }) {
  const { t } = useI18n();
  const youth = useYouthPulse();
  const localizedYouthPulseHref = localizePath('/youth-pulse', lang);
  const rightRailYouthTrendingItems = React.useMemo(() => {
    const items = Array.isArray(youth.trending) ? youth.trending.slice(0, HOME_YOUTH_TRENDING_VISIBLE_LIMIT) : [];
    if (!youth.loading && items.length > 0 && items.length < HOME_YOUTH_TRENDING_VISIBLE_LIMIT) {
      return [...items, ...HOME_YOUTH_TRENDING_FALLBACK_ITEMS].slice(0, HOME_YOUTH_TRENDING_VISIBLE_LIMIT);
    }
    return items;
  }, [youth.loading, youth.trending]);

  if (!youth.loading && rightRailYouthTrendingItems.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[28px] border shadow-[0_18px_42px_-34px_rgba(15,23,42,0.30)]" style={{ background: theme.surface2, borderColor: theme.border }}>
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-4"
        style={{
          borderColor: theme.border,
          background: theme.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(79,70,229,0.16), rgba(56,189,248,0.08) 70%, transparent 100%)'
            : 'linear-gradient(135deg, rgba(79,70,229,0.10), rgba(37,99,235,0.05) 70%, rgba(255,255,255,0.72) 100%)',
        }}
      >
        <div className="min-w-0">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>YOUTH DESK</div>
          <div className="mt-1 text-sm font-black tracking-tight" style={{ color: theme.text }}>{t('home.youthPulseTrending')}</div>
        </div>
        <a href={localizedYouthPulseHref} className="shrink-0 whitespace-nowrap text-xs font-semibold" style={{ color: theme.accent2 }}>{t('common.viewAll')} →</a>
      </div>
      <div className="grid gap-2.5 p-4">
        {rightRailYouthTrendingItems.map((item: any) => (
          <a
            key={String(item.id)}
            href={localizedYouthPulseHref}
            className="group flex items-center gap-3 rounded-[20px] border px-3.5 py-3 text-sm shadow-[0_14px_30px_-28px_rgba(15,23,42,0.32)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-28px_rgba(15,23,42,0.36)]"
            style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
              style={{
                borderColor: theme.mode === 'dark' ? 'rgba(148,163,184,0.22)' : 'rgba(99,102,241,0.18)',
                background: theme.mode === 'dark'
                  ? 'linear-gradient(135deg, rgba(79,70,229,0.22), rgba(14,165,233,0.12))'
                  : 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(14,165,233,0.08))',
              }}
            >
              <GraduationCap className="h-3.5 w-3.5" style={{ color: theme.accent2 }} />
            </span>
            <span className="min-w-0 flex-1 font-semibold leading-snug">{item.title}</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-75" />
          </a>
        ))}
        {youth.loading && !youth.trending.length ? (
          <div className="animate-pulse rounded-[22px] border px-3 py-7" style={{ background: theme.surface, borderColor: theme.border }} />
        ) : null}
      </div>
    </div>
  );
}

export default function HomeRightRail({
  theme = DEFAULT_HOME_RIGHT_RAIL_THEME,
  lang,
  latestItems,
  includeTallAd = true,
  sticky = true,
}: {
  theme?: HomeRightRailTheme;
  lang: HomeRightRailLang;
  latestItems: any[] | null;
  includeTallAd?: boolean;
  sticky?: boolean;
}) {
  return (
    <div className={`${sticky ? 'sticky top-4 ' : ''}grid w-full min-w-0 gap-4`}>
      <AdSlot slot="HOME_RIGHT_300x250" variant="right300" />

      <HomeRightRailLatestNews theme={theme} items={latestItems} lang={lang} />

      {includeTallAd ? <AdSlot slot="HOME_RIGHT_300x600" variant="right300x600" /> : null}

      <HomeRightRailViralVideosBlock theme={theme} lang={lang} />

      <HomeRightRailYouthDesk theme={theme} lang={lang} />
    </div>
  );
}