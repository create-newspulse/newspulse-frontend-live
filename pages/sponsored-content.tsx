import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { getCategoryIdentity } from '../lib/categoryKeys';
import { resolveCoverFitMode, resolveCoverImageUrl } from '../lib/coverImages';
import { getMessages } from '../lib/getMessages';
import { getLocalizedArticleFields, normalizeRouteLocale, STRICT_LOCALE_POLICY, type RouteLocale } from '../lib/localizedArticleFields';
import { buildNewsUrl } from '../lib/newsRoutes';
import { subscribePublicDataRefresh } from '../lib/publicDataRefresh';
import {
  fetchSponsoredNewsPage, parseSponsoredPageNumber, sponsoredContentPath, SponsoredNewsReadError,
  SPONSORED_NEWS_INVALID_RESPONSE, type SponsoredNewsPage,
} from '../lib/publicSponsoredNews';
import { absolutePublicUrl, resolvePublicSiteUrl, type SeoAlternate } from '../lib/seo';
import { resolveSponsoredContentMeta } from '../lib/sponsoredContent';
import { formatEditorialDateTime } from '../lib/storyDateTime';
import StoryImage from '../src/components/story/StoryImage';
import { useI18n } from '../src/i18n/LanguageProvider';

export type SponsoredContentPageProps = {
  locale: RouteLocale;
  messages: Record<string, unknown>;
  requestedPage: number;
  initialPage: SponsoredNewsPage | null;
  seo: { canonicalUrl: string; alternates: SeoAlternate[] };
};

function SponsoredArchive({ locale, requestedPage, initialPage, seo }: SponsoredContentPageProps) {
  const { lang, t } = useI18n();
  const [data, setData] = useState(initialPage);
  const [readError, setReadError] = useState(initialPage === null);
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const matchingLocale = lang === locale;

  const refresh = useCallback(async () => {
    if (!matchingLocale) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    try {
      const next = await fetchSponsoredNewsPage(locale, requestedPage, controller.signal);
      if (controller.signal.aborted) return;
      setData(next);
      setReadError(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('[sponsored-content] Archive read failed', error instanceof Error ? error.message : 'Unknown read failure');
      setReadError(true);
      // A contract violation can reveal withdrawn or otherwise unsafe records.
      if (error instanceof SponsoredNewsReadError && error.code === SPONSORED_NEWS_INVALID_RESPONSE) setData(null);
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setLoading(false);
      }
    }
  }, [locale, requestedPage, matchingLocale]);

  useEffect(() => {
    setData(initialPage);
    setReadError(initialPage === null);
    setLoading(false);
    const unsubscribe = matchingLocale ? subscribePublicDataRefresh(() => { void refresh(); }) : () => {};
    return () => {
      pending.current?.abort();
      pending.current = null;
      unsubscribe();
    };
  }, [initialPage, matchingLocale, refresh]);

  const title = t('sponsoredContent.title');
  const description = t('sponsoredContent.description');
  const visiblePage = matchingLocale ? data : null;
  const isSingleArticle = visiblePage?.items.length === 1;
  const busy = loading || !matchingLocale;
  const controlClass = 'inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-newsPulse-blue focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-newsPulse-blue dark:border-slate-700 dark:text-sky-300';

  return (
    <>
      <Head>
        <title>{`${title} | News Pulse`}</title>
        <meta name="description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={`${title} | News Pulse`} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={seo.canonicalUrl} />
        {readError ? <meta name="robots" content="noindex, follow" /> : null}
      </Head>
      <main className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
            <p className="max-w-3xl text-slate-600 dark:text-slate-300">{description}</p>
          </header>
          {readError && matchingLocale ? (
            <div role="alert" className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
              <p className="font-semibold">{t('sponsoredContent.error')}</p>
              {visiblePage?.items.length ? <p className="mt-1 text-sm">{t('sponsoredContent.previousContent')}</p> : null}
              <button type="button" className={`${controlClass} mt-3 disabled:opacity-50`} disabled={loading} onClick={() => { void refresh(); }}>
                {t('sponsoredContent.retry')}
              </button>
            </div>
          ) : null}
          {busy ? (
            <div role="status" className="mt-6 text-sm text-slate-600 dark:text-slate-300">
              <p>{t('sponsoredContent.loading')}</p>
              {!visiblePage ? (
                <div aria-hidden="true" className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {[0, 1, 2].map((key) => <div key={key} className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}
                </div>
              ) : null}
            </div>
          ) : null}
          {visiblePage ? (
            <section className="mt-8" aria-label={title} aria-busy={loading}>
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">{t('sponsoredContent.count', { count: visiblePage.total })}</p>
              <ul className={`grid gap-6 ${isSingleArticle ? 'mx-auto max-w-5xl' : 'sm:grid-cols-2'} ${visiblePage.items.length > 2 ? 'lg:grid-cols-3' : ''}`}>
                {visiblePage.items.map((article) => {
                  const fields = getLocalizedArticleFields(article, locale, STRICT_LOCALE_POLICY);
                  const category = getCategoryIdentity(article.category);
                  const labelKey = `categories.${category.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())}`;
                  const translated = t(labelKey);
                  const categoryLabel = translated !== labelKey ? translated : typeof article.category === 'string' ? article.category : category;
                  const sponsor = resolveSponsoredContentMeta(article, locale);
                  const image = resolveCoverImageUrl(article, { lang: locale });
                  const date = formatEditorialDateTime(article.publishedAt);
                  return (
                    <li key={article._id} className="min-w-0">
                      <article className={`flex h-full min-w-0 flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-700 dark:bg-slate-900 ${isSingleArticle && image ? 'md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center md:gap-8' : ''}`}>
                        {image ? <StoryImage storyId={article._id} src={image} alt={fields.title} variant="card" fitMode={isSingleArticle ? 'contain' : resolveCoverFitMode(article, { src: image, altText: fields.title })} className="min-w-0" /> : null}
                        <div className="flex min-w-0 flex-1 flex-col break-words">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                            <span className="max-w-full rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 dark:bg-amber-950 dark:text-amber-200">{t('sponsoredContent.label')}</span>
                            <span className="max-w-full text-newsPulse-blue dark:text-sky-300">{categoryLabel}</span>
                          </div>
                          <h2 className={`mt-3 break-words font-bold leading-relaxed ${isSingleArticle ? 'text-xl sm:text-2xl' : 'text-xl'}`}>
                            <Link href={buildNewsUrl({ id: article._id, slug: article.slug, lang: locale })} locale={false} prefetch={false} className="block min-h-[44px] py-1 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-newsPulse-blue">
                              {fields.title}
                            </Link>
                          </h2>
                          {fields.summary ? <p className="mt-2 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{fields.summary}</p> : null}
                          {sponsor.sponsorName || date ? (
                            <div className="mt-auto space-y-2 pt-4">
                              {sponsor.sponsorName ? <p className="break-words text-sm font-semibold text-amber-800 dark:text-amber-200">{t('sponsoredContent.sponsoredBy', { sponsor: sponsor.sponsorName })}</p> : null}
                              {date ? <time dateTime={article.publishedAt} className="block text-xs text-slate-500 dark:text-slate-400">{date}</time> : null}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
              {!visiblePage.items.length && !readError && !loading ? (
                <p className="rounded-2xl border border-slate-200 p-6 dark:border-slate-700">{t(visiblePage.total ? 'sponsoredContent.emptyPage' : 'sponsoredContent.empty')}</p>
              ) : null}
              {visiblePage.totalPages > 1 ? <nav aria-label={t('sponsoredContent.pagination')} className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 text-sm font-semibold dark:border-slate-700">
                {visiblePage.page > 1 ? (
                  <Link href={sponsoredContentPath(locale, Math.max(1, Math.min(visiblePage.page - 1, visiblePage.totalPages)))} locale={false} prefetch={false} rel="prev" className={controlClass} aria-label={t('sponsoredContent.previous')}>
                    <ArrowLeft size={18} aria-hidden="true" />{t('sponsoredContent.previous')}
                  </Link>
                ) : <button type="button" disabled className={`${controlClass} opacity-50`}><ArrowLeft size={18} aria-hidden="true" />{t('sponsoredContent.previous')}</button>}
                <span aria-current="page">{visiblePage.totalPages > 0
                  ? t('sponsoredContent.pageOf', { page: visiblePage.page, totalPages: visiblePage.totalPages })
                  : t('sponsoredContent.page', { page: visiblePage.page })}</span>
                {visiblePage.page < visiblePage.totalPages ? (
                  <Link href={sponsoredContentPath(locale, visiblePage.page + 1)} locale={false} prefetch={false} rel="next" className={controlClass} aria-label={t('sponsoredContent.next')}>
                    {t('sponsoredContent.next')}<ArrowRight size={18} aria-hidden="true" />
                  </Link>
                ) : <button type="button" disabled className={`${controlClass} opacity-50`}>{t('sponsoredContent.next')}<ArrowRight size={18} aria-hidden="true" /></button>}
              </nav> : null}
            </section>
          ) : null}
        </div>
      </main>
    </>
  );
}

export default function SponsoredContentPage(props: SponsoredContentPageProps) {
  return <SponsoredArchive key={`${props.locale}:${props.requestedPage}`} {...props} />;
}

export const getServerSideProps: GetServerSideProps<SponsoredContentPageProps> = async (ctx) => {
  const locale = normalizeRouteLocale(ctx.locale);
  ctx.res.setHeader('Cache-Control', 'no-store, max-age=0');
  const requestedPage = parseSponsoredPageNumber(ctx.query.page);
  if (!requestedPage) return { redirect: { destination: sponsoredContentPath(locale), permanent: false } };
  const siteUrl = resolvePublicSiteUrl(ctx.req);
  const alternates: SeoAlternate[] = (['gu', 'hi', 'en'] as const).map((lang) => ({
    hrefLang: lang, href: absolutePublicUrl(sponsoredContentPath(lang, requestedPage), siteUrl),
  }));
  alternates.push({ hrefLang: 'x-default', href: absolutePublicUrl(sponsoredContentPath('en', requestedPage), siteUrl) });
  let initialPage: SponsoredNewsPage | null = null;
  try {
    initialPage = await fetchSponsoredNewsPage(locale, requestedPage);
    if (requestedPage > Math.max(1, initialPage.totalPages)) {
      return { redirect: { destination: sponsoredContentPath(locale, Math.max(1, initialPage.totalPages)), permanent: false } };
    }
  } catch (error) {
    console.error('[sponsored-content] Initial archive unavailable', error instanceof Error ? error.message : 'Unknown read failure');
    ctx.res.statusCode = 503;
    ctx.res.setHeader('Retry-After', error instanceof SponsoredNewsReadError && error.retryAfter ? error.retryAfter : '60');
  }
  return {
    props: {
      locale, messages: await getMessages(locale), requestedPage, initialPage,
      seo: { canonicalUrl: absolutePublicUrl(sponsoredContentPath(locale, requestedPage), siteUrl), alternates },
    },
  };
};
