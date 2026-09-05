import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import { useRouter } from 'next/router';

import AdSlot from '../../src/components/ads/AdSlot';
import CategoryHeader from '../../src/components/category/CategoryHeader';
import { getCategoryQueryKey, getCategoryRouteKey } from '../../lib/categoryKeys';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY, type RouteLocale } from '../../lib/localizedArticleFields';
import { formatArticleBodyHtml, splitArticleBodyBlocks, stripDuplicateOpeningParagraph } from '../../lib/articleBody';
import { fetchPublicNewsGroup, unwrapArticle, type Article } from '../../lib/publicNewsApi';
import { subscribePublicDataRefresh } from '../../lib/publicDataRefresh';
import { pickFreshestArticleForLocale, shouldReplaceArticleWithFreshCandidate } from '../../lib/translationGroupSync';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { tHeading, toLanguageKey } from '../../utils/localizedNames';
import { buildNewsUrl, isNavigableNewsHref } from '../../lib/newsRoutes';
import { COVER_PLACEHOLDER_SRC, resolveCoverImageUrl } from '../../lib/coverImages';
import { resolveSponsoredContentMeta } from '../../lib/sponsoredContent';
import { debugStoryCard, getStoryId, getStoryReactKey } from '../../lib/storyIdentity';
import { formatEditorialDateTime } from '../../lib/storyDateTime';
import { getStoryTitleHookColor, splitStoryTitleHook } from '../../lib/storyTitleHook';
import StoryImage, { ArticleHeroImage } from '../../src/components/story/StoryImage';
import { useArticleAnalytics } from '../../hooks/useArticleAnalytics';
import {
  getArticleAuthorDesignation,
  getArticleAuthorName,
  getEditorialTypeLabel,
  getImageAltText,
  getImageCaption,
  getImageCredit,
  getLocalizedSeoValue,
  getStoredSeoValue,
  isEditorialArticle,
} from '../../lib/editorialDisplay';
import {
  buildArticleSeoMetadata,
  getArticleAlternates,
  getArticleCanonicalUrl,
  resolvePublicSiteUrl,
  safeJsonLd,
} from '../../lib/seo';

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

function ArticleReadingSidebar() {
  return (
    <div className="sticky top-4 grid w-full min-w-0 gap-4">
      <AdSlot slot="HOME_RIGHT_300x250" variant="right300" />
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
  pendingSourceLang?: 'en' | 'hi' | 'gu' | null;
  siteUrl: string;
  seo?: {
    canonicalUrl?: string;
    alternates?: Array<{ hrefLang: string; href: string }>;
  };
};

const LANG_LABELS: Record<'en' | 'hi' | 'gu', string> = {
  en: 'English',
  hi: 'Hindi',
  gu: 'Gujarati',
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

function getPendingSourceLang(payload: any): 'en' | 'hi' | 'gu' | null {
  const candidates = [
    payload?.sourceLang,
    payload?.sourceLanguage,
    payload?.availableLang,
    payload?.availableLanguage,
    payload?.data?.sourceLang,
    payload?.data?.sourceLanguage,
    payload?.data?.availableLang,
    payload?.data?.availableLanguage,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    return normalizeLang(candidate);
  }
  return null;
}

function getArticleSourceLang(article: Article | null): 'en' | 'hi' | 'gu' | null {
  if (!article) return null;
  const raw = (article as any)?.sourceLang || (article as any)?.sourceLanguage || (article as any)?.language || (article as any)?.lang;
  return raw ? normalizeLang(raw) : null;
}

/** Renders a real link only when the related story resolves to a route, never a dead '#'. */
function RelatedStoryShell({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!isNavigableNewsHref(href)) {
    return <div className={className}>{children}</div>;
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function debugNewsDetailResolution(stage: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  console.info('[pages/news/[slug]]', { stage, ...payload });
}

export default function NewsSlugDetailPage({ lang, slug, article, safeHtml, relatedStories, error, pending, pendingSourceLang = null, siteUrl }: Props) {
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
    () => getLocalizedArticleFields(resolvedArticle || {}, routeLocale, STRICT_LOCALE_POLICY),
    [resolvedArticle, routeLocale]
  );
  const rawTitle = cleanText(localized.title);
  const displayTitle = rawTitle.length > 180 ? `${rawTitle.slice(0, 177).trimEnd()}…` : rawTitle;
  const displaySummary = cleanText(localized.summary);

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
      policy: STRICT_LOCALE_POLICY,
    });
    if (!shouldReplaceArticleWithFreshCandidate(current, freshest, toRouteLocale(lang))) return;

    const localizedFreshest = getLocalizedArticleFields(freshest || {}, lang, STRICT_LOCALE_POLICY);
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

      const localizedNext = getLocalizedArticleFields(next || {}, lang, STRICT_LOCALE_POLICY);
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

    // SSR already delivered the freshest article for this locale, so only re-sync
    // when a publish actually happens instead of refetching on every mount.
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

  const heroSrc = resolveCoverImageUrl(resolvedArticle, { lang }) || null;
  const sponsoredMeta = React.useMemo(() => resolveSponsoredContentMeta(resolvedArticle, lang), [lang, resolvedArticle]);

  const prefix = React.useMemo(() => localePrefix(lang), [lang]);
  const categoryKey = React.useMemo(() => resolveCategoryKey(resolvedArticle), [resolvedArticle]);
  const categoryLabel = React.useMemo(() => categoryLabelFromKey(categoryKey), [categoryKey]);
  const displayCategoryLabel = React.useMemo(() => cleanText(localized.categoryLabel) || categoryLabel, [categoryLabel, localized.categoryLabel]);
  const editorialLabel = React.useMemo(() => (isEditorialArticle(resolvedArticle) ? getEditorialTypeLabel(resolvedArticle) : ''), [resolvedArticle]);
  const authorName = React.useMemo(() => getArticleAuthorName(resolvedArticle), [resolvedArticle]);
  const authorDesignation = React.useMemo(() => getArticleAuthorDesignation(resolvedArticle), [resolvedArticle]);
  const imageCaption = React.useMemo(() => getImageCaption(resolvedArticle, lang), [lang, resolvedArticle]);
  const imageCredit = React.useMemo(() => getImageCredit(resolvedArticle, lang), [lang, resolvedArticle]);
  const imageAltText = React.useMemo(() => cleanText(getImageAltText(resolvedArticle, lang)) || displayTitle, [displayTitle, lang, resolvedArticle]);
  const publishedDate = React.useMemo(() => cleanText((resolvedArticle as any)?.publishedAt), [resolvedArticle]);
  const updatedDate = React.useMemo(() => {
    const raw = cleanText((resolvedArticle as any)?.updatedAt || (resolvedArticle as any)?.modifiedAt);
    if (!raw || raw === publishedDate) return '';
    return raw;
  }, [publishedDate, resolvedArticle]);

  const homeHref = React.useMemo(() => (prefix ? prefix : '/'), [prefix]);
  const categoryHref = React.useMemo(() => (categoryKey ? `${prefix}/${categoryKey}`.replace(/\/\//g, '/') : ''), [categoryKey, prefix]);
  const sourceLang = React.useMemo(() => getArticleSourceLang(resolvedArticle) || pendingSourceLang || 'en', [pendingSourceLang, resolvedArticle]);
  const pendingSourceHref = React.useMemo(() => {
    const id = String((resolvedArticle as any)?._id || slug || '').trim();
    return buildNewsUrl({ id, slug: id, lang: sourceLang });
  }, [resolvedArticle, slug, sourceLang]);

  const categoryHeaderTitle = React.useMemo(() => {
    const langKey = toLanguageKey(lang);
    if (!categoryKey) return displayCategoryLabel;
    try {
      const out = tHeading(langKey as any, categoryKey as any);
      const text = String(out || '').trim();
      return text || displayCategoryLabel;
    } catch {
      return displayCategoryLabel;
    }
  }, [categoryKey, displayCategoryLabel]);

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
    return getArticleCanonicalUrl(resolvedArticle, lang, siteUrl);
  }, [lang, resolvedArticle, siteUrl]);
  const seoTitle = React.useMemo(() => getLocalizedSeoValue(resolvedArticle, lang, 'pageTitle', 'seoTitle', 'metaTitle', 'ogTitle', 'openGraphTitle', 'title') || displayTitle, [displayTitle, lang, resolvedArticle]);
  const seoDescription = React.useMemo(() => getLocalizedSeoValue(resolvedArticle, lang, 'metaDescription', 'seoDescription', 'ogDescription', 'openGraphDescription', 'socialDescription', 'description') || displaySummary, [displaySummary, lang, resolvedArticle]);
  const ogTitle = React.useMemo(() => getLocalizedSeoValue(resolvedArticle, lang, 'ogTitle', 'openGraphTitle') || seoTitle || displayTitle, [displayTitle, lang, resolvedArticle, seoTitle]);
  const ogDescription = React.useMemo(() => getLocalizedSeoValue(resolvedArticle, lang, 'ogDescription', 'openGraphDescription', 'socialDescription') || seoDescription, [lang, resolvedArticle, seoDescription]);
  const ogImage = React.useMemo(() => getLocalizedSeoValue(resolvedArticle, lang, 'ogImage', 'openGraphImage', 'image') || heroSrc || '', [heroSrc, lang, resolvedArticle]);
  const articleSeo = React.useMemo(() => buildArticleSeoMetadata(resolvedArticle, lang, siteUrl), [lang, resolvedArticle, siteUrl]);

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

  const articleTitleParts = React.useMemo(() => splitStoryTitleHook(displayTitle), [displayTitle]);
  const articleTitleHookColor = React.useMemo(
    () => getStoryTitleHookColor(displayCategoryLabel || (resolvedArticle as any)?.category || (resolvedArticle as any)?.section),
    [displayCategoryLabel, resolvedArticle]
  );

  return (
    <>
      <Head>
        <title>{`${(pendingTranslate && !displayTitle) ? 'Translating…' : (articleSeo?.title || seoTitle || displayTitle || 'News')} | News Pulse`}</title>
        {articleSeo?.description || seoDescription ? <meta name="description" content={articleSeo?.description || seoDescription} /> : null}
        {articleSeo?.robots ? <meta name="robots" content={articleSeo.robots} /> : null}
        <meta property="og:type" content="article" />
        {articleSeo?.ogTitle || ogTitle ? <meta property="og:title" content={articleSeo?.ogTitle || ogTitle} /> : null}
        {articleSeo?.ogDescription || ogDescription ? <meta property="og:description" content={articleSeo?.ogDescription || ogDescription} /> : null}
        {articleSeo?.ogUrl || canonicalUrl ? <meta property="og:url" content={articleSeo?.ogUrl || canonicalUrl} /> : null}
        {articleSeo?.ogImage || ogImage ? <meta property="og:image" content={articleSeo?.ogImage || ogImage} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        {articleSeo?.twitterTitle ? <meta name="twitter:title" content={articleSeo.twitterTitle} /> : null}
        {articleSeo?.twitterDescription ? <meta name="twitter:description" content={articleSeo.twitterDescription} /> : null}
        {articleSeo?.twitterImage ? <meta name="twitter:image" content={articleSeo.twitterImage} /> : null}
        {publishedDate ? <meta property="article:published_time" content={publishedDate} /> : null}
        {updatedDate ? <meta property="article:modified_time" content={updatedDate} /> : null}
        {authorName ? <meta name="author" content={authorName} /> : null}
        {articleSeo?.newsArticleJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSeo.newsArticleJsonLd) }} /> : null}
        {articleSeo?.breadcrumbJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSeo.breadcrumbJsonLd) }} /> : null}
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
                      <a href={categoryHref} className="hover:underline">{displayCategoryLabel}</a>
                    ) : (
                      <span>{displayCategoryLabel}</span>
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
                    {editorialLabel ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-newsPulse-blue/20 bg-newsPulse-blue/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-newsPulse-blue">
                          {editorialLabel}
                        </span>
                      </div>
                    ) : null}

                    {sponsoredMeta.isArticle ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-amber-800">
                          Sponsored
                        </span>
                        {sponsoredMeta.sponsorName ? (
                          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Presented with {sponsoredMeta.sponsorName}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                      {articleTitleParts.highlightedHook ? <span style={{ color: articleTitleHookColor }}>{articleTitleParts.highlightedHook}</span> : null}
                      {articleTitleParts.remainingTitle ? <span>{` ${articleTitleParts.remainingTitle}`}</span> : null}
                    </h1>

                    {pendingError ? <div className="text-sm text-red-600">{pendingError}</div> : null}

                    {pendingTranslate ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
                        <span>{`This article is being prepared in ${LANG_LABELS[lang]}.`}</span>
                        {sourceLang !== lang ? (
                          <a href={pendingSourceHref} className="underline underline-offset-2 hover:text-slate-900">
                            {`Read in ${LANG_LABELS[sourceLang]}`}
                          </a>
                        ) : null}
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
                        {authorName ? (
                          <div className="text-sm text-slate-800">
                            <span className="font-bold">By {authorName}</span>
                            {authorDesignation ? <span className="text-slate-500">, {authorDesignation}</span> : null}
                          </div>
                        ) : null}
                        <div className={authorName ? 'mt-1' : ''}>
                          {publishedDate ? <span>Published {formatEditorialDateTime(publishedDate)}</span> : null}
                          {publishedDate && updatedDate ? ' • ' : null}
                          {updatedDate ? <span>Updated {formatEditorialDateTime(updatedDate)}</span> : null}
                          {(publishedDate || updatedDate) && (displayProvider || displayGeneratedAt) ? ' • ' : null}
                          {displayProvider ? displayProvider : null}
                          {displayProvider && displayGeneratedAt ? ' • ' : null}
                          {displayGeneratedAt ? displayGeneratedAt : null}
                        </div>
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
                  <ArticleHeroImage
                    storyId={getStoryId(resolvedArticle)}
                    src={heroSrc}
                    fallbackSrc={COVER_PLACEHOLDER_SRC}
                    alt={imageAltText}
                    priority
                  />

                  {imageCaption || imageCredit ? (
                    <div className="mt-2 text-xs leading-5 text-slate-500">
                      {imageCaption ? <span>{imageCaption}</span> : null}
                      {imageCaption && imageCredit ? <span> • </span> : null}
                      {imageCredit ? <span>{imageCredit}</span> : null}
                    </div>
                  ) : null}

                  {displaySummary ? (
                    <p className="mt-4 text-base md:text-lg text-slate-700">
                      {displaySummary}
                    </p>
                  ) : null}

                  {sponsoredMeta.isArticle ? (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.98))] p-4 shadow-[0_16px_34px_-28px_rgba(180,83,9,0.35)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-amber-800">
                            Sponsor disclosure
                          </div>
                          <div className="mt-2 text-sm leading-6 text-slate-700">
                            {sponsoredMeta.sponsorDisclosure}
                          </div>
                          {sponsoredMeta.sponsorName ? (
                            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              Sponsor: {sponsoredMeta.sponsorName}
                            </div>
                          ) : null}
                        </div>

                        {sponsoredMeta.sponsorDestinationHref && sponsoredMeta.sponsorCtaLabel ? (
                          <a
                            href={sponsoredMeta.sponsorDestinationHref}
                            target={sponsoredMeta.sponsorDestinationIsExternal ? '_blank' : undefined}
                            rel={sponsoredMeta.sponsorDestinationIsExternal ? 'sponsored noopener noreferrer' : undefined}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800"
                          >
                            {sponsoredMeta.sponsorCtaLabel}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="px-4 md:px-6 pb-6">
                  <article lang={lang} className="article-body prose prose-slate max-w-none">
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
                      const localizedStory = getLocalizedArticleFields(s || {}, lang, STRICT_LOCALE_POLICY);
                      if (!localizedStory.isVisible) return null;
                      const href = id ? buildNewsUrl({ id, slug: localizedStory.slug || id, lang }) : '#';
                      const img = resolveCoverImageUrl(s, { lang }) || COVER_PLACEHOLDER_SRC;
                      const titleText = cleanText(localizedStory.title) || String(t('common.untitled') || 'Untitled').trim();
                      const excerpt = String(localizedStory.summary || '').trim();

                      debugStoryCard('article-related-grid', s, img);

                      return (
                        <RelatedStoryShell
                          key={getStoryReactKey(s, href)}
                          href={href}
                          className="group h-full rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 overflow-hidden"
                        >
                          <div className="flex h-full gap-3 p-3">
                            <StoryImage
                              storyId={id}
                              src={img}
                              alt={titleText}
                              variant="list"
                              className="border border-slate-200 bg-slate-100"
                            />
                            <div className="flex min-w-0 flex-1 flex-col justify-center">
                              <div className="min-h-[2.8rem] line-clamp-2 text-sm font-bold leading-5 text-slate-900 group-hover:underline">{titleText}</div>
                              {excerpt ? <div className="mt-1 min-h-[2.5rem] line-clamp-2 text-xs leading-5 text-slate-600">{excerpt}</div> : <div className="mt-1 min-h-[2.5rem]" />}
                            </div>
                          </div>
                        </RelatedStoryShell>
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
              <ArticleReadingSidebar />
            </aside>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .article-body {
          color: #1e293b;
        }

        .article-body :where(p, li) {
          font-size: 1.04rem;
          line-height: 1.9;
          overflow-wrap: anywhere;
        }

        .article-body :where(p) {
          margin: 0 0 1.05em;
        }

        .article-body :where(h2, h3) {
          color: #0f172a;
          font-weight: 700;
          line-height: 1.35;
          margin-top: 1.8em;
          margin-bottom: 0.7em;
        }

        .article-body :where(h2) {
          font-size: 1.45rem;
        }

        .article-body :where(h3) {
          font-size: 1.22rem;
        }

        .article-body :where(p strong, p b, li strong, li b) {
          color: #0f172a;
          font-weight: 600;
        }

        .article-body :where(ul, ol) {
          margin: 1em 0 1.15em;
          padding-inline-start: 1.4rem;
        }

        .article-body :where(ul) {
          list-style-type: disc;
        }

        .article-body :where(ol) {
          list-style-type: decimal;
        }

        .article-body :where(li) {
          margin: 0.3em 0;
          padding-inline-start: 0.2rem;
        }

        .article-body :where(li::marker) {
          color: #475569;
          font-weight: 600;
        }

        .article-body :where(li > p) {
          margin: 0;
        }

        .article-body :where(li > p + p) {
          margin-top: 0.45em;
        }

        .article-body :where(ul ul, ul ol, ol ul, ol ol) {
          margin-top: 0.45em;
          margin-bottom: 0.45em;
        }

        .article-body:lang(gu) :where(p, li),
        .article-body:lang(hi) :where(p, li) {
          line-height: 2;
        }
      `}</style>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const lang = normalizeLang(ctx.locale);
  const locale = String(ctx.locale || lang);
  const siteUrl = resolvePublicSiteUrl(ctx.req);
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
      props: { messages, locale, lang, slug: '', article: null, safeHtml: '', topStories: [], relatedStories: [], error: 'Not found', pending: false, siteUrl },
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
          pendingSourceLang: getPendingSourceLang(data),
          siteUrl,
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
      return { notFound: true };
    }

    const primaryArticleId = String((article as any)?._id || '').trim();

    // Secondary lists are not needed to render the article, so they run alongside
    // the translation-group lookup instead of after it.
    const relatedPromise = (async () => {
      try {
        const categoryKey = resolveCategoryQueryKey(article);
        const limit = 24;
        const relatedParams = new URLSearchParams();
        if (categoryKey) relatedParams.set('category', categoryKey);
        relatedParams.set('lang', lang);
        relatedParams.set('language', lang);
        relatedParams.set('strictLocale', '1');
        relatedParams.set('limit', String(limit));

        const endpoint = `${origin}/api/public/news?${relatedParams.toString()}`;
        const res = await fetch(endpoint, { method: 'GET', headers, cache: 'no-store' });
        const listData = await res.json().catch(() => null);
        const itemsRaw =
          Array.isArray(listData) ? listData :
          Array.isArray(listData?.items) ? listData.items :
          Array.isArray(listData?.articles) ? listData.articles :
          Array.isArray(listData?.data) ? listData.data :
          [];

        return Array.isArray(itemsRaw) ? (itemsRaw as Article[]) : [];
      } catch {
        return [] as Article[];
      }
    })();

    // NOTE: /api/public/news/slug/[slug] and /api/public/news/[id] already resolve the
    // translation group with the same locale + policy, so repeating it here only added
    // a second blocking round trip for an identical result.

    const localized = getLocalizedArticleFields(article, lang, STRICT_LOCALE_POLICY);
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
      const items = await relatedPromise;
      const currentId = String((resolvedArticle as any)?._id || '').trim();

      const filtered = items.filter((x) => {
        const id = String((x as any)?._id || '').trim();
        if (!id) return false;
        return id !== currentId && id !== primaryArticleId;
      });

      const top = [...filtered];
      top.sort((a, b) => (Number((b as any)?.reads || 0) || 0) - (Number((a as any)?.reads || 0) || 0));

      return {
        topStories: top.slice(0, 10),
        relatedStories: filtered.slice(0, 12),
      };
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
        siteUrl,
        seo: {
          canonicalUrl: getArticleCanonicalUrl(resolvedArticle, lang, siteUrl),
          alternates: getArticleAlternates(resolvedArticle, siteUrl),
        },
      },
    };
  } catch {
    return { notFound: true };
  }
};
