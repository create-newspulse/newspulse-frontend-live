import Head from 'next/head';
import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { fetchPublicNews, type Article } from '../lib/publicNewsApi';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle } from '../lib/contentFallback';
import { useLanguage } from '../utils/LanguageContext';
import { useI18n } from '../src/i18n/LanguageProvider';
import OriginalTag from './OriginalTag';

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

export default function CategoryFeedPage({ title, categoryKey, extraQuery }: CategoryFeedPageProps) {
  const { language } = useLanguage();
  const { t } = useI18n();
  const [items, setItems] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = useMemo(() => JSON.stringify(extraQuery || {}), [extraQuery]);

  const localizedTitle = useMemo(() => {
    const key = categoryKeyToI18nKey(categoryKey);
    return key ? t(key) : title;
  }, [categoryKey, t, title]);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setError(null);

    (async () => {
      const resp = await fetchPublicNews({
        category: String(categoryKey || ''),
        language,
        limit: 30,
        extraQuery: extraQuery || undefined,
        signal: controller.signal,
      });

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

    return () => {
      controller.abort();
    };
  }, [categoryKey, queryKey, language]);

  const isUnauthorized = typeof error === 'string' && /\b401\b/.test(error);
  return (
    <>
      <Head>
        <title>{`${localizedTitle} | ${t('brand.name')}`}</title>
      </Head>

      <main className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{localizedTitle}</h1>
            </div>
          </header>

          {error ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-800">
              <div className="text-base font-bold">{t('categoryPage.unableToLoadTitle')}</div>
              <div className="mt-1 text-sm">{error}</div>
              <div className="mt-3 text-sm text-slate-600">
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
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-lg font-semibold text-slate-900">{t('categoryPage.noStoriesYet')}</div>
            </div>
          ) : (
            <section className="mt-8">
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => {
                  // Prefer stable backend identifier; some backends don't support slug lookup
                  // (or may not support non-Latin slugs reliably).
                  const slugOrId = a._id || a.slug;
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
