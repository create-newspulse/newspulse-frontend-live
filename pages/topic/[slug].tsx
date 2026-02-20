import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import type { GetStaticProps } from 'next';

import { fetchPublicNews, type Article } from '../../lib/publicNewsApi';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle } from '../../lib/contentFallback';
import OriginalTag from '../../components/OriginalTag';
import { useLanguage } from '../../utils/LanguageContext';
import { useI18n } from '../../src/i18n/LanguageProvider';

function formatWhenLabel(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function slugToQuery(slug: string) {
  const s = String(slug || '').trim();
  if (!s) return '';
  return s.replace(/[-_]+/g, ' ').trim();
}

export default function TopicPage() {
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
              <Link href="/search" className="text-blue-600 hover:underline">{t('common.search')}</Link>
              <span> · </span>
              <Link href="/" className="text-blue-600 hover:underline">{t('common.home')}</Link>
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
                  const slugOrId = a.slug || a._id;
                  const href = `/news/${encodeURIComponent(String(slugOrId))}`;
                  const when = formatWhenLabel(a.publishedAt || a.createdAt);
                  const titleRes = resolveArticleTitle(a as any, language);
                  const summaryRes = resolveArticleSummaryOrExcerpt(a as any, language);
                  const summary = summaryRes.text;
                  const image = a.imageUrl || a.image || '';

                  return (
                    <li key={a._id} className="group rounded-2xl border border-slate-200 bg-white overflow-hidden">
                      {image ? (
                        <div className="aspect-[16/9] bg-slate-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image}
                            alt={titleRes.text || t('categoryPage.articleImageAlt')}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          />
                        </div>
                      ) : null}

                      <div className="p-4">
                        <Link href={href} className="block text-lg font-bold text-slate-900 hover:underline">
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span>{titleRes.text || t('categoryPage.untitled')}</span>
                            {titleRes.isOriginal ? <OriginalTag /> : null}
                          </span>
                        </Link>

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

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  };
}
