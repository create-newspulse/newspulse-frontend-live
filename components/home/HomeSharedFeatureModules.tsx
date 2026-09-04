import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Flame, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { DEFAULT_TRENDING_TOPICS, type TrendingTopic } from '../../src/config/trendingTopics';
import { getTrendingTopics } from '../../lib/getTrendingTopics';
import { buildNewsUrl, isNavigableNewsHref } from '../../lib/newsRoutes';
import { COVER_PLACEHOLDER_SRC, resolveCoverFitMode, resolveCoverImageUrl } from '../../lib/coverImages';
import { getStoryCategoryLabel } from '../../lib/publicStories';
import { formatEditorialDateTime, resolveStoryDateIso } from '../../lib/storyDateTime';
import { getStoryTitleHookColor, splitStoryTitleHook } from '../../lib/storyTitleHook';
import { getStoryId, getStoryReactKey, getStorySlug } from '../../lib/storyIdentity';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle } from '../../lib/contentFallback';
import { resolveArticleSlug } from '../../lib/articleSlugs';
import StoryImage from '../../src/components/story/StoryImage';
import { useI18n } from '../../src/i18n/LanguageProvider';
import type { HomeRightRailLang, HomeRightRailTheme } from './HomeRightRail';
import { DEFAULT_HOME_RIGHT_RAIL_THEME } from './HomeRightRail';

const HOME_SPOTLIGHT_MAX_ITEMS = 8;
const HOME_SPOTLIGHT_ROTATE_MS = 5000;
const SPOTLIGHT_RESUME_DELAY_MS = 1200;

type SharedTheme = HomeRightRailTheme & {
  muted?: string;
  chip?: string;
  live?: string;
};

const DEFAULT_SHARED_THEME: SharedTheme = {
  ...DEFAULT_HOME_RIGHT_RAIL_THEME,
  muted: 'rgba(15,23,42,0.52)',
  chip: 'rgba(15,23,42,0.045)',
  live: '#dc2626',
};

const TRENDING_CHIP_THEME: Record<TrendingTopic['colorKey'], { base: string; hover: string; ring: string; active: string }> = {
  trending: {
    base: 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200 text-red-700',
    hover: 'hover:from-red-100 hover:to-pink-100 hover:border-red-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-red-300/50',
    active: 'from-red-100 to-pink-100 border-red-400',
  },
  breaking: {
    base: 'bg-gradient-to-r from-rose-50 to-orange-50 border-rose-200 text-rose-700',
    hover: 'hover:from-rose-100 hover:to-orange-100 hover:border-rose-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-rose-300/50',
    active: 'from-rose-100 to-orange-100 border-rose-400',
  },
  sports: {
    base: 'bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 text-cyan-700',
    hover: 'hover:from-cyan-100 hover:to-blue-100 hover:border-cyan-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-cyan-300/50',
    active: 'from-cyan-100 to-blue-100 border-cyan-400',
  },
  gold: {
    base: 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 text-amber-800',
    hover: 'hover:from-amber-100 hover:to-yellow-100 hover:border-amber-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-amber-300/50',
    active: 'from-amber-100 to-yellow-100 border-amber-400',
  },
  fuel: {
    base: 'bg-gradient-to-r from-emerald-50 to-lime-50 border-emerald-200 text-emerald-700',
    hover: 'hover:from-emerald-100 hover:to-lime-100 hover:border-emerald-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-emerald-300/50',
    active: 'from-emerald-100 to-lime-100 border-emerald-400',
  },
  weather: {
    base: 'bg-gradient-to-r from-sky-50 to-indigo-50 border-sky-200 text-sky-700',
    hover: 'hover:from-sky-100 hover:to-indigo-100 hover:border-sky-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-sky-300/50',
    active: 'from-sky-100 to-indigo-100 border-sky-400',
  },
  gujarat: {
    base: 'bg-gradient-to-r from-emerald-50 to-teal-50 border-teal-200 text-teal-700',
    hover: 'hover:from-emerald-100 hover:to-teal-100 hover:border-teal-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-teal-300/50',
    active: 'from-emerald-100 to-teal-100 border-teal-400',
  },
  markets: {
    base: 'bg-gradient-to-r from-indigo-50 to-fuchsia-50 border-indigo-200 text-indigo-700',
    hover: 'hover:from-indigo-100 hover:to-fuchsia-100 hover:border-indigo-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-indigo-300/50',
    active: 'from-indigo-100 to-fuchsia-100 border-indigo-400',
  },
  tech: {
    base: 'bg-gradient-to-r from-violet-50 to-sky-50 border-violet-200 text-violet-700',
    hover: 'hover:from-violet-100 hover:to-sky-100 hover:border-violet-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-violet-300/50',
    active: 'from-violet-100 to-sky-100 border-violet-400',
  },
  education: {
    base: 'bg-gradient-to-r from-rose-50 to-amber-50 border-rose-200 text-rose-700',
    hover: 'hover:from-rose-100 hover:to-amber-100 hover:border-rose-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-rose-300/50',
    active: 'from-rose-100 to-amber-100 border-rose-400',
  },
  __default: {
    base: 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-700',
    hover: 'hover:from-slate-100 hover:to-slate-200 hover:border-slate-300',
    ring: 'focus-visible:ring-2 focus-visible:ring-slate-300/50',
    active: 'from-slate-100 to-slate-200 border-slate-400',
  },
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function surfaceStyle(theme: SharedTheme): React.CSSProperties {
  return { background: theme.surface, borderColor: theme.border };
}

function Surface({ theme = DEFAULT_SHARED_THEME, className, children }: { theme?: SharedTheme; className?: string; children: React.ReactNode }) {
  return (
    <div className={classNames('rounded-3xl border shadow-[0_18px_70px_-60px_rgba(0,0,0,0.40)]', className)} style={surfaceStyle(theme)}>
      {children}
    </div>
  );
}

function labelKeyForTrendingTopic(key: string): string | null {
  if (key === 'breaking') return 'trending.breaking';
  if (key === 'sports') return 'trending.sports';
  if (key === 'gold-rates') return 'trending.goldRates';
  if (key === 'fuel-prices') return 'trending.fuelPrices';
  if (key === 'weather') return 'trending.weather';
  if (key === 'gujarat') return 'trending.gujarat';
  if (key === 'markets') return 'trending.markets';
  if (key === 'tech-ai') return 'trending.techAI';
  if (key === 'education') return 'trending.education';
  return null;
}

function localizePath(path: string, lang: HomeRightRailLang) {
  const safeLang = lang === 'hi' || lang === 'gu' ? lang : 'en';
  const normalized = String(path || '/').startsWith('/') ? String(path || '/') : `/${String(path || '/')}`;
  return safeLang === 'en' ? normalized : `/${safeLang}${normalized === '/' ? '' : normalized}`;
}

function safeText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateSmart(text: string, maxChars: number): string {
  const value = safeText(text);
  if (!value || value.length <= maxChars) return value;
  const slice = value.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = lastSpace > Math.floor(maxChars * 0.6) ? slice.slice(0, lastSpace) : slice;
  return `${trimmed.replace(/\s+$/g, '')}...`;
}

function estimateReadMinutes(text: string): number {
  const words = safeText(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function resolveStoryTitle(story: any, lang: HomeRightRailLang) {
  const resolved = resolveArticleTitle(story, lang);
  const direct = safeText(resolved.text || story?.title || story?.headline || story?.shortTitle);
  return { text: direct, isOriginal: Boolean(resolved.isOriginal) };
}

function resolveStorySummary(story: any, lang: HomeRightRailLang) {
  const resolved = resolveArticleSummaryOrExcerpt(story, lang);
  return safeText(resolved.text || story?.summary || story?.excerpt || story?.description || story?.content);
}

function toSpotlightViewModel(story: any, lang: HomeRightRailLang) {
  const storyId = getStoryId(story) || safeText(story?._id || story?.id);
  const slug = resolveArticleSlug(story, lang) || getStorySlug(story) || safeText(story?.slug) || storyId;
  const titleResult = resolveStoryTitle(story, lang);
  const title = titleResult.text;
  if (!title) return null;

  const href = buildNewsUrl({ id: storyId || slug || title, slug: slug || storyId || title, lang });
  const imageSrc = resolveCoverImageUrl(story, { lang }) || COVER_PLACEHOLDER_SRC;
  const summary = truncateSmart(resolveStorySummary(story, lang), 180);
  const categoryLabel = safeText(getStoryCategoryLabel(story?.category) || story?.category || story?.section || 'Regional');
  const time = formatEditorialDateTime(resolveStoryDateIso(story));
  const readMinutes = estimateReadMinutes(`${title} ${summary}`);

  return {
    key: getStoryReactKey(story, href),
    href,
    storyId,
    title,
    titleIsOriginal: titleResult.isOriginal,
    summary,
    categoryLabel,
    time,
    readMinutes,
    imageSrc,
    coverFitMode: resolveCoverFitMode(story, { src: imageSrc, altText: title }),
  };
}

export function HomeTrendingStrip({ theme = DEFAULT_SHARED_THEME, onPick }: { theme?: SharedTheme; onPick?: (label: string) => void }) {
  const router = useRouter();
  const { t } = useI18n();
  const [topics, setTopics] = React.useState<TrendingTopic[]>(DEFAULT_TRENDING_TOPICS);
  const [path, setPath] = React.useState('');
  const tapState = React.useRef({ down: false, startX: 0, startY: 0, moved: false, touchNavigatedAt: 0 });

  React.useEffect(() => {
    setPath(window.location.pathname);

    let cancelled = false;
    getTrendingTopics().then((next) => {
      if (!cancelled) setTopics(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home-shell trending-shell">
      <div className="mt-3 trending-shell-inner">
        <Surface theme={theme} className="trending-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold"
              style={{
                background: theme.mode === 'dark' ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.10)',
                borderColor: 'rgba(239,68,68,0.35)',
                color: theme.mode === 'dark' ? 'rgba(255,255,255,0.92)' : theme.text,
              }}
            >
              <Flame className="h-4 w-4" style={{ color: theme.live || '#dc2626' }} /> {t('common.trending')}
            </span>

            <div className="np-no-scrollbar w-full overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="inline-flex items-center gap-2 pr-4">
                {topics.map((topic) => {
                  const active = path === topic.href;
                  const chipTheme = TRENDING_CHIP_THEME[topic.colorKey] || TRENDING_CHIP_THEME.__default;
                  const labelKey = labelKeyForTrendingTopic(String(topic.key));
                  const label = labelKey ? t(labelKey) : topic.label;
                  const navigate = () => {
                    onPick?.(label);
                    router.push(topic.href).catch(() => {});
                  };

                  return (
                    <Link
                      key={topic.key}
                      href={topic.href}
                      aria-current={active ? 'page' : undefined}
                      onPointerDown={(event) => {
                        tapState.current.down = true;
                        tapState.current.moved = false;
                        tapState.current.startX = event.clientX;
                        tapState.current.startY = event.clientY;
                      }}
                      onPointerMove={(event) => {
                        if (!tapState.current.down || tapState.current.moved) return;
                        const dx = event.clientX - tapState.current.startX;
                        const dy = event.clientY - tapState.current.startY;
                        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) tapState.current.moved = true;
                      }}
                      onPointerUp={(event) => {
                        tapState.current.down = false;
                        if (event.pointerType === 'touch' && !tapState.current.moved) {
                          event.preventDefault();
                          tapState.current.touchNavigatedAt = Date.now();
                          navigate();
                        }
                      }}
                      onClick={(event) => {
                        if (Date.now() - tapState.current.touchNavigatedAt < 800) {
                          event.preventDefault();
                          return;
                        }
                        event.preventDefault();
                        navigate();
                      }}
                      className={classNames(
                        'pointer-events-auto relative z-10 shrink-0 cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-150 ease-out hover:-translate-y-[1px] hover:shadow-sm active:translate-y-0 focus-visible:outline-none',
                        chipTheme.base,
                        chipTheme.hover,
                        chipTheme.ring,
                        active ? classNames('shadow-sm', chipTheme.active) : null
                      )}
                    >
                      {label}
                    </Link>
                  );
                })}
                <div className="w-2 shrink-0" />
              </div>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}

export function HomeSpotlightCarousel({
  theme = DEFAULT_SHARED_THEME,
  title = 'News Pulse Spotlight',
  href = '/latest',
  items,
  lang,
  Icon = Sparkles,
}: {
  theme?: SharedTheme;
  title?: string;
  href?: string;
  items: any[] | null;
  lang: HomeRightRailLang;
  Icon?: React.ElementType;
}) {
  const { t } = useI18n();
  const safeLang = lang === 'hi' || lang === 'gu' ? lang : 'en';
  const localizedHref = localizePath(href, safeLang);
  const slides = React.useMemo(
    () => (Array.isArray(items) ? items.map((item) => toSpotlightViewModel(item, safeLang)).filter(Boolean).slice(0, HOME_SPOTLIGHT_MAX_ITEMS) : []),
    [items, safeLang]
  );
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const touchStartX = React.useRef<number | null>(null);
  const resumeTimerRef = React.useRef<number | null>(null);

  const clearResumeTimer = React.useCallback(() => {
    if (resumeTimerRef.current == null) return;
    window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = null;
  }, []);

  const pauseRotation = React.useCallback(() => {
    clearResumeTimer();
    setIsPaused(true);
  }, [clearResumeTimer]);

  const resumeRotationSoon = React.useCallback(() => {
    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => {
      resumeTimerRef.current = null;
      setIsPaused(false);
    }, SPOTLIGHT_RESUME_DELAY_MS);
  }, [clearResumeTimer]);

  React.useEffect(() => clearResumeTimer, [clearResumeTimer]);
  React.useEffect(() => setActiveIndex(0), [slides.length]);

  const goToPrevious = React.useCallback(() => {
    if (slides.length <= 1) return;
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goToNext = React.useCallback(() => {
    if (slides.length <= 1) return;
    setActiveIndex((current) => (current + 1) % slides.length);
  }, [slides.length]);

  React.useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timerId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, HOME_SPOTLIGHT_ROTATE_MS);
    return () => window.clearInterval(timerId);
  }, [isPaused, slides.length]);

  const activeItem = slides[activeIndex] as ReturnType<typeof toSpotlightViewModel> | null;
  if (!activeItem) {
    return (
      <Surface theme={theme} className="overflow-hidden">
        <div
          className="border-b px-4 py-4 sm:px-5"
          style={{
            borderColor: theme.border,
            background: theme.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(56,189,248,0.10), rgba(244,114,182,0.09) 65%, transparent 100%)'
              : 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(244,114,182,0.08) 65%, rgba(255,255,255,0.76) 100%)',
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border" style={{ borderColor: theme.border, background: theme.surface2, color: theme.text }}>
                  <Icon className="h-4 w-4" />
                </span>
                Spotlight
              </div>
              <div className="mt-2 text-2xl font-black tracking-tight" style={{ color: theme.text }}>
                {title}
              </div>
              <div className="mt-1 max-w-2xl text-sm leading-6" style={{ color: theme.sub }}>
                Freshly selected from the newsroom's most important stories
              </div>
            </div>

            <Link href={localizedHref} className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition hover:opacity-[0.98]" style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}>
              {t('common.viewAll')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="rounded-[30px] border px-5 py-10 text-center shadow-[0_24px_54px_-38px_rgba(15,23,42,0.30)]" style={{ borderColor: theme.border, background: theme.surface }}>
            <div className="text-sm font-semibold" style={{ color: theme.text }}>No spotlight stories right now.</div>
            <div className="mt-1 text-sm" style={{ color: theme.sub }}>Fresh newsroom picks will appear here when stories are available.</div>
          </div>
        </div>
      </Surface>
    );
  }

  const titleParts = splitStoryTitleHook(activeItem.title);
  const titleHookColor = getStoryTitleHookColor(activeItem.categoryLabel);
  const canOpen = isNavigableNewsHref(activeItem.href);
  const lineClamp2: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };
  const lineClamp3: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  return (
    <Surface theme={theme} className="overflow-hidden">
      <div
        className="border-b px-4 py-4 sm:px-5"
        style={{
          borderColor: theme.border,
          background: theme.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(56,189,248,0.10), rgba(244,114,182,0.09) 65%, transparent 100%)'
            : 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(244,114,182,0.08) 65%, rgba(255,255,255,0.76) 100%)',
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border" style={{ borderColor: theme.border, background: theme.surface2, color: theme.text }}>
                <Icon className="h-4 w-4" />
              </span>
              Spotlight
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight" style={{ color: theme.text }}>
              {title}
            </div>
            <div className="mt-1 max-w-2xl text-sm leading-6" style={{ color: theme.sub }}>
              Freshly selected from the newsroom's most important stories
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <button type="button" onClick={goToPrevious} aria-label="Previous spotlight story" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]" style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={goToNext} aria-label="Next spotlight story" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]" style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <Link href={localizedHref} className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition hover:opacity-[0.98]" style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}>
              {t('common.viewAll')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div
          className="overflow-hidden rounded-[30px] border p-4 shadow-[0_24px_54px_-38px_rgba(15,23,42,0.30)] sm:p-5 lg:p-6"
          style={{ borderColor: theme.border, background: theme.surface }}
          onTouchStart={(event) => {
            pauseRotation();
            touchStartX.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const startX = touchStartX.current;
            const endX = event.changedTouches[0]?.clientX ?? null;
            touchStartX.current = null;
            if (startX != null && endX != null) {
              const delta = endX - startX;
              if (Math.abs(delta) >= 40) {
                if (delta > 0) goToPrevious();
                else goToNext();
              }
            }
            resumeRotationSoon();
          }}
          onPointerDown={pauseRotation}
          onPointerUp={resumeRotationSoon}
          onPointerCancel={resumeRotationSoon}
          onMouseEnter={pauseRotation}
          onMouseLeave={() => {
            clearResumeTimer();
            setIsPaused(false);
          }}
        >
          <AnimatePresence mode="wait">
            <motion.article
              key={activeItem.key}
              initial={{ opacity: 0, y: 10, scale: 0.992 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, y: -10, scale: 0.996 }}
              transition={{ duration: 0.34, ease: 'easeOut' }}
              className="grid gap-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-center lg:gap-7"
            >
              <Link href={canOpen ? activeItem.href : localizedHref} className="group block">
                <div className="relative overflow-hidden rounded-[28px] bg-slate-100 shadow-[0_22px_48px_-36px_rgba(15,23,42,0.26)] ring-1 ring-slate-200/70">
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-[linear-gradient(180deg,rgba(15,23,42,0.12),rgba(15,23,42,0))]" />
                  <StoryImage
                    storyId={activeItem.storyId}
                    src={activeItem.imageSrc}
                    fitMode={activeItem.coverFitMode}
                    alt={activeItem.title}
                    variant="top"
                    fallbackSrc={COVER_PLACEHOLDER_SRC}
                    allowLowResContainFallback={false}
                    className="w-full rounded-none bg-transparent shadow-none ring-0"
                  />
                </div>
              </Link>

              <div className="min-w-0 lg:pr-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.sub }}>
                  {activeItem.categoryLabel ? (
                    <span className="rounded-full border px-2.5 py-1 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)]" style={{ borderColor: theme.border, background: theme.surface2, color: theme.text }}>
                      {activeItem.categoryLabel}
                    </span>
                  ) : null}
                  {activeItem.time ? <span className="text-[10.5px]" style={{ color: theme.muted || theme.sub }}>{activeItem.time}</span> : null}
                  {activeItem.time ? <span aria-hidden="true" style={{ opacity: 0.38 }}>-</span> : null}
                  <span className="text-[10.5px]" style={{ color: theme.muted || theme.sub }}>{activeItem.readMinutes} {t('common.minutesShort')}</span>
                </div>

                <h3 className="mt-4 min-w-0 text-[1.62rem] font-black leading-[1.14] tracking-tight sm:text-[1.92rem]" style={{ color: theme.text, ...lineClamp2 }}>
                  {titleParts.highlightedHook ? <span style={{ color: titleHookColor }}>{titleParts.highlightedHook}</span> : null}
                  {titleParts.remainingTitle ? <span>{` ${titleParts.remainingTitle}`}</span> : null}
                  {!titleParts.highlightedHook && !titleParts.remainingTitle ? <span>{activeItem.title}</span> : null}
                </h3>

                {activeItem.summary ? (
                  <div className="mt-4 max-w-xl text-sm leading-6 sm:text-[15px] sm:leading-6" style={{ color: theme.sub, ...lineClamp3 }}>
                    {activeItem.summary}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link href={canOpen ? activeItem.href : localizedHref} className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition hover:opacity-[0.98]" style={{ background: theme.accent, color: '#fff', borderColor: 'transparent' }}>
                    {t('common.read')} <ArrowRight className="h-4 w-4" />
                  </Link>

                  <div className="flex items-center gap-2 sm:hidden">
                    <button type="button" onClick={goToPrevious} aria-label="Previous spotlight story" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]" style={{ color: theme.text, borderColor: theme.border, background: theme.surface2 }}>
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={goToNext} aria-label="Next spotlight story" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]" style={{ color: theme.text, borderColor: theme.border, background: theme.surface2 }}>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        {slides.length > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: theme.sub }}>
              <span>{activeIndex + 1} / {slides.length}</span>
              <span className="inline-flex h-1.5 w-20 overflow-hidden rounded-full" style={{ background: theme.border }}>
                <motion.span
                  key={`spotlight-progress-${activeIndex}-${isPaused ? 'paused' : 'running'}`}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: isPaused ? 0.2 : HOME_SPOTLIGHT_ROTATE_MS / 1000, ease: 'linear' }}
                  className="h-full rounded-full"
                  style={{ background: theme.accent }}
                />
              </span>
            </div>
            <div className="flex items-center gap-2">
              {slides.map((slide, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={`${slide?.key || index}-${index}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Go to spotlight story ${index + 1}`}
                    className="h-2.5 rounded-full transition-all"
                    style={{
                      width: isActive ? 24 : 8,
                      background: isActive ? theme.accent : theme.border,
                      opacity: isActive ? 1 : 0.55,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </Surface>
  );
}
