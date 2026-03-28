import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { getCategoryQueryKey, getCategoryRouteKey } from '../lib/categoryKeys';
import { fetchPublicNews, type Article } from '../lib/publicNewsApi';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY } from '../lib/localizedArticleFields';
import { useLanguage } from '../utils/LanguageContext';
import { useI18n } from '../src/i18n/LanguageProvider';
import { buildNewsUrl } from '../lib/newsRoutes';
import { COVER_PLACEHOLDER_SRC, resolveCoverImageUrl } from '../lib/coverImages';
import StoryImage from '../src/components/story/StoryImage';

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
                {filteredItems.map((a) => {
                  const id = String(a._id || '').trim();
                  const localized = getLocalizedArticleFields(a as any, language, STRICT_LOCALE_POLICY);
                  if (!localized.isVisible) return null;

                  const href = buildNewsUrl({ id, slug: localized.slug || id, lang: language });
                  const when = formatWhenLabel(a.publishedAt || a.createdAt);
                  const title = localized.title || t('categoryPage.untitled');
                  const summary = localized.summary;
                  const image = resolveCoverImageUrl(a) || COVER_PLACEHOLDER_SRC;

                  return (
                    <li key={a._id} className="group rounded-2xl border border-slate-200 bg-white overflow-hidden">
                      <StoryImage
                        src={image}
                        alt={title || t('categoryPage.articleImageAlt')}
                        variant="top"
                      />

                      <div className="p-4">
                        <Link href={href} className="block text-lg font-bold text-slate-900 hover:underline">
                          <span>{title}</span>
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
