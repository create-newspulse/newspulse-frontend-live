import Head from 'next/head';
import React from 'react';
import { useRouter } from 'next/router';
import { getGujaratCityName, getStateName, tHeading, toLanguageKey } from '../../../../utils/localizedNames';
import type { GetStaticProps } from 'next';
import { normalizeLang, useI18n } from '../../../../src/i18n/LanguageProvider';
import { buildNewsUrl } from '../../../../lib/newsRoutes';
import { resolveArticleSlug } from '../../../../lib/articleSlugs';
import { resolveCoverImageUrl } from '../../../../lib/coverImages';
import { getActiveRouteLang } from '../../../../utils/routeLang';
import { unwrapRegionalFeedItems } from '../../../../lib/unwrapRegionalFeed';
import { buildRegionalFeedSearchParams } from '../../../../lib/regionalFeedQuery';
import { StoryImage } from '../../../../src/components/story/StoryImage';

function normalize(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchCity(article: any, cityName: string) {
  const n = normalize(cityName);
  const text = normalize(`${article.title || ''} ${article.excerpt || ''} ${article.content || ''} ${article.location || ''} ${(article.tags || []).join(' ')}`);
  if (!n) return false;
  return new RegExp(`(^|\n|\r|\s)${n}(\s|\n|\r|$)`).test(text) || text.includes(n);
}

export default function GujaratCityPage() {
  const router = useRouter();
  const { city } = router.query as { city?: string };
  const { lang: i18nLang, t } = useI18n();

  const queryLang = (() => {
    const raw = (router.query as any)?.lang;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return String(value || '').trim();
  })();

  const active = getActiveRouteLang(router.asPath);
  const effectiveLang = normalizeLang(active || queryLang || router.locale || i18nLang || 'en');
  const langKey = React.useMemo(() => toLanguageKey(effectiveLang), [effectiveLang]);

  const [feed, setFeed] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const params = buildRegionalFeedSearchParams({ state: 'gujarat', lang: effectiveLang });
        const url = `/api/public/regional?${params.toString()}`;

        const res = await fetch(url, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`Failed to fetch regional feed (${res.status})`);

        const data = await res.json().catch(() => null);
        const items = unwrapRegionalFeedItems(data) as any[];

        if (!cancelled) setFeed(items);
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch regional feed', e);
        if (cancelled) return;
        setError(e?.message || t('regionalUI.failedToLoadStories'));
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [effectiveLang, refreshNonce, t]);

  const slug = (city || '').toString();
  const displayNameFallback = (slug || '').replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const displayName = getGujaratCityName(langKey, slug, displayNameFallback || tHeading(langKey, 'city'));
  const stateName = getStateName(langKey, 'gujarat', 'Gujarat');

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>{`${displayName} News – ${stateName} | News Pulse`}</title>
        <meta name="description" content={`Latest news from ${displayName}, ${stateName}.`} />
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {!!error && (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-800 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <div className="min-w-0">{error}</div>
            <button
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              className="shrink-0 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-950"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-extrabold">🏙️ {displayName} — {stateName}</h1>
          <p className="text-gray-600">
            {t('regionalCityPage.subtitle', {
              cityType: tHeading(langKey, 'city').toLowerCase(),
              regional: tHeading(langKey, 'regional'),
            })}
          </p>
        </div>

        {(() => {
          const filtered = city ? feed.filter((a) => matchCity(a as any, displayName)) : feed;
          return (
            <div className="grid md:grid-cols-2 gap-6">
              {loading && !filtered.length ? null : filtered.length ? (
                filtered.map((article: any, idx: number) => {
                  const id = String(article?._id || article?.id || '').trim();
                  const slug = resolveArticleSlug(article, effectiveLang);
                  const href = id ? buildNewsUrl({ id, slug, lang: effectiveLang }) : '#';
                  const coverUrl = resolveCoverImageUrl(article);
                  const title = String(article?.title || '').trim();
                  const summary = typeof article?.summary === 'string' ? article.summary.trim() : '';
                  return (
                  <a key={idx} href={href} className="group block rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md dark:bg-gray-800">
                    <div className="mb-3 flex items-start gap-3">
                      <StoryImage src={coverUrl} alt={title || ''} variant="mini" className="rounded-xl" />

                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-500 mb-2">{article.publishedAt ? new Date(article.publishedAt).toLocaleString() : ''}</div>
                        {!!title ? (
                          <h3 className="font-bold text-lg mb-2">{title}</h3>
                        ) : null}
                        {!!summary ? (
                          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{summary}</p>
                        ) : null}
                    <div className="mt-3 text-xs text-gray-400">{t('common.source')}: {article.source || t('brand.name')}</div>
                      </div>
                    </div>
                  </a>
                );
                })
              ) : (
                <div className="col-span-2 text-gray-600">
                  {error || t('regionalUI.noStoriesFoundTryBroader', { name: displayName, category: tHeading(langKey, 'regional') })}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../../../../lib/getMessages');
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
