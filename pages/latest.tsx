import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import StoryImage from '../src/components/story/StoryImage';
import { fetchPublicNews, type Article } from '../lib/publicNewsApi';
import { resolveCoverFitMode } from '../lib/coverImages';
import { buildNewsUrl } from '../lib/newsRoutes';
import { getLocalizedArticleFields } from '../lib/localizedArticleFields';
import { debugStoryCard, getStoryId, getStoryReactKey } from '../lib/storyIdentity';
import { useI18n } from '../src/i18n/LanguageProvider';
import { useLanguage } from '../utils/LanguageContext';
import OriginalTag from '../components/OriginalTag';

function formatTime(iso?: string): string {
  const raw = String(iso || '').trim();
  if (!raw) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(raw));
  } catch {
    return '';
  }
}

type LatestCategoryKey =
  | 'regional'
  | 'national'
  | 'international'
  | 'business'
  | 'science-tech'
  | 'sports'
  | 'lifestyle'
  | 'glamour'
  | 'unknown';

function normalizeCategoryKey(raw: unknown): LatestCategoryKey {
  const v = String(raw || '').toLowerCase().trim();
  if (!v) return 'unknown';
  if (v.includes('sci') || v.includes('tech') || v.includes('science')) return 'science-tech';
  if (v.includes('international') || v.includes('world')) return 'international';
  if (v.includes('national') || v.includes('india')) return 'national';
  if (v.includes('business') || v.includes('market') || v.includes('finance')) return 'business';
  if (v.includes('sport') || v.includes('cricket') || v.includes('football')) return 'sports';
  if (v.includes('lifestyle') || v.includes('health') || v.includes('travel') || v.includes('food')) return 'lifestyle';
  if (v.includes('glamour') || v.includes('entertain') || v.includes('bollywood') || v.includes('celebrity')) return 'glamour';
  if (v.includes('regional') || v.includes('local') || v.includes('gujarat')) return 'regional';
  return 'unknown';
}

function categoryAccentClasses(raw: unknown): string {
  const key = normalizeCategoryKey(raw);
  if (key === 'regional') return 'bg-emerald-500/90';
  if (key === 'national') return 'bg-amber-500/90';
  if (key === 'international') return 'bg-blue-500/90';
  if (key === 'business') return 'bg-indigo-500/90';
  if (key === 'science-tech') return 'bg-violet-500/90';
  if (key === 'sports') return 'bg-cyan-500/90';
  if (key === 'lifestyle') return 'bg-pink-500/90';
  if (key === 'glamour') return 'bg-rose-500/90';
  return 'bg-slate-400/80';
}

function categoryBadgeClasses(raw: unknown): string {
  const key = normalizeCategoryKey(raw);
  if (key === 'regional') return 'bg-emerald-50 text-emerald-800 border-emerald-200/70';
  if (key === 'national') return 'bg-amber-50 text-amber-900 border-amber-200/70';
  if (key === 'international') return 'bg-blue-50 text-blue-800 border-blue-200/70';
  if (key === 'business') return 'bg-indigo-50 text-indigo-800 border-indigo-200/70';
  if (key === 'science-tech') return 'bg-violet-50 text-violet-800 border-violet-200/70';
  if (key === 'sports') return 'bg-cyan-50 text-cyan-900 border-cyan-200/70';
  if (key === 'lifestyle') return 'bg-pink-50 text-pink-900 border-pink-200/70';
  if (key === 'glamour') return 'bg-rose-50 text-rose-900 border-rose-200/70';
  return 'bg-slate-50 text-slate-800 border-slate-200/70';
}

function pickFirstImageUrl(raw: unknown): string {
  const v = typeof raw === 'string' ? raw : (raw as any)?.url;
  return String(v || '').trim();
}

function resolveCoverImageUrl(item: any): string {
  const media0 = Array.isArray(item?.media) ? item.media?.[0] : undefined;
  return (
    pickFirstImageUrl(item?.coverImage) ||
    pickFirstImageUrl(item?.image) ||
    pickFirstImageUrl(item?.imageUrl) ||
    pickFirstImageUrl(item?.thumbnail) ||
    pickFirstImageUrl(media0?.url) ||
    pickFirstImageUrl(item?.featuredImage)
  );
}

export default function LatestPage() {
  const { t } = useI18n();
  const { language } = useLanguage();

  const [items, setItems] = React.useState<Article[] | null>(null);
  const [error, setError] = React.useState<string>('');

  React.useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    setError('');

    (async () => {
      const resp = await fetchPublicNews({ language, limit: 40, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (resp.error) {
        setError(resp.error);
        setItems([]);
        return;
      }
      setItems(Array.isArray(resp.items) ? resp.items : []);
    })().catch((e: any) => {
      if (controller.signal.aborted) return;
      setError(String(e?.message || t('errors.fetchFailed') || 'Fetch failed'));
      setItems([]);
    });

    return () => controller.abort();
  }, [language, t]);

  return (
    <>
      <Head>
        <title>{`${t('home.latest')} | ${t('brand.name')}`}</title>
      </Head>

      <main className="min-h-screen bg-white text-slate-900">
        <div className="relative overflow-hidden">
          {/* Soft aurora backdrop */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-sky-200/35 via-indigo-200/25 to-fuchsia-200/35 blur-3xl" />
            <div className="absolute -bottom-28 left-0 h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-emerald-200/20 via-cyan-200/20 to-violet-200/25 blur-3xl" />
            <div className="absolute -top-28 right-0 h-[520px] w-[520px] rounded-full bg-gradient-to-tr from-rose-200/25 via-amber-200/15 to-sky-200/25 blur-3xl" />
          </div>

          <div className="mx-auto w-full max-w-[980px] px-4 sm:px-6 pb-14 pt-6">
            <header className="sticky top-3 z-30">
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 shadow-sm">
                <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-slate-900">
                      {t('home.latest')}
                    </h1>
                    <div className="mt-0.5 text-xs sm:text-sm font-medium text-slate-600">{t('home.freshUpdates')}</div>
                  </div>

                  <Link
                    href={language === 'en' ? '/' : `/${language}`}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200/70 bg-white/80 px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                  >
                    {t('common.home')}
                  </Link>
                </div>
              </div>
            </header>

            <div className="mt-6">
              {error ? (
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur p-5 shadow-sm text-slate-800">
                  <div className="text-base font-bold">{t('categoryPage.unableToLoadTitle')}</div>
                  <div className="mt-1 text-sm text-slate-700">{error}</div>
                </div>
              ) : items == null ? (
                <section aria-label="Loading" className="grid gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur px-4 py-3 shadow-sm"
                    >
                      <div className="absolute left-0 top-0 h-full w-1.5 bg-slate-300/70" />
                      <div className="animate-pulse">
                        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                          <div className="relative w-full overflow-hidden rounded-xl bg-slate-100 aspect-video sm:aspect-auto sm:h-24 sm:w-32" />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="h-5 w-16 rounded-full bg-slate-100" />
                              <div className="ml-auto h-6 w-24 rounded-full bg-slate-100" />
                            </div>
                            <div className="mt-2 space-y-2">
                              <div className="h-4 w-11/12 rounded bg-slate-100" />
                              <div className="h-4 w-8/12 rounded bg-slate-100" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-slate-200/70 bg-white/70 backdrop-blur p-6 shadow-sm">
                  <div className="text-lg font-semibold text-slate-900">{t('categoryPage.noStoriesYet')}</div>
                </div>
              ) : (
                <section aria-label="Latest stories">
                  <ul className="grid gap-3">
                    {items.map((a) => {
                      const id = getStoryId(a);
                      const localized = getLocalizedArticleFields(a as any, language);
                      if (!localized.isVisible) return null;

                      const href = buildNewsUrl({ id, slug: localized.slug || id, lang: language });

                      const title = String(localized.title || '').trim() || String(t('common.untitled') || 'Untitled');
                      const when = formatTime(a.publishedAt || a.createdAt);
                      const category = String(localized.categoryLabel || (a as any)?.category || '').trim();
                      const coverSrc = resolveCoverImageUrl(a as any);
                      const fitMode = resolveCoverFitMode(a as any, { src: coverSrc, altText: title });

                      debugStoryCard('latest-page', a, coverSrc);

                      return (
                        <li key={getStoryReactKey(a, href)}>
                          <Link
                            href={href}
                            className="group relative block overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 backdrop-blur px-4 py-3 shadow-sm transition will-change-transform hover:-translate-y-0.5 hover:border-slate-300/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
                          >
                            <div className={`absolute left-0 top-0 h-full w-1.5 ${categoryAccentClasses(category)}`} />

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
                              <div className="relative w-full overflow-hidden rounded-xl bg-slate-50 aspect-video sm:aspect-auto sm:h-24 sm:w-32 shrink-0">
                                {coverSrc ? (
                                  <StoryImage
                                    storyId={id}
                                    src={coverSrc}
                                    fitMode={fitMode}
                                    alt={title}
                                    variant="list"
                                    className="h-full w-full rounded-xl border border-slate-200/70"
                                  />
                                ) : (
                                  <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-sky-50 to-indigo-50">
                                    <div className="absolute inset-0 opacity-70 bg-gradient-to-tr from-emerald-100/40 via-transparent to-rose-100/35" />
                                    <div className="absolute bottom-2 right-2 rounded-md border border-white/60 bg-white/50 px-2 py-1 text-[10px] font-semibold tracking-wide text-slate-700">
                                      NewsPulse
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  {when ? (
                                    <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200/70 bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-700">
                                      {when}
                                    </span>
                                  ) : (
                                    <span className="inline-flex shrink-0 items-center rounded-full border border-transparent bg-transparent px-2 py-1 text-[11px] font-semibold text-slate-500">
                                      {''}
                                    </span>
                                  )}

                                  {category ? (
                                    <span
                                      className={`ml-auto inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${categoryBadgeClasses(
                                        category
                                      )}`}
                                    >
                                      {category}
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-2 flex items-start gap-2">
                                  <span
                                    className="text-[15px] sm:text-[16px] font-semibold leading-snug text-slate-900"
                                    style={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {title}
                                  </span>
                                  {localized.isFallback ? <OriginalTag /> : null}
                                </div>
                              </div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
