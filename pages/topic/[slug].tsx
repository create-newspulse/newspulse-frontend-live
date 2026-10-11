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
import { COVER_PLACEHOLDER_SRC, resolveCoverFitMode, resolveCoverImageUrl } from '../../lib/coverImages';
import { formatEditorialDateTime, resolveStoryDateIso } from '../../lib/storyDateTime';
import StoryImage from '../../src/components/story/StoryImage';
import { KeyStoryCard, type CategoryStoryHierarchyItem } from '../../components/category/CategoryStoryHierarchy';
import {
  editorialTopicPath,
  fetchEditorialTopic,
  fetchEditorialTopicStories,
  type EditorialTopicStory,
  type EditorialTopicSummary,
} from '../../lib/publicEditorialTopics';
import { normalizeRouteLocale, type RouteLocale } from '../../lib/localizedArticleFields';
import { getMessages } from '../../lib/getMessages';
import { absolutePublicUrl, NEWS_PULSE_PUBLISHER_NAME, removeUndefined, resolvePublicSiteUrl, safeJsonLd, type SeoAlternate } from '../../lib/seo';

export type TopicPageProps = {
  messages: Record<string, unknown>;
  locale: RouteLocale;
} & (
  | { mode: 'legacy' }
  | { mode: 'unavailable'; seo: { disableAlternates: true } }
  | {
    mode: 'editorial';
    topic: EditorialTopicSummary;
    pinnedArticle: CategoryStoryHierarchyItem | null;
    items: CategoryStoryHierarchyItem[];
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

export default function TopicPage(props: TopicPageProps) {
  const { t } = useI18n();
  if (props.mode === 'legacy') return <LegacyTopicPage />;
  if (props.mode === 'unavailable') return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Head>
        <title>{`${t('topicPage.title')} | ${t('brand.name')}`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <h1 className="text-2xl font-bold text-newsPulse-navy">{t('topicPage.unableToLoadStories')}</h1>
      <p className="mt-3 text-newsPulse-slate">{t('errors.fetchFailed')}</p>
    </main>
  );

  const { topic, locale, pinnedArticle, items, pagination, seo } = props;
  const path = (page: number) => editorialTopicPath(topic.slug, locale, page);
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
          {pinnedArticle ? (
            <section className="mt-8 max-w-2xl" aria-labelledby="topic-featured-story">
              <h2 id="topic-featured-story" className="mb-3 text-sm font-bold text-newsPulse-navy">{t('topicPage.featuredStory')}</h2>
              <KeyStoryCard item={pinnedArticle} locale={false} />
            </section>
          ) : null}
          {items.length ? (
            <section className="mt-8">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => <KeyStoryCard key={item.id} item={item} locale={false} />)}
              </div>
            </section>
          ) : !pinnedArticle ? (
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

function topicStoryCard(story: EditorialTopicStory): CategoryStoryHierarchyItem {
  const image = resolveCoverImageUrl(story, { lang: story.language }) || COVER_PLACEHOLDER_SRC;
  const dateIso = resolveStoryDateIso(story);
  return removeUndefined({
    id: story._id, title: story.title, titleText: story.title, summary: story.summary,
    href: buildNewsUrl({ id: story._id, slug: story.slug, lang: story.language }),
    imageSrc: image, imageFitMode: resolveCoverFitMode(story, { src: image, altText: story.title }),
    dateIso, dateLabel: formatEditorialDateTime(dateIso),
  });
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
    if (!detail) return { props: { ...common, mode: 'legacy' } };
    const rawPage = ctx.query.page;
    const page = rawPage === undefined ? 1
      : typeof rawPage === 'string' && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : NaN;
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) {
      return { redirect: { destination: editorialTopicPath(detail.topic.slug, locale), permanent: false } };
    }
    const stories = await fetchEditorialTopicStories(detail.topic.slug, locale, page);
    const pin = detail.pinnedArticle;
    const pinGroup = pin?.translationGroupId || pin?.translationKey;
    const items = stories.items.filter((story) => story._id !== pin?._id
      && (!pinGroup || (story.translationGroupId !== pinGroup && story.translationKey !== pinGroup)));
    const siteUrl = resolvePublicSiteUrl(ctx.req);
    const canonicalUrl = absolutePublicUrl(editorialTopicPath(detail.topic.slug, locale, page), siteUrl);
    const description = detail.topic.description[locale];
    const alternates: SeoAlternate[] = (['en', 'hi', 'gu'] as const).map((lang) => ({
      hrefLang: lang, href: absolutePublicUrl(editorialTopicPath(detail.topic.slug, lang, page), siteUrl),
    }));
    alternates.push({ hrefLang: 'x-default', href: alternates[0].href });
    return {
      props: {
        ...common, mode: 'editorial', topic: detail.topic,
        pinnedArticle: pin ? topicStoryCard(pin) : null, items: items.map(topicStoryCard),
        pagination: { page: stories.page, totalPages: stories.totalPages, hasNextPage: stories.hasNextPage },
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
