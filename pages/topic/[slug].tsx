import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { fetchPublicNews, type Article } from '../../lib/publicNewsApi';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle } from '../../lib/contentFallback';
import OriginalTag from '../../components/OriginalTag';
import { useLanguage } from '../../utils/LanguageContext';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { buildNewsUrl, isNavigableNewsHref } from '../../lib/newsRoutes';
import { resolveArticleSlug } from '../../lib/articleSlugs';
import { getCategoryRouteKey } from '../../lib/categoryKeys';
import { COVER_PLACEHOLDER_SRC, resolveCoverFitMode, resolveCoverImageUrl } from '../../lib/coverImages';
import { formatEditorialDateTime, resolveStoryDateIso } from '../../lib/storyDateTime';
import StoryImage from '../../src/components/story/StoryImage';
import { KeyStoryCard, type CategoryStoryHierarchyItem } from '../../components/category/CategoryStoryHierarchy';
import {
  editorialTopicPath,
  fetchEditorialTopic,
  fetchEditorialTopicStories,
  type EditorialTopicDetail,
  type EditorialTopicStory,
  type EditorialTopicStoryPage,
  type EditorialTopicSummary,
} from '../../lib/publicEditorialTopics';
import { subscribePublicDataRefresh } from '../../lib/publicDataRefresh';
import { normalizeRouteLocale, type RouteLocale } from '../../lib/localizedArticleFields';
import { getMessages } from '../../lib/getMessages';
import { absolutePublicUrl, NEWS_PULSE_PUBLISHER_NAME, removeUndefined, resolvePublicSiteUrl, safeJsonLd, type SeoAlternate } from '../../lib/seo';

type EditorialStoryCard = CategoryStoryHierarchyItem & Pick<EditorialTopicStory, 'category' | 'translationKey' | 'translationGroupId'>;

export type TopicPageProps = {
  messages: Record<string, unknown>;
  locale: RouteLocale;
} & (
  | { mode: 'legacy' }
  | { mode: 'unavailable'; seo: { disableAlternates: true } }
  | {
    mode: 'editorial';
    topic: EditorialTopicSummary;
    pinnedArticle: EditorialStoryCard | null;
    items: EditorialStoryCard[];
    pagination: { page: number; totalPages: number; hasNextPage: boolean };
    seo: {
      title: string;
      description: string;
      canonicalUrl: string;
      alternates: SeoAlternate[];
      jsonLd: Record<string, unknown>;
    };
  }
);

function slugToQuery(slug: string) {
  const s = String(slug || '').trim();
  if (!s) return '';
  return s.replace(/[-_]+/g, ' ').trim();
}

function LegacyTopicPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const { t } = useI18n();

  const slug = typeof router.query.slug === 'string' ? router.query.slug : '';
  const explicitQ = typeof router.query.q === 'string' ? router.query.q : '';

  const q = useMemo(() => (explicitQ.trim() ? explicitQ.trim() : slugToQuery(slug)), [explicitQ, slug]);

  const [items, setItems] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setError(null);

    (async () => {
      if (!q) {
        setItems([]);
        setLoaded(true);
        return;
      }

      const resp = await fetchPublicNews({ q, language, limit: 30, signal: controller.signal });
      if (controller.signal.aborted) return;

      if (resp.error) {
        setError(resp.error);
        setItems([]);
        setLoaded(false);
        return;
      }

      setItems(Array.isArray(resp.items) ? resp.items : []);
      setLoaded(true);
    })().catch(() => {
      if (controller.signal.aborted) return;
      setError(t('errors.fetchFailed'));
      setItems([]);
      setLoaded(false);
    });

    return () => controller.abort();
  }, [language, q]);

  const title = q ? t('topicPage.titleWithQuery', { query: q }) : t('topicPage.title');

  return (
    <>
      <Head>
        <title>{`${title} | ${t('brand.name')}`}</title>
      </Head>

      <main className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <header className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{title}</h1>
            <div className="text-sm text-slate-600">
              <Link href="/search" className="text-newsPulse-blue hover:underline">{t('common.search')}</Link>
              <span> · </span>
              <Link href="/" className="text-newsPulse-blue hover:underline">{t('common.home')}</Link>
            </div>
          </header>

          {error ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-800">
              <div className="text-base font-bold">{t('topicPage.unableToLoadStories')}</div>
              <div className="mt-1 text-sm">{error}</div>
            </div>
          ) : loaded && items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-lg font-semibold text-slate-900">{t('topicPage.noStoriesYet')}</div>
            </div>
          ) : (
            <section className="mt-8">
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => {
                  const id = String(a._id || '').trim();
                  const slug = resolveArticleSlug(a, language);
                  const href = id ? buildNewsUrl({ id, slug, lang: language }) : '#';
                  const when = formatEditorialDateTime(resolveStoryDateIso(a as any));
                  const titleRes = resolveArticleTitle(a as any, language);
                  const summaryRes = resolveArticleSummaryOrExcerpt(a as any, language);
                  const summary = summaryRes.text;
                  const image = resolveCoverImageUrl(a) || COVER_PLACEHOLDER_SRC;
                  const fitMode = resolveCoverFitMode(a, { src: image, altText: titleRes.text });

                  return (
                    <li key={a._id} className="group rounded-2xl border border-slate-200 bg-white overflow-hidden">
                      <StoryImage
                        storyId={id}
                        src={image}
                        fitMode={fitMode}
                        alt={titleRes.text || t('categoryPage.articleImageAlt')}
                        variant="card"
                        className="border-b border-slate-200/70"
                      />

                      <div className="p-4">
                        {isNavigableNewsHref(href) ? (
                          <Link href={href} className="block text-lg font-bold text-slate-900 hover:underline">
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <span>{titleRes.text || t('categoryPage.untitled')}</span>
                              {titleRes.isOriginal ? <OriginalTag /> : null}
                            </span>
                          </Link>
                        ) : (
                          <div className="block text-lg font-bold text-slate-900">
                            <span className="inline-flex flex-wrap items-center gap-2">
                              <span>{titleRes.text || t('categoryPage.untitled')}</span>
                              {titleRes.isOriginal ? <OriginalTag /> : null}
                            </span>
                          </div>
                        )}

                        {summary ? (
                          <p
                            className="mt-2 text-sm text-slate-700"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            <span>{summary}</span>
                            {summaryRes.isOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
                          </p>
                        ) : null}

                        {when ? <div className="mt-3 text-xs font-medium text-slate-500">{when}</div> : null}
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

function UnavailableTopicPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Head>
        <title>{`${t('topicPage.title')} | ${t('brand.name')}`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <h1 className="text-2xl font-bold text-newsPulse-navy">{t('topicPage.unableToLoadStories')}</h1>
      <p className="mt-3 text-newsPulse-slate">{t('errors.fetchFailed')}</p>
    </main>
  );
}

type EditorialTopicPageProps = Extract<TopicPageProps, { mode: 'editorial' }>;
type EditorialArchive = Pick<EditorialTopicPageProps, 'topic' | 'pinnedArticle' | 'items' | 'pagination'>;

function EditorialTopicPage(props: EditorialTopicPageProps) {
  const { t } = useI18n();
  const { locale } = props;
  const initial = useMemo(() => ({
    topic: props.topic, pinnedArticle: props.pinnedArticle, items: props.items, pagination: props.pagination,
  }), [props.topic, props.pinnedArticle, props.items, props.pagination]);
  const [archive, setArchive] = useState<EditorialArchive | null>(initial);
  const [readError, setReadError] = useState(false);

  useEffect(() => {
    let active = true;
    let pending: AbortController | null = null;
    setArchive(initial);
    setReadError(false);
    const refresh = async () => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      try {
        const [detail, stories] = await Promise.allSettled([
          fetchEditorialTopic(initial.topic.slug, locale, controller.signal),
          fetchEditorialTopicStories(initial.topic.slug, locale, initial.pagination.page, controller.signal),
        ]);
        if (!active || controller.signal.aborted) return;
        if (detail.status === 'fulfilled' && !detail.value) {
          setArchive(null);
          setReadError(false);
          return;
        }
        const freshDetail = detail.status === 'fulfilled' ? detail.value : null;
        const freshStories = stories.status === 'fulfilled' ? stories.value : null;
        const pin = freshDetail?.pinnedArticle ? topicStoryCard(freshDetail.pinnedArticle) : null;
        const cards = freshStories?.items.map(topicStoryCard);
        const pagination = freshStories
          ? { page: freshStories.page, totalPages: freshStories.totalPages, hasNextPage: freshStories.hasNextPage }
          : null;
        for (const result of [detail, stories]) {
          if (result.status === 'rejected') console.error('[editorial-topics] Mounted archive unavailable', result.reason);
        }
        setArchive((previous) => {
          if (!previous && (!freshDetail || !freshStories)) return previous;
          const current = previous ?? initial;
          const pinnedArticle = freshDetail ? pin : current.pinnedArticle;
          return {
            topic: freshDetail?.topic ?? current.topic,
            pinnedArticle,
            // Retained cards have already excluded the old pin; a failed page read must not resurrect it.
            items: withoutPinnedStory(cards ?? current.items, pinnedArticle),
            pagination: pagination ?? current.pagination,
          };
        });
        setReadError(detail.status === 'rejected' || stories.status === 'rejected');
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        console.error('[editorial-topics] Mounted archive unavailable', error);
        setReadError(true);
      }
    };
    const unsubscribe = subscribePublicDataRefresh(() => { void refresh(); });
    return () => {
      active = false;
      pending?.abort();
      unsubscribe();
    };
  }, [initial, locale]);

  if (!archive) return <UnavailableTopicPage />;
  const { topic, pinnedArticle, items, pagination } = archive;
  const seo = {
    ...props.seo,
    title: `${topic.label} | News Pulse`,
    description: topic.description[locale],
    jsonLd: { ...props.seo.jsonLd, name: topic.label, description: topic.description[locale] },
  };
  const path = (page: number) => editorialTopicPath(topic.slug, locale, page);
  const renderStory = (item: EditorialStoryCard) => {
    const categoryKey = getCategoryRouteKey(item.category).replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    const labelKey = `categories.${categoryKey}`;
    const translated = categoryKey ? t(labelKey) : '';
    const label = translated && translated !== labelKey ? translated : item.category || undefined;
    return <KeyStoryCard key={item.id} item={{ ...item, label }} locale={false} />;
  };
  return (
    <>
      <Head>
        <title>{seo.title}</title>
        {seo.description ? <meta name="description" content={seo.description} /> : null}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={seo.title} />
        {seo.description ? <meta property="og:description" content={seo.description} /> : null}
        <meta property="og:url" content={seo.canonicalUrl} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(seo.jsonLd) }} />
      </Head>
      <main className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <header className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{topic.label}</h1>
            {topic.description[locale] ? <p className="max-w-3xl whitespace-pre-line text-slate-600">{topic.description[locale]}</p> : null}
            <div className="text-sm text-slate-600">
              <Link href="/search" className="text-newsPulse-blue hover:underline">{t('common.search')}</Link>
              <span> · </span>
              <Link href="/" className="text-newsPulse-blue hover:underline">{t('common.home')}</Link>
            </div>
          </header>
          {readError ? (
            <div role="alert" className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-800">
              <p>{t('topicPage.unableToLoadStories')}</p>
              <p className="mt-1 text-sm">{t('errors.showingPreviousStories')}</p>
            </div>
          ) : null}
          {pinnedArticle ? (
            <section className="mt-8 max-w-2xl" aria-labelledby="topic-featured-story">
              <h2 id="topic-featured-story" className="mb-3 text-sm font-bold text-newsPulse-navy">{t('topicPage.featuredStory')}</h2>
              {renderStory(pinnedArticle)}
            </section>
          ) : null}
          {items.length ? (
            <section className="mt-8">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(renderStory)}
              </div>
            </section>
          ) : !pinnedArticle && !readError ? (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-lg font-semibold text-slate-900">{t('topicPage.noStoriesYet')}</div>
            </div>
          ) : null}
          {pagination.page > 1 || pagination.hasNextPage ? (
            <nav aria-label={t('topicPage.pagination')} className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 text-sm font-semibold">
              {pagination.page > 1 ? (
                <Link href={path(pagination.page - 1)} locale={false} className="inline-flex items-center gap-2 text-newsPulse-blue hover:underline">
                  <ArrowLeft size={18} aria-hidden="true" />{t('topicPage.previous')}
                </Link>
              ) : <span />}
              <span>{t('topicPage.page')} {pagination.page}{pagination.totalPages >= pagination.page ? ` / ${pagination.totalPages}` : ''}</span>
              {pagination.hasNextPage ? (
                <Link href={path(pagination.page + 1)} locale={false} className="inline-flex items-center gap-2 text-newsPulse-blue hover:underline">
                  {t('topicPage.next')}<ArrowRight size={18} aria-hidden="true" />
                </Link>
              ) : <span />}
            </nav>
          ) : null}
        </div>
      </main>
    </>
  );
}

export default function TopicPage(props: TopicPageProps) {
  if (props.mode === 'legacy') return <LegacyTopicPage />;
  if (props.mode === 'unavailable') return <UnavailableTopicPage />;
  return <EditorialTopicPage key={`${props.locale}:${props.topic.slug}:${props.pagination.page}`} {...props} />;
}

function topicStoryCard(story: EditorialTopicStory): EditorialStoryCard {
  const image = resolveCoverImageUrl(story, { lang: story.language }) || COVER_PLACEHOLDER_SRC;
  const dateIso = resolveStoryDateIso(story);
  return removeUndefined({
    id: story._id, title: story.title, titleText: story.title, summary: story.summary,
    href: buildNewsUrl({ id: story._id, slug: story.slug, lang: story.language }),
    imageSrc: image, imageFitMode: resolveCoverFitMode(story, { src: image, altText: story.title }),
    dateIso, dateLabel: formatEditorialDateTime(dateIso),
    category: story.category,
    translationKey: story.translationKey, translationGroupId: story.translationGroupId,
  });
}

function withoutPinnedStory(items: EditorialStoryCard[], pin: EditorialStoryCard | null): EditorialStoryCard[] {
  const ids = new Set(pin ? [pin.id] : []);
  const groups = new Set([pin?.translationGroupId, pin?.translationKey].filter((key): key is string => Boolean(key)));
  return items.filter((story) => {
    const keys = [story.translationGroupId, story.translationKey].filter((key): key is string => Boolean(key));
    const duplicate = ids.has(story.id) || keys.some((key) => groups.has(key));
    ids.add(story.id);
    keys.forEach((key) => groups.add(key));
    return !duplicate;
  });
}

function editorialArchive(detail: EditorialTopicDetail, stories: EditorialTopicStoryPage): EditorialArchive {
  const pinnedArticle = detail.pinnedArticle ? topicStoryCard(detail.pinnedArticle) : null;
  return {
    topic: detail.topic,
    pinnedArticle,
    items: withoutPinnedStory(stories.items.map(topicStoryCard), pinnedArticle),
    pagination: { page: stories.page, totalPages: stories.totalPages, hasNextPage: stories.hasNextPage },
  };
}

export const getServerSideProps: GetServerSideProps<TopicPageProps> = async (ctx) => {
  const locale = normalizeRouteLocale(ctx.locale);
  const common = { locale, messages: await getMessages(locale) };
  ctx.res.setHeader('Cache-Control', 'no-store');
  // Existing article tag links explicitly use q and must not change meaning.
  if ('q' in ctx.query) return { props: { ...common, mode: 'legacy' } };
  const slug = ctx.params?.slug;
  if (typeof slug !== 'string' || !slug) return { notFound: true };

  try {
    const detail = await fetchEditorialTopic(slug, locale);
    if (!detail) return { notFound: true };
    const rawPage = ctx.query.page;
    const page = rawPage === undefined ? 1
      : typeof rawPage === 'string' && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : NaN;
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
      return { redirect: { destination: editorialTopicPath(detail.topic.slug, locale), permanent: false } };
    }
    const stories = await fetchEditorialTopicStories(detail.topic.slug, locale, page);
    const siteUrl = resolvePublicSiteUrl(ctx.req);
    const canonicalUrl = absolutePublicUrl(editorialTopicPath(detail.topic.slug, locale, page), siteUrl);
    const description = detail.topic.description[locale];
    const alternates: SeoAlternate[] = (['en', 'hi', 'gu'] as const).map((lang) => ({
      hrefLang: lang, href: absolutePublicUrl(editorialTopicPath(detail.topic.slug, lang, page), siteUrl),
    }));
    alternates.push({ hrefLang: 'x-default', href: alternates[0].href });
    return {
      props: {
        ...common, mode: 'editorial', ...editorialArchive(detail, stories),
        seo: {
          title: `${detail.topic.label} | News Pulse`, description, canonicalUrl, alternates,
          jsonLd: removeUndefined({
            '@context': 'https://schema.org', '@type': 'CollectionPage', name: detail.topic.label,
            description, url: canonicalUrl, inLanguage: locale,
            publisher: { '@type': 'Organization', name: NEWS_PULSE_PUBLISHER_NAME, url: siteUrl },
          }),
        },
      },
    };
  } catch (error) {
    console.error('[editorial-topics] Topic archive unavailable', error);
    ctx.res.statusCode = 503;
    ctx.res.setHeader('Retry-After', '60');
    return { props: { ...common, mode: 'unavailable', seo: { disableAlternates: true } } };
  }
};
