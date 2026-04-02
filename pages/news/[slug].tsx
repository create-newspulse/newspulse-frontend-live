import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import React from 'react';
import { useRouter } from 'next/router';

import AdSlot from '../../src/components/ads/AdSlot';
import CategoryHeader from '../../src/components/category/CategoryHeader';
import { getCategoryQueryKey, getCategoryRouteKey } from '../../lib/categoryKeys';
import { getLocalizedArticleFields, type RouteLocale } from '../../lib/localizedArticleFields';
import { formatArticleBodyHtml, splitArticleBodyBlocks, stripDuplicateOpeningParagraph } from '../../lib/articleBody';
import { fetchPublicNewsGroup, unwrapArticle, type Article } from '../../lib/publicNewsApi';
import { subscribePublicDataRefresh } from '../../lib/publicDataRefresh';
import { pickFreshestArticleForLocale, shouldReplaceArticleWithFreshCandidate } from '../../lib/translationGroupSync';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { tHeading, toLanguageKey } from '../../utils/localizedNames';
import { buildNewsUrl } from '../../lib/newsRoutes';
import { COVER_PLACEHOLDER_SRC, resolveCoverFitMode, resolveCoverImageUrl } from '../../lib/coverImages';
import { debugStoryCard, getStoryId, getStoryReactKey } from '../../lib/storyIdentity';
import StoryImage from '../../src/components/story/StoryImage';
import { useArticleAnalytics } from '../../hooks/useArticleAnalytics';

type ArticleDisplayAdProps = {
  slotId: 'ARTICLE_INLINE' | 'ARTICLE_END';
};

function ArticleDisplayAd({ slotId }: ArticleDisplayAdProps) {
  const variant = slotId === 'ARTICLE_END' ? 'articleEnd' : 'articleInline';

  return (
    <div className="not-prose clear-both mx-auto my-7 w-full max-w-[336px]">
      <div className="mb-1 text-left">
        <span className="text-xs uppercase tracking-wide text-slate-500">ADVERTISEMENT</span>
      </div>
      <AdSlot slot={slotId} variant={variant} renderMode="articleDisplay" className="w-full" />
    </div>
  );
}

function sanitizeContent(html: string) {
  return formatArticleBodyHtml(html || '');
}

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toRouteLocale(value: unknown): RouteLocale {
  const v = String(value || '').toLowerCase().trim();
  const base = v.split(/[-_]/g)[0] || v;
  if (base === 'hi' || base === 'hindi' || base === 'in') return 'hi';
  if (base === 'gu' || base === 'gujarati') return 'gu';
  return 'en';
}

function normalizeLang(value: unknown): 'en' | 'hi' | 'gu' {
  const v = String(value || '').toLowerCase().trim();
  const base = v.split(/[-_]/g)[0] || v;
  if (base === 'hi' || base === 'hindi' || base === 'in') return 'hi';
  if (base === 'gu' || base === 'gujarati') return 'gu';
  if (base === 'en' || base === 'english') return 'en';
  return 'en';
}

function stripQueryHash(path: string): string {
  const raw = String(path || '/');
  const noHash = raw.split('#')[0] || '/';
  const noQuery = noHash.split('?')[0] || '/';
  return noQuery || '/';
}

function localePrefix(lang: 'en' | 'hi' | 'gu'): '' | '/hi' | '/gu' {
  return lang === 'en' ? '' : (lang === 'hi' ? '/hi' : '/gu');
}

function tagList(tags: any): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t || '').toLowerCase().trim()).filter(Boolean);
  if (typeof tags === 'string') {
    return tags
      .split(/[;,|]/g)
      .map((t) => String(t || '').toLowerCase().trim())
      .filter(Boolean);
  }
  return [];
}

function slugifyTopic(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function resolveCategoryKey(article: Article | null): string {
  const raw = String((article as any)?.category || '').trim().toLowerCase();
  if (!raw) return '';
  return getCategoryRouteKey(raw);
}

function resolveCategoryQueryKey(article: Article | null): string {
  const raw = String((article as any)?.category || '').trim().toLowerCase();
  if (!raw) return '';
  return getCategoryQueryKey(raw);
}

function categoryLabelFromKey(key: string): string {
  if (!key) return 'News';
  if (key === 'science-technology') return 'Science & Technology';
  return key
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

type Props = {
  messages: any;
  locale: string;
  lang: 'en' | 'hi' | 'gu';
  slug: string;
  article: Article | null;
  safeHtml: string;
  topStories: Article[];
  relatedStories: Article[];
  error?: string | null;
  pending?: boolean;
};

function isPendingTranslationPayload(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const direct = String((payload as any).status || (payload as any).translationStatus || (payload as any).state || '').toLowerCase();
  if (direct === 'pending' || direct === 'translating') return true;

  const nested = (payload as any).data && typeof (payload as any).data === 'object' ? (payload as any).data : null;
  if (!nested) return false;
  const nestedStatus = String((nested as any).status || (nested as any).translationStatus || (nested as any).state || '').toLowerCase();
  return nestedStatus === 'pending' || nestedStatus === 'translating';
}

function debugNewsDetailResolution(stage: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[pages/news/[slug]]', { stage, ...payload });
}

export default function NewsSlugDetailPage({ lang, slug, article, safeHtml, topStories, relatedStories, error, pending }: Props) {
  const { t } = useI18n();
  const router = useRouter();

  const [resolvedArticle, setResolvedArticle] = React.useState<Article | null>(article);
  const [resolvedSafeHtml, setResolvedSafeHtml] = React.useState<string>(safeHtml || '');
  const [pendingTranslate, setPendingTranslate] = React.useState<boolean>(Boolean(pending));
  const [pendingError, setPendingError] = React.useState<string | null>(error || null);
  const [pendingExhausted, setPendingExhausted] = React.useState<boolean>(false);
  const pendingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAttemptsRef = React.useRef<number>(0);

  const routeLocale = React.useMemo(() => toRouteLocale(lang), [lang]);
  const localized = React.useMemo(
    () => getLocalizedArticleFields(resolvedArticle || {}, routeLocale),
    [resolvedArticle, routeLocale]
  );
  const rawTitle = cleanText(localized.title || (resolvedArticle as any)?.title);
  const displayTitle = rawTitle.length > 180 ? `${rawTitle.slice(0, 177).trimEnd()}…` : rawTitle;
  const displaySummary = cleanText(localized.summary || (resolvedArticle as any)?.summary);

  const clearPendingTimer = React.useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  const refreshFromTranslationGroup = React.useCallback(async () => {
    const current = resolvedArticle;
    const translationGroupId = String((current as any)?.translationGroupId || '').trim();
    if (!translationGroupId) return;

    const group = await fetchPublicNewsGroup({ translationGroupId, language: lang });
    if (group.error || !Array.isArray(group.items) || !group.items.length) return;

    const freshest = pickFreshestArticleForLocale({
      currentArticle: current,
      groupArticles: group.items,
      locale: toRouteLocale(lang),
    });
    if (!shouldReplaceArticleWithFreshCandidate(current, freshest, toRouteLocale(lang))) return;

    const localizedFreshest = getLocalizedArticleFields(freshest || {}, lang);
    if (!localizedFreshest.isVisible) return;

    setResolvedArticle(freshest as Article);
    setResolvedSafeHtml(sanitizeContent(localizedFreshest.bodyHtml || ''));
  }, [lang, resolvedArticle]);

  const schedulePendingRetry = React.useCallback(
    (pollOnce: () => Promise<void>) => {
      clearPendingTimer();
      pendingTimerRef.current = setTimeout(() => {
        void pollOnce();
      }, 1500);
    },
    [clearPendingTimer]
  );

  const pollOnce = React.useCallback(async () => {
    const slugToUse = String((router.query as any)?.slug || slug || '').trim();
    if (!slugToUse) return;

    if (pendingAttemptsRef.current >= 10) {
      setPendingExhausted(true);
      return;
    }

    pendingAttemptsRef.current += 1;

    const params = new URLSearchParams();
    params.set('lang', lang);
    params.set('language', lang);
    const endpoint = `/api/public/news/${encodeURIComponent(slugToUse)}?${params.toString()}`;

    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      const json = await res.json().catch(() => null);

      if (isPendingTranslationPayload(json)) {
        setPendingTranslate(true);
        schedulePendingRetry(pollOnce);
        return;
      }

      const next = unwrapArticle(json);
      if (!next?._id) {
        setPendingTranslate(false);
        setPendingError('Try again');
        setPendingExhausted(true);
        return;
      }

      const localizedNext = getLocalizedArticleFields(next || {}, lang);
      if (!localizedNext.isVisible) {
        setPendingTranslate(false);
        setPendingError('Not found');
        setPendingExhausted(true);
        return;
      }

      const html = localizedNext.bodyHtml;
      setResolvedArticle(next);
      setResolvedSafeHtml(sanitizeContent(html));
      setPendingTranslate(false);
      setPendingError(null);
      setPendingExhausted(false);
      pendingAttemptsRef.current = 0;
      clearPendingTimer();
    } catch {
      setPendingTranslate(false);
      setPendingError('Try again');
      setPendingExhausted(true);
    }
  }, [clearPendingTimer, lang, router.query, schedulePendingRetry, slug]);

  React.useEffect(() => {
    // When SSR says we're pending translation, start the polling loop.
    if (resolvedArticle?._id) return;
    if (!pendingTranslate) return;
    if (pendingExhausted) return;
    if (pendingTimerRef.current) return;
    schedulePendingRetry(pollOnce);
    return () => clearPendingTimer();
  }, [clearPendingTimer, pendingExhausted, pendingTranslate, pollOnce, resolvedArticle, schedulePendingRetry]);

  React.useEffect(() => {
    // If navigation changes to a different slug or language, reset pending state.
    setResolvedArticle(article);
    setResolvedSafeHtml(safeHtml || '');
    setPendingError(error || null);
    setPendingTranslate(Boolean(pending));
    setPendingExhausted(false);
    pendingAttemptsRef.current = 0;
    clearPendingTimer();
  }, [article, clearPendingTimer, error, lang, pending, safeHtml, slug]);

  React.useEffect(() => {
    if (!resolvedArticle?._id) return;

    void refreshFromTranslationGroup();
    return subscribePublicDataRefresh(() => {
      void refreshFromTranslationGroup();
    });
  }, [refreshFromTranslationGroup, resolvedArticle?._id]);

  const articleBodyHtml = React.useMemo(
    () => stripDuplicateOpeningParagraph(resolvedSafeHtml, displaySummary),
    [displaySummary, resolvedSafeHtml]
  );

  const paragraphBlocks = React.useMemo(() => splitArticleBodyBlocks(articleBodyHtml), [articleBodyHtml]);

  const inlineInsertAfterIndex = React.useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < paragraphBlocks.length; i += 1) {
      const b = String(paragraphBlocks[i] || '').trim();
      if (/^<p\b/i.test(b)) indices.push(i);
    }
    if (!indices.length) return null;
    if (indices.length >= 3) return indices[2];
    return indices[0];
  }, [paragraphBlocks]);

  const tx = React.useCallback(
    (key: string, fallback: string) => {
      try {
        const v = t(key);
        if (!v) return fallback;
        if (v === key) return fallback;
        return v;
      } catch {
        return fallback;
      }
    },
    [t]
  );

  const resolvedSlug = React.useMemo(
    () => String(localized.slug || resolvedArticle?._id || slug || '').trim(),
    [localized.slug, resolvedArticle?._id, slug]
  );

  React.useEffect(() => {
    debugNewsDetailResolution('client', {
      locale: lang,
      receivedSlug: slug,
      resolvedSlug: resolvedSlug || null,
      articleId: String(resolvedArticle?._id || '').trim() || null,
      translationFound: localized.translationFound,
    });
  }, [lang, localized.translationFound, resolvedArticle?._id, resolvedSlug, slug]);

  const analyticsSlug = React.useMemo(() => {
    const id = String(resolvedArticle?._id || '').trim();
    return String(localized.slug || id || slug || '').trim();
  }, [localized.slug, resolvedArticle?._id, slug]);

  useArticleAnalytics({
    article: resolvedArticle,
    slug: analyticsSlug,
    lang,
    isPendingTranslation: pendingTranslate,
  });

  const displayProvider = cleanText((resolvedArticle as any)?.provider);
  const displayGeneratedAt = cleanText((resolvedArticle as any)?.generatedAt);

  const coverRaw =
    (resolvedArticle as any)?.imageUrl ||
    (resolvedArticle as any)?.image ||
    (resolvedArticle as any)?.coverImage ||
    (resolvedArticle as any)?.thumbnail ||
    null;

  const cover = (() => {
    if (!coverRaw) return null;
    if (typeof coverRaw === 'string') {
      const v = coverRaw.trim();
      return v || null;
    }
    if (typeof coverRaw === 'object') {
      const url = typeof (coverRaw as any)?.url === 'string' ? String((coverRaw as any).url).trim() : '';
      return url || null;
    }
    return null;
  })();

  const heroSrc = cover || resolveCoverImageUrl(resolvedArticle) || null;
  const heroFitMode = resolveCoverFitMode(resolvedArticle, { src: heroSrc, altText: displayTitle });

  const prefix = React.useMemo(() => localePrefix(lang), [lang]);
  const categoryKey = React.useMemo(() => resolveCategoryKey(resolvedArticle), [resolvedArticle]);
  const categoryLabel = React.useMemo(() => categoryLabelFromKey(categoryKey), [categoryKey]);

  const homeHref = React.useMemo(() => (prefix ? prefix : '/'), [prefix]);
  const categoryHref = React.useMemo(() => (categoryKey ? `${prefix}/${categoryKey}`.replace(/\/\//g, '/') : ''), [categoryKey, prefix]);

  const categoryHeaderTitle = React.useMemo(() => {
    const langKey = toLanguageKey(lang);
    if (!categoryKey) return categoryLabel;
    try {
      const out = tHeading(langKey as any, categoryKey as any);
      const text = String(out || '').trim();
      return text || categoryLabel;
    } catch {
      return categoryLabel;
    }
  }, [categoryKey, categoryLabel]);

  const categoryHeaderSubtitle = React.useMemo(() => {
    // Keep it compact; use i18n if present, else plain English.
    if (categoryKey === 'national') return tx('nationalPage.newsFeed', 'News Feed');
    return 'News Feed';
  }, [categoryKey, tx]);

  const categorySearchPlaceholder = React.useMemo(() => {
    if (categoryKey === 'national') return tx('nationalPage.searchPlaceholder', 'Search National news…');
    if (categoryKey) return `Search ${categoryHeaderTitle}…`;
    return 'Search news…';
  }, [categoryHeaderTitle, categoryKey, tx]);

  const canonicalUrl = React.useMemo(() => {
    if (!resolvedArticle?._id) return '';
    const id = String(resolvedArticle._id || '').trim();
    const path = buildNewsUrl({ id, slug: localized.slug || id, lang });
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return base ? `${base}${path}` : path;
  }, [resolvedArticle, lang, localized.slug]);

  const shareThis = async () => {
    const url = canonicalUrl || (typeof window !== 'undefined' ? stripQueryHash(window.location.href) : '');
    const shareTitle = String(displayTitle || 'News Pulse').trim();
    if (!url) return;

    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
        if (typeof nav.share === 'function') {
          await nav.share({ title: shareTitle, url });
          return;
        }
      }
    } catch {
      // ignore
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const trendingTopics = React.useMemo(() => {
    const counts = new Map<string, number>();
    const pushTags = (tags: any) => {
      for (const tag of tagList(tags)) {
        if (!tag || tag.length < 3) continue;
        if (tag === 'breaking') continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    };

    pushTags((resolvedArticle as any)?.tags);
    for (const s of topStories || []) pushTags((s as any)?.tags);
    for (const s of relatedStories || []) pushTags((s as any)?.tags);

    const out: Array<[string, number]> = [];
    counts.forEach((v, k) => out.push([k, v]));
    return out
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);
  }, [resolvedArticle, relatedStories, topStories]);

  return (
    <>
      <Head>
        <title>{`${(pendingTranslate && !displayTitle) ? 'Translating…' : (displayTitle || 'News')} | News Pulse`}</title>
      </Head>

      <main className="min-h-screen bg-white">
        <CategoryHeader
          categorySlug={categoryKey || 'news'}
          title={categoryHeaderTitle}
          subtitle={categoryHeaderSubtitle}
          langPrefix={prefix as '' | '/hi' | '/gu' | '/en'}
          variant="compact"
          showBrowseStates={categoryKey === 'national'}
          browseStatesLabel={tx('nationalPage.browseStates', 'Browse states →')}
          showSearch
          searchPlaceholder={categorySearchPlaceholder}
        />

        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main */}
            <section className="lg:col-span-8">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="px-4 md:px-6 pt-4 md:pt-5 pb-4">
                  {/* Breadcrumbs */}
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                    <a href={homeHref} className="hover:underline">{tx('common.home', 'Home')}</a>
                    <span className="text-slate-300">›</span>
                    {categoryKey ? (
                      <a href={categoryHref} className="hover:underline">{categoryLabel}</a>
                    ) : (
                      <span>{categoryLabel}</span>
                    )}
                    {(() => {
                      const state = String((resolvedArticle as any)?.state || (resolvedArticle as any)?.region || '').trim();
                      const district = String((resolvedArticle as any)?.district || '').trim();
                      if (!state && !district) return null;
                      return (
                        <>
                          <span className="text-slate-300">›</span>
                          <span className="truncate max-w-[55vw]">{[state, district].filter(Boolean).join(' • ')}</span>
                        </>
                      );
                    })()}
                  </div>

                  <div className="mt-2 flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                      {displayTitle}
                    </h1>

                    {pendingError ? <div className="text-sm text-red-600">{pendingError}</div> : null}

                    {pendingTranslate ? (
                      <div className="text-sm font-semibold text-slate-700">
                        Translating...
                      </div>
                    ) : null}

                    {pendingExhausted ? (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingError(null);
                            setPendingExhausted(false);
                            pendingAttemptsRef.current = 0;
                            setPendingTranslate(true);
                            clearPendingTimer();
                            void pollOnce();
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Try again
                        </button>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="min-w-0 text-xs font-semibold text-slate-500">
                        {displayProvider ? displayProvider : null}
                        {displayProvider && displayGeneratedAt ? ' • ' : null}
                        {displayGeneratedAt ? displayGeneratedAt : null}
                      </div>

                      <button
                        type="button"
                        onClick={shareThis}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        {tx('common.share', 'Share')}
                      </button>
                    </div>

                    {Array.isArray((resolvedArticle as any)?.tags) && (resolvedArticle as any)?.tags?.length ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {tagList((resolvedArticle as any)?.tags)
                          .slice(0, 6)
                          .map((tag) => (
                            <a
                              key={tag}
                              href={`${prefix}/topic/${encodeURIComponent(slugifyTopic(tag))}?q=${encodeURIComponent(tag)}`.replace(/\/\//g, '/')}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                            >
                              #{tag}
                            </a>
                          ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="px-4 md:px-6 pb-5">
                  {heroSrc ? (
                    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-2 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.18)] sm:p-3">
                      <StoryImage
                        storyId={getStoryId(resolvedArticle)}
                        src={heroSrc}
                        fitMode={heroFitMode}
                        fallbackSrc={COVER_PLACEHOLDER_SRC}
                        alt={displayTitle}
                        variant="top"
                        priority
                        className="rounded-[22px] border border-slate-200/80 bg-slate-100"
                      />
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-2 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.18)] sm:p-3">
                      <div className="aspect-[16/9] w-full overflow-hidden rounded-[22px] border border-slate-200/80 bg-slate-100">
                        <div className="grid h-full w-full place-items-center">
                          <div className="text-xs font-extrabold tracking-tight text-slate-500 select-none">
                            News <span className="text-slate-700">Pulse</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {displaySummary ? (
                    <p className="mt-4 text-base md:text-lg text-slate-700">
                      {displaySummary}
                    </p>
                  ) : null}
                </div>

                <div className="px-4 md:px-6 pb-6">
                  <article className="prose prose-slate max-w-none">
                    {paragraphBlocks.length ? (
                      paragraphBlocks.map((block, idx) => (
                        <React.Fragment key={`pblock-${idx}`}>
                          <div dangerouslySetInnerHTML={{ __html: block }} />
                          {inlineInsertAfterIndex === idx ? (
                            <ArticleDisplayAd slotId="ARTICLE_INLINE" />
                          ) : null}
                        </React.Fragment>
                      ))
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: articleBodyHtml }} />
                    )}
                  </article>
                </div>

                <div className="px-4 md:px-6 pb-6">
                  <ArticleDisplayAd slotId="ARTICLE_END" />
                </div>
              </div>

              {/* Below-article: Related */}
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold text-slate-900">{tx('common.relatedStories', 'Related Stories')}</div>
                </div>

                {relatedStories && relatedStories.length ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {relatedStories.slice(0, 6).map((s, idx) => {
                      const id = getStoryId(s);
                      const localizedStory = getLocalizedArticleFields(s || {}, lang);
                      if (!localizedStory.isVisible) return null;
                      const href = id ? buildNewsUrl({ id, slug: id, lang }) : '#';
                      const img = resolveCoverImageUrl(s) || COVER_PLACEHOLDER_SRC;
                      const titleText = cleanText(localizedStory.title || (s as any)?.title) || String(t('common.untitled') || 'Untitled').trim();
                      const excerpt = String(localizedStory.summary || (s as any)?.summary || (s as any)?.excerpt || '').trim();

                      debugStoryCard('article-related-grid', s, img);

                      return (
                        <a
                          key={getStoryReactKey(s, href)}
                          href={href}
                          className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 overflow-hidden"
                        >
                          <div className="flex gap-3 p-3">
                            <StoryImage
                              storyId={id}
                              src={img}
                              alt={titleText}
                              variant="list"
                              className="border border-slate-200 bg-slate-100"
                            />
                            <div className="min-w-0">
                              <div className="line-clamp-2 text-sm font-bold text-slate-900 group-hover:underline">{titleText}</div>
                              {excerpt ? <div className="mt-1 line-clamp-2 text-xs text-slate-600">{excerpt}</div> : null}
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{tx('common.noResults', 'No related stories yet.')}</div>
                )}
              </div>
            </section>

            {/* Sidebar */}
            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-4 space-y-4">
                {/* Top Stories */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-200">
                    <div className="text-sm font-extrabold text-slate-900">{tx('common.topStories', 'Top Stories')}</div>
                  </div>
                  <div className="p-2">
                    {topStories && topStories.length ? (
                      topStories.slice(0, 8).map((s, i) => {
                        const id = getStoryId(s);
                        const localizedStory = getLocalizedArticleFields(s || {}, lang);
                        if (!localizedStory.isVisible) return null;
                        const href = id ? buildNewsUrl({ id, slug: id, lang }) : '#';
                        const titleText = cleanText(localizedStory.title || (s as any)?.title) || String(t('common.untitled') || 'Untitled').trim();
                        return (
                          <a
                            key={getStoryReactKey(s, href)}
                            href={href}
                            className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"
                          >
                            <div className="shrink-0 text-xs font-black text-slate-500 w-5 text-right">{i + 1}</div>
                            <div className="min-w-0">
                              <div className="line-clamp-2 text-sm font-semibold text-slate-900">{titleText}</div>
                            </div>
                          </a>
                        );
                      })
                    ) : (
                      <div className="p-3 text-sm text-slate-600">{tx('common.loading', 'Loading…')}</div>
                    )}
                  </div>
                </div>

                {/* Trending Topics */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-200">
                    <div className="text-sm font-extrabold text-slate-900">{tx('common.trending', 'Trending Topics')}</div>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2">
                    {trendingTopics.length ? (
                      trendingTopics.map((topic) => (
                        <a
                          key={topic}
                          href={`${prefix}/topic/${encodeURIComponent(slugifyTopic(topic))}?q=${encodeURIComponent(topic)}`.replace(/\/\//g, '/')}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          #{topic}
                        </a>
                      ))
                    ) : (
                      <div className="text-sm text-slate-600">{tx('common.noResults', 'No topics yet.')}</div>
                    )}
                  </div>
                </div>

                {/* Live Updates (mini) */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-200">
                    <div className="text-sm font-extrabold text-slate-900">{tx('common.liveUpdates', 'Live Updates')}</div>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    <a href={`${prefix}/breaking`.replace(/\/\//g, '/')} className="block text-slate-800 hover:underline">{tx('common.breaking', 'Breaking')}</a>
                    <a href={`${prefix}/live-updates`.replace(/\/\//g, '/')} className="block text-slate-800 hover:underline">{tx('common.liveUpdates', 'Live Updates')}</a>
                    {categoryKey ? (
                      <a href={`${prefix}/${categoryKey}`.replace(/\/\//g, '/')} className="block text-slate-800 hover:underline">{categoryLabel}</a>
                    ) : null}
                  </div>
                </div>

                {/* Ad */}
                <AdSlot slot="HOME_RIGHT_300x250" variant="right300" />

                {/* Related list */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-200">
                    <div className="text-sm font-extrabold text-slate-900">{tx('common.relatedStories', 'Related Stories')}</div>
                  </div>
                  <div className="p-2">
                    {relatedStories && relatedStories.length ? (
                      relatedStories.slice(0, 6).map((s, i) => {
                        const id = getStoryId(s);
                        const localizedStory = getLocalizedArticleFields(s || {}, lang);
                        if (!localizedStory.isVisible) return null;
                        const href = id ? buildNewsUrl({ id, slug: id, lang }) : '#';
                        const titleText = cleanText(localizedStory.title || (s as any)?.title) || String(t('common.untitled') || 'Untitled').trim();
                        return (
                          <a
                            key={getStoryReactKey(s, href)}
                            href={href}
                            className="block rounded-xl px-2 py-2 hover:bg-slate-50"
                          >
                            <div className="line-clamp-2 text-sm font-semibold text-slate-900">{titleText}</div>
                          </a>
                        );
                      })
                    ) : (
                      <div className="p-3 text-sm text-slate-600">{tx('common.noResults', 'No related stories yet.')}</div>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const lang = normalizeLang(ctx.locale);
  const locale = String(ctx.locale || lang);
  ctx.res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  ctx.res.setHeader('Pragma', 'no-cache');
  ctx.res.setHeader('Expires', '0');

  const messages = await (async () => {
    try {
      const { getMessages } = await import('../../lib/getMessages');
      return await getMessages(lang);
    } catch {
      return {};
    }
  })();

  const rawSlug = String((ctx.params as any)?.slug || '').trim();
  if (!rawSlug) {
    debugNewsDetailResolution('ssr-missing-slug', {
      locale: lang,
      receivedSlug: rawSlug,
      resolvedSlug: null,
      articleId: null,
      translationFound: false,
    });
    return {
      props: { messages, locale, lang, slug: '', article: null, safeHtml: '', topStories: [], relatedStories: [], error: 'Not found', pending: false },
    };
  }

  const getRequestOrigin = () => {
    const req = ctx.req;
    const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const proto = protoHeader || 'http';
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    if (!host) return '';
    return `${proto}://${host}`;
  };

  try {
    const origin = getRequestOrigin();
    const params = new URLSearchParams();
    params.set('lang', lang);
    params.set('language', lang);

    const headers = {
      Accept: 'application/json',
      cookie: String(ctx.req.headers.cookie || ''),
      authorization: String(ctx.req.headers.authorization || ''),
    };

    const endpoints = [
      `${origin}/api/public/news/slug/${encodeURIComponent(rawSlug)}?${params.toString()}`,
      `${origin}/api/public/news/${encodeURIComponent(rawSlug)}?${params.toString()}`,
    ];

    let data: any = null;
    let article: Article | null = null;
    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, { method: 'GET', headers, cache: 'no-store' });
      const next = await res.json().catch(() => null);
      if (isPendingTranslationPayload(next)) {
        data = next;
        article = null;
        break;
      }
      const candidate = unwrapArticle(next);
      if (candidate?._id) {
        data = next;
        article = candidate;
        break;
      }
      data = next;
    }

    if (isPendingTranslationPayload(data)) {
      debugNewsDetailResolution('ssr-pending', {
        locale: lang,
        receivedSlug: rawSlug,
        resolvedSlug: rawSlug,
        articleId: null,
        translationFound: false,
      });
      return {
        props: {
          messages,
          locale,
          lang,
          slug: rawSlug,
          article: null,
          safeHtml: '',
          topStories: [],
          relatedStories: [],
          error: null,
          pending: true,
        },
      };
    }

    if (!article?._id) {
      debugNewsDetailResolution('ssr-not-found', {
        locale: lang,
        receivedSlug: rawSlug,
        resolvedSlug: null,
        articleId: null,
        translationFound: false,
      });
      return {
        props: { messages, locale, lang, slug: rawSlug, article: null, safeHtml: '', topStories: [], relatedStories: [], error: 'Not found', pending: false },
      };
    }

    const translationGroupId = String((article as any)?.translationGroupId || '').trim();
    if (translationGroupId) {
      try {
        const groupEndpoint = `${origin}/api/public/news/group/${encodeURIComponent(translationGroupId)}?${params.toString()}`;
        const groupRes = await fetch(groupEndpoint, { method: 'GET', headers, cache: 'no-store' });
        const groupJson = await groupRes.json().catch(() => null);
        const groupItems = Array.isArray(groupJson?.items)
          ? groupJson.items
          : Array.isArray(groupJson?.articles)
            ? groupJson.articles
            : Array.isArray(groupJson?.data)
              ? groupJson.data
              : [];
        article = pickFreshestArticleForLocale({
          currentArticle: article,
          groupArticles: groupItems,
          locale: toRouteLocale(lang),
        }) as Article | null;
      } catch {
        // Keep original article when the sync group endpoint is unavailable.
      }
    }

    const localized = getLocalizedArticleFields(article, lang);
    if (!localized.isVisible) {
      debugNewsDetailResolution('ssr-hidden', {
        locale: lang,
        receivedSlug: rawSlug,
        resolvedSlug: localized.slug || rawSlug,
        articleId: String(article?._id || '').trim() || null,
        translationFound: localized.translationFound,
      });
      return { notFound: true };
    }

    const resolvedArticle = article;
    if (!resolvedArticle?._id) {
      return { notFound: true };
    }

    debugNewsDetailResolution('ssr-resolved', {
      locale: lang,
      receivedSlug: rawSlug,
      resolvedSlug: localized.slug || rawSlug,
      articleId: String(resolvedArticle._id || '').trim() || null,
      translationFound: localized.translationFound,
    });

    // Canonicalize slug per language
    const canonicalSlug = String(localized.slug || '').trim();
    if (canonicalSlug && canonicalSlug !== rawSlug) {
      const destination = buildNewsUrl({ id: String(resolvedArticle._id || '').trim(), slug: canonicalSlug, lang });
      return { redirect: { destination, permanent: true } };
    }

    const html = localized.bodyHtml;

    const extra = await (async () => {
      try {
        const categoryKey = resolveCategoryQueryKey(article);
        const limit = 24;
        const params = new URLSearchParams();
        if (categoryKey) params.set('category', categoryKey);
        params.set('lang', lang);
        params.set('language', lang);
        params.set('limit', String(limit));

        const endpoint = `${origin}/api/public/news?${params.toString()}`;
        const res = await fetch(endpoint, { method: 'GET', headers, cache: 'no-store' });
        const data = await res.json().catch(() => null);
        const itemsRaw =
          Array.isArray(data) ? data :
          Array.isArray(data?.items) ? data.items :
          Array.isArray(data?.articles) ? data.articles :
          Array.isArray(data?.data) ? data.data :
          [];

        const items: Article[] = Array.isArray(itemsRaw) ? (itemsRaw as Article[]) : [];
        const currentId = String((resolvedArticle as any)?._id || '').trim();

        const filtered = items.filter((x) => String((x as any)?._id || '').trim() && String((x as any)?._id || '').trim() !== currentId);

        const top = [...filtered];
        top.sort((a, b) => (Number((b as any)?.reads || 0) || 0) - (Number((a as any)?.reads || 0) || 0));

        const related = filtered.slice(0, 12);

        return {
          topStories: top.slice(0, 10),
          relatedStories: related,
        };
      } catch {
        return { topStories: [], relatedStories: [] };
      }
    })();

    return {
      props: {
        messages,
        locale,
        lang,
        slug: rawSlug,
        article: resolvedArticle,
        safeHtml: sanitizeContent(html),
        topStories: extra.topStories,
        relatedStories: extra.relatedStories,
        error: null,
        pending: false,
      },
    };
  } catch {
    return {
      props: { messages, locale, lang, slug: rawSlug, article: null, safeHtml: '', topStories: [], relatedStories: [], error: 'Fetch failed', pending: false },
    };
  }
};
