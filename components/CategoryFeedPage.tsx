import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
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
import StoryImage, { TopStoryImage } from '../src/components/story/StoryImage';
import { getArticleAuthorDesignation, getArticleAuthorName, getArticleReadingTime, getEditorialTypeLabel, isEditorialArticle } from '../lib/editorialDisplay';
import NewsPulseCategoryShell from './NewsPulseCategoryShell';
import CategoryDeskHeader from '../src/components/category/CategoryDeskHeader';
import CategoryStoryHierarchy, { type CategoryStoryHierarchyItem } from './category/CategoryStoryHierarchy';

export type CategoryFeedPageProps = {
  title: string;
  categoryKey: string;
  extraQuery?: Record<string, string>;
  useCategoryShell?: boolean;
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

const CATEGORY_DESK_COPY: Record<string, { eyebrow: string; title: string; description: string }> = {
  national: {
    eyebrow: 'NATIONAL DESK • INDIA',
    title: 'National Pulse – India',
    description: 'Latest national news, politics, government and major developments from across India.',
  },
  international: {
    eyebrow: 'INTERNATIONAL DESK • WORLD',
    title: 'International Pulse – World',
    description: 'Latest global news, diplomacy, geopolitics and major developments from around the world.',
  },
  business: {
    eyebrow: 'BUSINESS DESK',
    title: 'Business Pulse',
    description: 'Latest updates on markets, economy, companies, startups and business.',
  },
  'science-technology': {
    eyebrow: 'SCIENCE & TECHNOLOGY DESK',
    title: 'Science & Technology Pulse',
    description: 'Latest developments in science, technology, innovation, space and digital life.',
  },
  sports: {
    eyebrow: 'SPORTS DESK',
    title: 'Sports Pulse',
    description: 'Latest sports news, matches, players and major sporting developments.',
  },
  lifestyle: {
    eyebrow: 'LIFESTYLE DESK',
    title: 'Lifestyle Pulse',
    description: 'Latest stories on health, food, travel, wellness, culture and everyday life.',
  },
  glamour: {
    eyebrow: 'GLAMOUR DESK',
    title: 'Glamour Pulse',
    description: 'Latest entertainment, celebrity, cinema and popular culture stories.',
  },
  editorial: {
    eyebrow: 'EDITORIAL DESK',
    title: 'Editorial Desk',
    description: 'News Pulse opinions, analysis, perspectives and in-depth commentary.',
  },
  'web-stories': {
    eyebrow: 'VISUAL STORIES',
    title: 'Web Stories',
    description: 'Quick, visual and immersive stories from News Pulse.',
  },
};

const EDITORIAL_SEARCH_COPY: Record<string, { searchPlaceholder: string }> = {
  en: {
    searchPlaceholder: 'Search Editorials and Special Stories...',
  },
  hi: {
    searchPlaceholder: 'संपादकीय और विशेष लेख खोजें...',
  },
  gu: {
    searchPlaceholder: 'સંપાદકીય અને વિશેષ લેખો શોધો...',
  },
};

const LOAD_MORE_LABELS: Record<string, string> = {
  international: 'Load More International Stories',
  business: 'Load More Business Stories',
  'science-technology': 'Load More Science & Technology Stories',
  sports: 'Load More Sports Stories',
  lifestyle: 'Load More Lifestyle Stories',
  glamour: 'Load More Glamour Stories',
  editorial: 'Load More Editorials',
  'web-stories': 'Load More Web Stories',
};

const CATEGORY_FEED_BATCH_SIZE = 30;

function getArticleStableKey(article: Article): string {
  return String(
    getStoryId(article) ||
    (article as any)?.translationGroupId ||
    article?.slug ||
    ''
  ).trim().toLowerCase();
}

function dedupeArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();
  const output: Article[] = [];

  for (const article of Array.isArray(articles) ? articles : []) {
    const key = getArticleStableKey(article);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    output.push(article);
  }

  return output;
}

function hasMoreCategoryResults(resp: Awaited<ReturnType<typeof fetchPublicNews>>, pageToLoad: number, requestedLimit: number): boolean {
  const total = typeof resp?.meta?.total === 'number' ? resp.meta.total : undefined;
  if (typeof total === 'number') return (Array.isArray(resp.items) ? resp.items.length : 0) < total;

  const totalPages = typeof resp?.meta?.totalPages === 'number' ? resp.meta.totalPages : undefined;
  if (typeof totalPages === 'number') return pageToLoad < totalPages;

  return (Array.isArray(resp.items) ? resp.items.length : 0) >= requestedLimit;
}

export default function CategoryFeedPage({ title, categoryKey, extraQuery, useCategoryShell = false }: CategoryFeedPageProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const { t } = useI18n();
  const [items, setItems] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const loadingPageRef = React.useRef<number | null>(null);
  const activeFeedRequestRef = React.useRef('');
  const inFlightFeedRequestRef = React.useRef('');

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
  const editorialSearchCopy = EDITORIAL_SEARCH_COPY[language] || EDITORIAL_SEARCH_COPY.en;
  const pageTitle = localizedTitle;
  const deskCopy = CATEGORY_DESK_COPY[routeCategoryKey] || {
    eyebrow: `${String(localizedTitle || title).toUpperCase()} DESK`,
    title: `${localizedTitle || title} Pulse`,
    description: `Latest ${String(localizedTitle || title).toLowerCase()} stories from News Pulse.`,
  };

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

  const loadPage = React.useCallback(async (pageToLoad: number) => {
    const requestedLimit = pageToLoad * CATEGORY_FEED_BATCH_SIZE;
    const requestKey = `${language}:${queryCategoryKey}:${queryKey}:${pageToLoad}`;
    if (inFlightFeedRequestRef.current === requestKey) return;

    loadingPageRef.current = pageToLoad;
    activeFeedRequestRef.current = requestKey;
    inFlightFeedRequestRef.current = requestKey;

    if (pageToLoad === 1) {
      setLoaded(false);
      setError(null);
      setLoadMoreError(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
      setLoadMoreError(null);
    }

    try {
      const resp = await fetchPublicNews({
        category: String(queryCategoryKey || ''),
        language,
        limit: requestedLimit,
        extraQuery: fetchQuery,
        signal: undefined,
      });

      if (activeFeedRequestRef.current !== requestKey) return;

      if (resp.error) {
        if (pageToLoad === 1) {
          setError(resp.error);
          setItems([]);
          setLoaded(false);
          setHasMore(false);
        } else {
          setLoadMoreError(resp.error);
          setHasMore(true);
        }
        return;
      }

      const nextItems = dedupeArticles(Array.isArray(resp.items) ? resp.items : []);
      setItems(nextItems);
      setPage(pageToLoad);
      setHasMore(hasMoreCategoryResults(resp, pageToLoad, requestedLimit));
      setLoaded(true);
    } catch {
      if (activeFeedRequestRef.current !== requestKey) return;
      if (pageToLoad === 1) {
        setError(t('errors.fetchFailed'));
        setItems([]);
        setLoaded(false);
        setHasMore(false);
      } else {
        setLoadMoreError(t('errors.fetchFailed'));
        setHasMore(true);
      }
    } finally {
      if (activeFeedRequestRef.current === requestKey) {
        setLoadingMore(false);
      }
      if (loadingPageRef.current === pageToLoad) loadingPageRef.current = null;
      if (inFlightFeedRequestRef.current === requestKey) inFlightFeedRequestRef.current = '';
    }
  }, [fetchQuery, language, queryCategoryKey, queryKey, t]);

  React.useEffect(() => {
    const controller = new AbortController();
    const requestKey = `${language}:${queryCategoryKey}:${queryKey}:1`;

    activeFeedRequestRef.current = requestKey;
  inFlightFeedRequestRef.current = requestKey;
    loadingPageRef.current = 1;
    setLoaded(false);
    setError(null);
    setLoadMoreError(null);
    setHasMore(true);
    setPage(1);

    (async () => {
      const resp = await fetchPublicNews({
        category: String(queryCategoryKey || ''),
        language,
        limit: CATEGORY_FEED_BATCH_SIZE,
        extraQuery: fetchQuery,
        signal: controller.signal,
      });

      if (controller.signal.aborted || activeFeedRequestRef.current !== requestKey) return;

      if (resp.error) {
        setError(resp.error);
        setItems([]);
        setLoaded(false);
        setHasMore(false);
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

      setItems(dedupeArticles(Array.isArray(resp.items) ? resp.items : []));
      setHasMore(hasMoreCategoryResults(resp, 1, CATEGORY_FEED_BATCH_SIZE));
      setLoaded(true);
    })().catch(() => {
      if (controller.signal.aborted || activeFeedRequestRef.current !== requestKey) return;
      setError(t('errors.fetchFailed'));
      setItems([]);
      setLoaded(false);
      setHasMore(false);
    }).finally(() => {
      if (loadingPageRef.current === 1) loadingPageRef.current = null;
      if (inFlightFeedRequestRef.current === requestKey) inFlightFeedRequestRef.current = '';
    });

    return () => {
      controller.abort();
    };
  }, [fetchQuery, language, queryCategoryKey, routeCategoryKey]);

  const loadNextPage = React.useCallback(() => {
    if (!loaded || loadingMore || !hasMore) return;
    loadPage(page + 1);
  }, [hasMore, loadPage, loaded, loadingMore, page]);

  const isUnauthorized = typeof error === 'string' && /\b401\b/.test(error);
  const shellLang = language === 'hi' || language === 'gu' ? language : 'en';
  const topStory = useCategoryShell ? filteredItems[0] || null : null;
  const freshStories = useCategoryShell && topStory ? filteredItems.slice(1) : filteredItems;

  const renderHeader = () => (
    <CategoryDeskHeader
      eyebrow={deskCopy.eyebrow}
      title={deskCopy.title}
      description={deskCopy.description}
      actions={isEditorialPage ? (
        <div>
          <label htmlFor="editorial-search" className="sr-only">{editorialSearchCopy.searchPlaceholder}</label>
          <input
            id="editorial-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={editorialSearchCopy.searchPlaceholder}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-newsPulse-navy outline-none transition focus:ring-2 focus:ring-slate-200"
          />
        </div>
      ) : null}
    />
  );

  const getCardView = (a: Article) => {
    const id = getStoryId(a);
    const localized = getLocalizedArticleFields(a as any, language, STRICT_LOCALE_POLICY);
    const href = buildNewsUrl({ id, slug: localized.slug || id, lang: language });
    const title = localized.title || t('categoryPage.untitled');
    const image = resolveCoverImageUrl(a) || COVER_PLACEHOLDER_SRC;
    const editorialLabel = routeCategoryKey === 'editorial' || isEditorialArticle(a) ? getEditorialTypeLabel(a) : '';

    return {
      id,
      localized,
      href,
      canOpen: isNavigableNewsHref(href),
      dateIso: resolveStoryDateIso(a as any),
      when: formatEditorialDateTime(resolveStoryDateIso(a as any)),
      title,
      summary: localized.summary,
      image,
      fitMode: resolveCoverFitMode(a, { src: image, altText: title }),
      editorialLabel,
      authorName: editorialLabel ? getArticleAuthorName(a) : '',
      authorDesignation: editorialLabel ? getArticleAuthorDesignation(a) : '',
      readingTime: editorialLabel ? getArticleReadingTime(a) : '',
    };
  };

  const hierarchyItems: CategoryStoryHierarchyItem[] = filteredItems
    .map((article) => {
      const card = getCardView(article);
      if (!card.localized.isVisible) return null;
      return {
        id: card.id,
        title: card.title,
        titleText: card.title,
        href: card.canOpen ? card.href : undefined,
        summary: card.summary,
        summaryText: card.summary,
        imageSrc: card.image,
        imageFitMode: card.fitMode,
        label: card.editorialLabel || pageTitle,
        meta: [],
        dateIso: card.dateIso,
        dateLabel: card.when,
        readingTime: card.readingTime,
        authorName: card.authorName,
        authorDesignation: card.authorDesignation,
        raw: article,
      } satisfies CategoryStoryHierarchyItem;
    })
    .filter(Boolean) as CategoryStoryHierarchyItem[];

  const renderStoryCard = (a: Article) => {
    const card = getCardView(a);
    if (!card.localized.isVisible) return null;

    debugStoryCard('category-feed', a, card.image);

    return (
      <li key={getStoryReactKey(a, card.href)} className="group overflow-hidden rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-white">
        <StoryImage
          storyId={card.id}
          src={card.image}
          fitMode={card.fitMode}
          alt={card.title || t('categoryPage.articleImageAlt')}
          variant="card"
          className="border-b border-newsPulse-slate/20"
        />

        <div className="p-4">
          {card.editorialLabel ? (
            <div className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-newsPulse-blue">
              {card.editorialLabel}
            </div>
          ) : null}

          {card.canOpen ? (
            <Link href={card.href} className="block text-lg font-bold text-newsPulse-navy hover:text-newsPulse-blue hover:underline">
              <span>{card.title}</span>
            </Link>
          ) : (
            <div className="block text-lg font-bold text-newsPulse-navy">
              <span>{card.title}</span>
            </div>
          )}

          {card.summary ? (
            <p
              className="mt-2 text-sm text-newsPulse-slate"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              <span>{card.summary}</span>
            </p>
          ) : null}

          {card.authorName ? (
            <div className="mt-3 text-sm text-newsPulse-navy">
              <div className="font-semibold">By {card.authorName}</div>
              {card.authorDesignation ? <div className="text-newsPulse-slate">{card.authorDesignation}</div> : null}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-newsPulse-slate">
            {card.when ? <span>{card.when}</span> : null}
            {card.readingTime ? <span>{card.readingTime}</span> : null}
          </div>

          {card.canOpen ? (
            <Link href={card.href} className="mt-4 inline-flex text-sm font-bold text-newsPulse-blue hover:underline">
              Read More
            </Link>
          ) : null}
        </div>
      </li>
    );
  };

  const renderTopStory = () => {
    if (!topStory) return null;
    const card = getCardView(topStory);
    if (!card.localized.isVisible) return null;

    debugStoryCard('category-top-story', topStory, card.image);

    const body = (
      <>
        <TopStoryImage
          storyId={card.id}
          src={card.image}
          alt={card.title || t('categoryPage.articleImageAlt')}
          priority
          fallbackSrc={COVER_PLACEHOLDER_SRC}
        />
        <div className="p-4">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-newsPulse-blue">
            {card.editorialLabel || 'Top Story'}
          </div>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-newsPulse-navy md:text-3xl">{card.title}</h2>
          {card.summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-newsPulse-slate">{card.summary}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-newsPulse-slate">
            {card.when ? <span>{card.when}</span> : null}
            {card.readingTime ? <span>{card.readingTime}</span> : null}
          </div>
          {card.authorName ? (
            <div className="mt-3 text-sm text-newsPulse-navy">
              <div className="font-semibold">By {card.authorName}</div>
              {card.authorDesignation ? <div className="text-newsPulse-slate">{card.authorDesignation}</div> : null}
            </div>
          ) : null}
        </div>
      </>
    );

    return (
      <section className="overflow-hidden rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-white shadow-sm">
        {card.canOpen ? <Link href={card.href} className="group block">{body}</Link> : body}
      </section>
    );
  };

  const renderFeedContent = () => (
    error ? (
      <div className="mt-6 rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-slate/10 p-5 text-newsPulse-navy">
        <div className="text-base font-bold">{t('categoryPage.unableToLoadTitle')}</div>
        <div className="mt-1 text-sm">{error}</div>
        <div className="mt-3 text-sm text-newsPulse-slate">
          {isUnauthorized ? t('categoryPage.publicFeedProtected') : t('categoryPage.ensureBackendRunning')}
        </div>
      </div>
    ) : loaded && items.length === 0 ? (
      <div className="mt-8 rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-white p-6">
        <div className="text-lg font-semibold text-newsPulse-navy">{t('categoryPage.noStoriesYet')}</div>
      </div>
    ) : (
      <section className={useCategoryShell ? 'mt-3 rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-white shadow-sm' : 'mt-8'}>
        {useCategoryShell ? (
          <div className="border-b border-newsPulse-slate/20 px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-newsPulse-blue/80">{pageTitle}</div>
            <div className="mt-1 text-lg font-extrabold tracking-tight text-newsPulse-navy">Fresh Stories</div>
          </div>
        ) : null}
        <ul className={useCategoryShell ? 'grid gap-4 p-3 sm:grid-cols-2' : 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3'}>
          {freshStories.map(renderStoryCard)}
        </ul>
      </section>
    )
  );

  const renderHierarchyContent = () => (
    error ? (
      <div className="mt-6 rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-slate/10 p-5 text-newsPulse-navy">
        <div className="text-base font-bold">{t('categoryPage.unableToLoadTitle')}</div>
        <div className="mt-1 text-sm">{error}</div>
        <div className="mt-3 text-sm text-newsPulse-slate">
          {isUnauthorized ? t('categoryPage.publicFeedProtected') : t('categoryPage.ensureBackendRunning')}
        </div>
      </div>
    ) : loaded && items.length === 0 ? (
      <div className="mt-8 rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-white p-6">
        <div className="text-lg font-semibold text-newsPulse-navy">{t('categoryPage.noStoriesYet')}</div>
      </div>
    ) : (
      <CategoryStoryHierarchy
        items={hierarchyItems}
        categoryLabel={routeCategoryKey === 'web-stories' ? 'Web Stories' : pageTitle}
        topLabel={routeCategoryKey === 'web-stories' ? 'Featured Web Story' : isEditorialPage ? 'Featured Editorial' : 'Top Story'}
        keyLabel={isEditorialPage ? 'Key Editorials' : 'Key Stories'}
        latestLabel={isEditorialPage ? 'Recent Editorials' : routeCategoryKey === 'web-stories' ? 'Web Stories' : 'Latest'}
        loadMoreLabel={LOAD_MORE_LABELS[routeCategoryKey] || `Load More ${pageTitle} Stories`}
        emptyTitle={t('categoryPage.noStoriesYet')}
        loading={!loaded}
        variant={routeCategoryKey === 'web-stories' ? 'web-stories' : isEditorialPage ? 'editorial' : 'news'}
        initialLatestCount={routeCategoryKey === 'web-stories' ? 12 : 8}
        loadMoreStep={routeCategoryKey === 'web-stories' ? 12 : 12}
        hasMore={hasMore}
        loadingMore={loadingMore}
        loadMoreError={loadMoreError}
        autoLoadMore
        onLoadMore={loadNextPage}
      />
    )
  );

  const shellCenterContent = (
    <div className="min-w-0 text-newsPulse-navy">
      {renderHierarchyContent()}
    </div>
  );

  const legacyContent = (
    <main className="min-h-screen bg-newsPulse-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {renderHeader()}
        {renderFeedContent()}
      </div>
    </main>
  );

  return (
    <>
      <Head>
        <title>{`${pageTitle} | ${t('brand.name')}`}</title>
      </Head>

      {useCategoryShell ? (
        <NewsPulseCategoryShell activeCategory={routeCategoryKey} latestItems={items} lang={shellLang} topContent={renderHeader()}>
          {shellCenterContent}
        </NewsPulseCategoryShell>
      ) : legacyContent}
    </>
  );
}
