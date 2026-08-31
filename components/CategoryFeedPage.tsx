import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Newspaper } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { getCategoryQueryKey, getCategoryRouteKey } from '../lib/categoryKeys';
import { fetchPublicNews, type Article } from '../lib/publicNewsApi';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY } from '../lib/localizedArticleFields';
import { useLanguage } from '../utils/LanguageContext';
import { useI18n } from '../src/i18n/LanguageProvider';
import { buildNewsUrl, isNavigableNewsHref } from '../lib/newsRoutes';
import { COVER_PLACEHOLDER_SRC, resolveCoverFitMode, resolveCoverImageUrl } from '../lib/coverImages';
import { debugStoryCard, getStoryId, getStoryReactKey } from '../lib/storyIdentity';
import { formatEditorialDateTime, resolveStoryDateIso } from '../lib/storyDateTime';
import StoryImage from '../src/components/story/StoryImage';
import { getArticleAuthorDesignation, getArticleAuthorName, getArticleReadingTime, getEditorialTypeLabel, isEditorialArticle } from '../lib/editorialDisplay';

export type CategoryFeedPageProps = {
  title: string;
  categoryKey: string;
  extraQuery?: Record<string, string>;
};

function categoryKeyToI18nKey(categoryKey: string): string | null {
  const k = String(categoryKey || '').trim().toLowerCase();
  if (!k) return null;

  if (k === 'breaking') return 'categories.breaking';
  if (k === 'regional') return 'categories.regional';
  if (k === 'national') return 'categories.national';
  if (k === 'international') return 'categories.international';
  if (k === 'business') return 'categories.business';
  if (k === 'science-technology') return 'categories.scienceTechnology';
  if (k === 'sports') return 'categories.sports';
  if (k === 'lifestyle') return 'categories.lifestyle';
  if (k === 'glamour') return 'categories.glamour';
  if (k === 'web-stories') return 'categories.webStories';
  if (k === 'viral-videos') return 'categories.viralVideos';
  if (k === 'editorial') return 'categories.editorial';
  if (k === 'youth' || k === 'youth-pulse') return 'categories.youthPulse';
  if (k === 'inspiration' || k === 'inspiration-hub') return 'categories.inspirationHub';

  return null;
}

const EDITORIAL_HEADER_COPY: Record<string, { title: string; subtitle: string; searchPlaceholder: string }> = {
  en: {
    title: 'Editorial',
    subtitle: 'In-depth Editorials and Special Stories from News Pulse.',
    searchPlaceholder: 'Search Editorials and Special Stories...',
  },
  hi: {
    title: 'संपादकीय',
    subtitle: 'न्यूज़ पल्स के गहन संपादकीय और विशेष लेख।',
    searchPlaceholder: 'संपादकीय और विशेष लेख खोजें...',
  },
  gu: {
    title: 'સંપાદકીય',
    subtitle: 'ન્યૂઝ પલ્સના વિશ્લેષણાત્મક સંપાદકીય અને વિશેષ લેખો.',
    searchPlaceholder: 'સંપાદકીય અને વિશેષ લેખો શોધો...',
  },
};

export default function CategoryFeedPage({ title, categoryKey, extraQuery }: CategoryFeedPageProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const { t } = useI18n();
  const [items, setItems] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const queryKey = useMemo(() => JSON.stringify(extraQuery || {}), [extraQuery]);
  const routeCategoryKey = useMemo(() => getCategoryRouteKey(categoryKey), [categoryKey]);
  const queryCategoryKey = useMemo(() => getCategoryQueryKey(categoryKey), [categoryKey]);
  const fetchQuery = useMemo(
    () => ({ ...(extraQuery || {}), strictLocale: '1' }),
    [extraQuery]
  );

  const localizedTitle = useMemo(() => {
    const key = categoryKeyToI18nKey(routeCategoryKey);
    return key ? t(key) : title;
  }, [routeCategoryKey, t, title]);
  const isEditorialPage = routeCategoryKey === 'editorial';
  const editorialHeaderCopy = EDITORIAL_HEADER_COPY[language] || EDITORIAL_HEADER_COPY.en;
  const pageTitle = isEditorialPage ? editorialHeaderCopy.title : localizedTitle;

  // Allow deep-linking into a filtered view (used by article-page category header search).
  React.useEffect(() => {
    if (!router.isReady) return;
    const raw = (router.query as any)?.search ?? (router.query as any)?.q;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const next = String(value || '').trim();
    if (!next) return;
    setSearchQuery(next);
  }, [router.isReady, router.query]);

  const filteredItems = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return items;
    return (items || []).filter((a) => {
      const localized = getLocalizedArticleFields(a as any, language, STRICT_LOCALE_POLICY);
      if (!localized.isVisible) return false;
      const hay = `${localized.title || ''} ${localized.summary || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, language, searchQuery]);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setError(null);

    (async () => {
      const resp = await fetchPublicNews({
        category: String(queryCategoryKey || ''),
        language,
        limit: 30,
        extraQuery: fetchQuery,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (resp.error) {
        setError(resp.error);
        setItems([]);
        setLoaded(false);
        return;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.info('[CategoryFeedPage]', {
          locale: language,
          routeSlug: routeCategoryKey,
          normalizedCategory: queryCategoryKey,
          numberOfStoriesReturned: Array.isArray(resp.items) ? resp.items.length : 0,
          storyIds: (Array.isArray(resp.items) ? resp.items : []).map((item) => String(item?._id || '').trim() || null),
          translationGroupIds: (Array.isArray(resp.items) ? resp.items : []).map(
            (item) => String((item as any)?.translationGroupId || '').trim() || null
          ),
          stories: (Array.isArray(resp.items) ? resp.items : []).map((item) => ({
            id: String(item?._id || '').trim() || null,
            translationGroupId: String((item as any)?.translationGroupId || '').trim() || null,
            slug: String(item?.slug || '').trim() || null,
            language: String((item as any)?.language || (item as any)?.lang || (item as any)?.sourceLanguage || '').trim() || null,
            status: String((item as any)?.status || (item as any)?.state || '').trim() || null,
            publishedAt: String((item as any)?.publishedAt || '').trim() || null,
            translationStatus: (item as any)?.translationStatus ?? null,
          })),
        });
      }

      setItems(Array.isArray(resp.items) ? resp.items : []);
      setLoaded(true);
    })().catch(() => {
      if (controller.signal.aborted) return;
      setError(t('errors.fetchFailed'));
      setItems([]);
      setLoaded(false);
    });

    return () => {
      controller.abort();
    };
  }, [fetchQuery, language, queryCategoryKey, routeCategoryKey]);

  const isUnauthorized = typeof error === 'string' && /\b401\b/.test(error);
  return (
    <>
      <Head>
        <title>{`${pageTitle} | ${t('brand.name')}`}</title>
      </Head>

      <main className="min-h-screen bg-newsPulse-white">
        <div className="max-w-6xl mx-auto px-4 py-10">
          {isEditorialPage ? (
            <header className="border-b border-newsPulse-slate/20 pb-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="h-14 w-1 shrink-0 rounded-full bg-newsPulse-blue" aria-hidden="true" />
                  <Newspaper className="h-6 w-6 shrink-0 text-newsPulse-blue" aria-hidden="true" />
                  <div className="min-w-0">
                    <h1 className="text-[28px] font-bold leading-tight text-newsPulse-navy">{editorialHeaderCopy.title}</h1>
                    <p className="mt-1 text-sm leading-5 text-newsPulse-slate">{editorialHeaderCopy.subtitle}</p>
                  </div>
                </div>

                <div className="w-full md:w-[min(360px,40%)]">
                  <label htmlFor="editorial-search" className="sr-only">{editorialHeaderCopy.searchPlaceholder}</label>
                  <input
                    id="editorial-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={editorialHeaderCopy.searchPlaceholder}
                    className="w-full rounded-xl border border-newsPulse-slate/25 bg-newsPulse-white px-4 py-2.5 text-sm text-newsPulse-navy outline-none transition focus:border-newsPulse-blue focus:ring-2 focus:ring-newsPulse-blue/15"
                  />
                </div>
              </div>
            </header>
          ) : (
            <header className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-4xl font-extrabold tracking-tight text-newsPulse-navy">{localizedTitle}</h1>
              </div>
            </header>
          )}

          {error ? (
            <div className="mt-6 rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-slate/10 p-5 text-newsPulse-navy">
              <div className="text-base font-bold">{t('categoryPage.unableToLoadTitle')}</div>
              <div className="mt-1 text-sm">{error}</div>
              <div className="mt-3 text-sm text-newsPulse-slate">
                {isUnauthorized ? (
                  <>
                    {t('categoryPage.publicFeedProtected')}
                  </>
                ) : (
                  <>
                    {t('categoryPage.ensureBackendRunning')}
                  </>
                )}
              </div>
            </div>
          ) : loaded && items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-white p-6">
              <div className="text-lg font-semibold text-newsPulse-navy">{t('categoryPage.noStoriesYet')}</div>
            </div>
          ) : (
            <section className="mt-8">
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((a) => {
                  const id = getStoryId(a);
                  const localized = getLocalizedArticleFields(a as any, language, STRICT_LOCALE_POLICY);
                  if (!localized.isVisible) return null;

                  const href = buildNewsUrl({ id, slug: localized.slug || id, lang: language });
                  const canOpen = isNavigableNewsHref(href);
                  const when = formatEditorialDateTime(resolveStoryDateIso(a as any));
                  const title = localized.title || t('categoryPage.untitled');
                  const summary = localized.summary;
                  const image = resolveCoverImageUrl(a) || COVER_PLACEHOLDER_SRC;
                  const fitMode = resolveCoverFitMode(a, { src: image, altText: title });
                  const editorialLabel = routeCategoryKey === 'editorial' || isEditorialArticle(a) ? getEditorialTypeLabel(a) : '';
                  const authorName = editorialLabel ? getArticleAuthorName(a) : '';
                  const authorDesignation = editorialLabel ? getArticleAuthorDesignation(a) : '';
                  const readingTime = editorialLabel ? getArticleReadingTime(a) : '';

                  debugStoryCard('category-feed', a, image);

                  return (
                    <li key={getStoryReactKey(a, href)} className="group rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-white overflow-hidden">
                      <StoryImage
                        storyId={id}
                        src={image}
                        fitMode={fitMode}
                        alt={title || t('categoryPage.articleImageAlt')}
                        variant="card"
                        className="border-b border-newsPulse-slate/20"
                      />

                      <div className="p-4">
                        {editorialLabel ? (
                          <div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-newsPulse-blue">
                            {editorialLabel}
                          </div>
                        ) : null}

                        {canOpen ? (
                          <Link href={href} className="block text-lg font-bold text-newsPulse-navy hover:text-newsPulse-blue hover:underline">
                            <span>{title}</span>
                          </Link>
                        ) : (
                          <div className="block text-lg font-bold text-newsPulse-navy">
                            <span>{title}</span>
                          </div>
                        )}

                        {summary ? (
                          <p
                            className="mt-2 text-sm text-newsPulse-slate"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            <span>{summary}</span>
                          </p>
                        ) : null}

                        {authorName ? (
                          <div className="mt-3 text-sm text-newsPulse-navy">
                            <div className="font-semibold">By {authorName}</div>
                            {authorDesignation ? <div className="text-newsPulse-slate">{authorDesignation}</div> : null}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-newsPulse-slate">
                          {when ? <span>{when}</span> : null}
                          {readingTime ? <span>{readingTime}</span> : null}
                        </div>

                        {canOpen ? (
                          <Link href={href} className="mt-4 inline-flex text-sm font-bold text-newsPulse-blue hover:underline">
                            Read More
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
