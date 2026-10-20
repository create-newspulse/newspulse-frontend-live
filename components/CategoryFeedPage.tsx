import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { getCategoryQueryKey, getCategoryRouteKey } from '../lib/categoryKeys';
import type { Article } from '../lib/publicNewsApi';
import { CATEGORY_FEED_BATCH_SIZE, CATEGORY_FEED_REFRESH_MS, fetchCategoryFeed, fetchCategoryFeedPage, mergeCategoryFeedPages, selectCategoryFeedArticles, type CategoryFeedPageResult } from '../lib/categoryFeed';
import { getOrdinaryCategoryBatchSize, isOrdinaryPaginatedCategory, type OrdinaryCategoryPagination } from '../lib/ordinaryCategoryPagination';
import { FAITH_CULTURE_PAGE_SIZE, isFaithCultureCategory } from '../lib/faithCulturePagination';
import { FAITH_CULTURE_TOPICS, getFaithCultureTopic } from '../lib/faithCultureTopics';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY } from '../lib/localizedArticleFields';
import { useLanguage } from '../utils/LanguageContext';
import { useI18n } from '../src/i18n/LanguageProvider';
import { buildNewsUrl, isNavigableNewsHref } from '../lib/newsRoutes';
import { COVER_PLACEHOLDER_SRC, resolveCoverFitMode, resolveCoverImageUrl } from '../lib/coverImages';
import { debugStoryCard, getStoryId, getStoryReactKey } from '../lib/storyIdentity';
import { formatEditorialDateTime, resolveStoryDateIso } from '../lib/storyDateTime';
import StoryImage, { TopStoryImage } from '../src/components/story/StoryImage';
import { getArticleAuthorDesignation, getArticleAuthorName, getArticleReadingTime, getEditorialTypeLabel, isEditorialArticle } from '../lib/editorialDisplay';
import { getPulseDialogueFormatLabel, getPulseDialogueMetadata } from '../lib/pulseDialogue';
import NewsPulseCategoryShell from './NewsPulseCategoryShell';
import CategoryDeskHeader from '../src/components/category/CategoryDeskHeader';
import { useCategoryStoryHierarchy, type CategoryStoryHierarchyItem } from './category/CategoryStoryHierarchy';

export type CategoryFeedPageProps = {
  title: string;
  categoryKey: string;
  extraQuery?: Record<string, string>;
  useCategoryShell?: boolean;
  initialItems?: Article[];
  initialPagination?: OrdinaryCategoryPagination;
  initialLocale?: string;
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
  if (k === 'faith-culture') return 'categories.faithCulture';
  if (k === 'pulse-dialogue') return 'categories.pulseDialogue';
  if (k === 'tech-gadgets') return 'categories.techGadgets';

  return null;
}

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

export { selectCategoryFeedArticles } from '../lib/categoryFeed';

function hasMoreCategoryResults(resp: Awaited<ReturnType<typeof fetchCategoryFeed>>, pageToLoad: number, requestedLimit: number): boolean {
  const total = typeof resp?.meta?.total === 'number' ? resp.meta.total : undefined;
  if (typeof total === 'number') return (Array.isArray(resp.items) ? resp.items.length : 0) < total;

  const totalPages = typeof resp?.meta?.totalPages === 'number' ? resp.meta.totalPages : undefined;
  if (typeof totalPages === 'number') return pageToLoad < totalPages;

  return (Array.isArray(resp.items) ? resp.items.length : 0) >= requestedLimit;
}

export default function CategoryFeedPage({ title, categoryKey, extraQuery, useCategoryShell = false, initialItems, initialPagination, initialLocale }: CategoryFeedPageProps) {
  const router = useRouter();
  const { language } = useLanguage();
  const { t } = useI18n();
  const faithPagination = isFaithCultureCategory(categoryKey);
  const faithTopic = faithPagination ? getFaithCultureTopic(extraQuery?.topic) : undefined;
  const emptyTitle = t(faithTopic ? 'faithCulture.noMatches' : 'categoryPage.noStoriesYet');
  const pagedCategory = faithPagination || isOrdinaryPaginatedCategory(categoryKey);
  const batchSize = faithPagination ? FAITH_CULTURE_PAGE_SIZE : pagedCategory ? getOrdinaryCategoryBatchSize(categoryKey) : CATEGORY_FEED_BATCH_SIZE;
  const seedMatchesLocale = !initialLocale || initialLocale === language;
  const seedPagination = pagedCategory && seedMatchesLocale ? initialPagination : undefined;
  const initialCategoryItems = React.useMemo(
    () => selectCategoryFeedArticles(pagedCategory && !seedMatchesLocale ? [] : initialItems, getCategoryQueryKey(categoryKey), language),
    [categoryKey, initialItems, language, pagedCategory, seedMatchesLocale]
  );
  const [items, setItems] = useState<Article[]>(() => initialCategoryItems);
  const [loaded, setLoaded] = useState(() => initialCategoryItems.length > 0 || Boolean(seedPagination));
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(seedPagination?.page ?? 1);
  const [hasMore, setHasMore] = useState(() => seedPagination?.hasMore ?? initialCategoryItems.length >= batchSize);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => {
    const raw = pagedCategory ? router.query.search ?? router.query.q : '';
    return String(Array.isArray(raw) ? raw[0] || '' : raw || '').trim();
  });
  const pageRef = React.useRef(seedPagination?.page ?? 1);
  const feedControllerRef = React.useRef<AbortController | null>(null);
  const requestGenerationRef = React.useRef(0);
  const activeFeedRequestRef = React.useRef('');
  const inFlightFeedRequestRef = React.useRef('');
  const hasDisplayItemsRef = React.useRef(initialCategoryItems.length > 0);

  const queryKey = useMemo(() => JSON.stringify(extraQuery || {}), [extraQuery]);
  const routeCategoryKey = useMemo(() => getCategoryRouteKey(categoryKey), [categoryKey]);
  const queryCategoryKey = useMemo(() => getCategoryQueryKey(categoryKey), [categoryKey]);
  const feedContextKey = JSON.stringify([language, queryCategoryKey, queryKey, pagedCategory ? searchQuery.trim().toLowerCase() : '']);
  const seedContextRef = React.useRef<string | null>(feedContextKey);
  const seedItemsRef = React.useRef(initialItems);
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
  const deskKey = `categoryDesks.${routeCategoryKey.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())}`;
  const deskTitle = t(`${deskKey}.title`);
  const deskCopy = deskTitle !== `${deskKey}.title` ? {
    eyebrow: t(`${deskKey}.eyebrow`),
    title: deskTitle,
    description: t(`${deskKey}.description`),
  } : {
    eyebrow: t('categoryPage.deskEyebrow', { category: String(localizedTitle || title).toUpperCase() }),
    title: t('categoryPage.deskTitle', { category: localizedTitle || title }),
    description: t('categoryPage.deskDescription', { category: String(localizedTitle || title).toLowerCase() }),
  };
  const resolvedDeskCopy = routeCategoryKey === 'pulse-dialogue'
    ? { ...deskCopy, description: t('pulseDialogue.landing.description') }
    : deskCopy;

  // Allow deep-linking into a filtered view (used by article-page category header search).
  React.useEffect(() => {
    if (!router.isReady) return;
    const raw = (router.query as any)?.search ?? (router.query as any)?.q;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const next = String(value || '').trim();
    if (!next && !pagedCategory) return;
    setSearchQuery(next);
  }, [router.isReady, router.query, pagedCategory]);

  const selectPageItems = React.useCallback((articles: Article[]) => {
    const scopedItems = selectCategoryFeedArticles(articles, queryCategoryKey, language);
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return scopedItems;
    return scopedItems.filter((a) => {
      const localized = getLocalizedArticleFields(a as any, language, STRICT_LOCALE_POLICY);
      if (!localized.isVisible) return false;
      const hay = `${localized.title || ''} ${localized.summary || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [language, queryCategoryKey, searchQuery]);
  const filteredItems = useMemo(() => selectPageItems(items), [items, selectPageItems]);

  const loadPage = React.useCallback(async (pageToLoad: number, signal?: AbortSignal, background = false) => {
    const requestedLimit = pagedCategory ? batchSize : pageToLoad * CATEGORY_FEED_BATCH_SIZE;
    const requestKey = `${feedContextKey}:${pageToLoad}:${requestGenerationRef.current}`;
    if (background && inFlightFeedRequestRef.current) return;
    if (inFlightFeedRequestRef.current === requestKey) return;

    activeFeedRequestRef.current = requestKey;
    inFlightFeedRequestRef.current = requestKey;

    if (pageToLoad === 1) {
      setLoaded(hasDisplayItemsRef.current);
      setError(null);
      if (!background) setLoadMoreError(null);
    } else if (!background) {
      setLoadingMore(true);
      setLoadMoreError(null);
    }

    try {
      if (pagedCategory) {
        const nextItems: Article[] = [];
        let nextPage = background ? 1 : pageToLoad;
        let result: CategoryFeedPageResult;
        do {
          result = await fetchCategoryFeedPage({
            category: queryCategoryKey, language, page: nextPage, limit: batchSize,
            extraQuery: fetchQuery, signal, selectItems: selectPageItems,
            isCurrent: () => activeFeedRequestRef.current === requestKey,
          });
          if (signal?.aborted || activeFeedRequestRef.current !== requestKey) return;
          nextItems.push(...result.items);
          nextPage = result.pagination.page + 1;
        } while (background && result.pagination.hasMore && nextPage <= pageToLoad);

        const append = !background && pageToLoad > 1;
        hasDisplayItemsRef.current = (append && hasDisplayItemsRef.current) || nextItems.length > 0;
        setItems((previous) => mergeCategoryFeedPages(append ? previous : [], nextItems, language));
        pageRef.current = result.pagination.page;
        setPage(result.pagination.page);
        setHasMore(result.pagination.hasMore);
        setLoaded(true);
        setLoadMoreError(null);
        return;
      }
      const resp = await fetchCategoryFeed({
        category: String(queryCategoryKey || ''),
        language,
        limit: requestedLimit,
        extraQuery: fetchQuery,
        signal,
      });

      if (signal?.aborted || activeFeedRequestRef.current !== requestKey) return;
      if (resp.error) throw new Error(resp.error);

      const nextItems = selectCategoryFeedArticles(resp.items, queryCategoryKey, language);
      hasDisplayItemsRef.current = nextItems.length > 0;
      setItems(nextItems);
      pageRef.current = pageToLoad;
      setPage(pageToLoad);
      setHasMore(hasMoreCategoryResults(resp, pageToLoad, requestedLimit));
      setLoaded(true);
      setLoadMoreError(null);
    } catch (failure) {
      if (signal?.aborted || activeFeedRequestRef.current !== requestKey) return;
      const message = !faithPagination && failure instanceof Error ? failure.message : t('errors.fetchFailed');
      setLoaded(true);
      if (!hasDisplayItemsRef.current) {
        setError(message);
        setItems([]);
        setHasMore(false);
      } else {
        setLoadMoreError(message);
        if (!background) setHasMore(true);
      }
    } finally {
      if (activeFeedRequestRef.current === requestKey) {
        setLoadingMore(false);
      }
      if (inFlightFeedRequestRef.current === requestKey) inFlightFeedRequestRef.current = '';
    }
  }, [batchSize, faithPagination, feedContextKey, fetchQuery, language, pagedCategory, queryCategoryKey, selectPageItems, t]);

  React.useEffect(() => {
    const controller = new AbortController();
    feedControllerRef.current = controller;
    requestGenerationRef.current += 1;
    activeFeedRequestRef.current = '';
    inFlightFeedRequestRef.current = '';
    if (pagedCategory) {
      if (seedItemsRef.current !== initialItems) {
        seedItemsRef.current = initialItems;
        seedContextRef.current = feedContextKey;
      } else if (seedContextRef.current !== feedContextKey) {
        seedContextRef.current = null;
      }
    }
    const useSeed = !pagedCategory || (seedContextRef.current === feedContextKey && !searchQuery.trim() && !Object.keys(extraQuery || {}).length);
    const seed = useSeed ? initialCategoryItems : [];
    const pagination = useSeed ? seedPagination : undefined;
    hasDisplayItemsRef.current = seed.length > 0;
    pageRef.current = pagination?.page ?? 1;
    setItems(seed);
    setLoaded(seed.length > 0 || Boolean(pagination));
    setError(null);
    setLoadMoreError(null);
    setHasMore(pagination?.hasMore ?? seed.length >= batchSize);
    setPage(pagination?.page ?? 1);

    if (!seed.length && !pagination) void loadPage(1, controller.signal);
    const refreshTimer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void loadPage(pageRef.current, controller.signal, true);
    }, CATEGORY_FEED_REFRESH_MS);

    return () => {
      clearInterval(refreshTimer);
      requestGenerationRef.current += 1;
      activeFeedRequestRef.current = '';
      inFlightFeedRequestRef.current = '';
      controller.abort();
    };
  }, [initialCategoryItems, language, queryCategoryKey, queryKey, feedContextKey, seedPagination]);

  const loadNextPage = React.useCallback(() => {
    if (!loaded || loadingMore || !hasMore) return;
    loadPage(page + 1, pagedCategory ? feedControllerRef.current?.signal : undefined);
  }, [hasMore, loadPage, loaded, loadingMore, page, pagedCategory]);

  const isUnauthorized = typeof error === 'string' && /\b401\b/.test(error);
  const shellLang = language === 'hi' || language === 'gu' ? language : 'en';
  const topStory = useCategoryShell ? filteredItems[0] || null : null;
  const freshStories = useCategoryShell && topStory ? filteredItems.slice(1) : filteredItems;

  const editorialSearch = isEditorialPage ? (
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
  ) : null;

  const renderHeader = () => (
    <CategoryDeskHeader
      eyebrow={resolvedDeskCopy.eyebrow}
      title={resolvedDeskCopy.title}
      description={resolvedDeskCopy.description}
    >
      {editorialSearch}
      {faithPagination ? (
        <nav aria-label={t('faithCulture.filterLabel')} className="min-w-0 flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap">
          {[undefined, ...FAITH_CULTURE_TOPICS].map((topic) => {
            const query = { ...router.query };
            delete query.topic;
            if (topic) query.topic = topic;
            const active = faithTopic === topic;
            return (
              <Link
                key={topic || 'all'}
                href={{ pathname: '/faith-culture', query }}
                locale={router.locale}
                shallow
                scroll={false}
                prefetch={false}
                aria-current={active ? 'true' : undefined}
                onFocus={(event) => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-newsPulse-blue/40 ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900/60'
                }`}
              >
                {t(`faithCulture.topics.${topic || 'all'}`)}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </CategoryDeskHeader>
  );

  const getCardView = (a: Article) => {
    const id = getStoryId(a);
    const localized = getLocalizedArticleFields(a as any, language, STRICT_LOCALE_POLICY);
    const href = buildNewsUrl({ id, slug: localized.slug || id, lang: language });
    const title = localized.title || t('categoryPage.untitled');
    const image = resolveCoverImageUrl(a) || COVER_PLACEHOLDER_SRC;
    const editorialLabel = routeCategoryKey === 'editorial' || isEditorialArticle(a) ? getEditorialTypeLabel(a) : '';
    const pulseDialogue = routeCategoryKey === 'pulse-dialogue' ? getPulseDialogueMetadata(a) : null;
    const pulseFormatLabel = pulseDialogue ? getPulseDialogueFormatLabel(pulseDialogue.dialogueFormat, t) : '';

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
      pulseDialogue,
      pulseFormatLabel,
      authorName: pulseDialogue?.contributorName || (editorialLabel ? getArticleAuthorName(a) : ''),
      authorDesignation: pulseDialogue?.contributorDesignation || (editorialLabel ? getArticleAuthorDesignation(a) : ''),
      readingTime: editorialLabel || pulseDialogue ? getArticleReadingTime(a) : '',
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
        label: card.pulseFormatLabel || card.editorialLabel || pageTitle,
        meta: card.pulseDialogue?.series ? [card.pulseDialogue.series] : [],
        dateIso: card.dateIso,
        dateLabel: card.when,
        readingTime: card.readingTime,
        authorName: card.authorName,
        authorDesignation: card.authorDesignation,
        contributorPhotoSrc: card.pulseDialogue?.contributorPhotoUrl || '',
        contributorPhotoAlt: card.pulseDialogue?.contributorPhotoAlt || card.authorName,
        contributorAffiliation: card.pulseDialogue?.contributorAffiliation || '',
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
        <div className="text-lg font-semibold text-newsPulse-navy">{emptyTitle}</div>
      </div>
    ) : (
      <section className={useCategoryShell ? 'mt-3 rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-white shadow-sm' : 'mt-8'}>
        {useCategoryShell ? (
          <div className="border-b border-newsPulse-slate/20 px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-newsPulse-blue/80">{pageTitle}</div>
            <div className="mt-1 text-lg font-extrabold tracking-tight text-newsPulse-navy">{routeCategoryKey === 'pulse-dialogue' ? t('pulseDialogue.landing.latestContributions') : t('categoryPage.freshStories')}</div>
          </div>
        ) : null}
        <ul className={useCategoryShell ? 'grid gap-4 p-3 sm:grid-cols-2' : 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3'}>
          {freshStories.map(renderStoryCard)}
        </ul>
      </section>
    )
  );

  const hierarchy = useCategoryStoryHierarchy({
    items: useCategoryShell && !error ? hierarchyItems : [],
    categoryLabel: pageTitle,
    description: t('categoryPage.hierarchyDescription'),
    topLabel: routeCategoryKey === 'pulse-dialogue' ? t('pulseDialogue.landing.featuredDialogue') : t(routeCategoryKey === 'web-stories' ? 'categoryPage.featuredWebStory' : isEditorialPage ? 'categoryPage.featuredEditorial' : 'home.topStory'),
    keyLabel: t(isEditorialPage ? 'categoryPage.keyEditorials' : 'categoryPage.keyStories'),
    latestLabel: routeCategoryKey === 'pulse-dialogue' ? t('pulseDialogue.landing.latestContributions') : isEditorialPage ? t('categoryPage.recentEditorials') : routeCategoryKey === 'web-stories' ? pageTitle : t('home.latest'),
    loadMoreLabel: t(routeCategoryKey === 'web-stories' ? 'categoryPage.loadMoreWebStories' : isEditorialPage ? 'categoryPage.loadMoreEditorials' : 'categoryPage.loadMoreStories', { category: pageTitle }),
    emptyTitle,
    loading: !loaded,
    variant: routeCategoryKey === 'web-stories' ? 'web-stories' : isEditorialPage ? 'editorial' : 'news',
    initialLatestCount: routeCategoryKey === 'web-stories' ? 12 : 8,
    loadMoreStep: routeCategoryKey === 'web-stories' ? 12 : 12,
    hasMore,
    loadingMore,
    loadMoreError,
    showLoadMoreWhenEmpty: faithPagination,
    autoLoadMore: true,
    onLoadMore: loadNextPage,
  }, useCategoryShell && pagedCategory);

  const renderHierarchyContent = () => (
    error ? (
      <div className="mt-6 rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-slate/10 p-5 text-newsPulse-navy">
        <div className="text-base font-bold">{t('categoryPage.unableToLoadTitle')}</div>
        <div className="mt-1 text-sm">{error}</div>
        <div className="mt-3 text-sm text-newsPulse-slate">
          {isUnauthorized ? t('categoryPage.publicFeedProtected') : t('categoryPage.ensureBackendRunning')}
        </div>
      </div>
    ) : loaded && items.length === 0 && !(faithPagination && hasMore) ? (
      <div className="mt-8 rounded-2xl border border-newsPulse-slate/25 bg-newsPulse-white p-6">
        <div className="text-lg font-semibold text-newsPulse-navy">{emptyTitle}</div>
      </div>
    ) : (
      hierarchy.content
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
        <NewsPulseCategoryShell activeCategory={routeCategoryKey} latestItems={items} lang={shellLang} topContent={renderHeader()} afterColumns={hierarchy.completion}>
          {shellCenterContent}
        </NewsPulseCategoryShell>
      ) : legacyContent}
    </>
  );
}
