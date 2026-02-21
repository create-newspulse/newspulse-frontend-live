import Head from 'next/head';
import { useRouter } from 'next/router';
import { useRegionalPulse } from '../../../../features/regional/useRegionalPulse';
import { matchesCity } from '../../../../features/regional/api';
import { useLanguage } from '../../../../utils/LanguageContext';
import { getGujaratCityName, getStateName, tHeading } from '../../../../utils/localizedNames';
import type { GetStaticProps } from 'next';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle, type UiLang } from '../../../../lib/contentFallback';
import OriginalTag from '../../../../components/OriginalTag';
import { useI18n } from '../../../../src/i18n/LanguageProvider';
import { buildNewsUrl } from '../../../../lib/newsRoutes';

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
  const { language } = useLanguage();
  const { feed, loading } = useRegionalPulse();
  const { t } = useI18n();

  const uiLang: UiLang = (() => {
    const v = String(language || '').toLowerCase().trim();
    if (v === 'hi' || v === 'hindi') return 'hi';
    if (v === 'gu' || v === 'gujarati') return 'gu';
    return 'en';
  })();
  const slug = (city || '').toString();
  const displayNameFallback = (slug || '').replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  const displayName = getGujaratCityName(language as any, slug, displayNameFallback || 'City');
  const stateName = getStateName(language as any, 'gujarat', 'Gujarat');

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>{`${displayName} News – ${stateName} | News Pulse`}</title>
        <meta name="description" content={`Latest news from ${displayName}, ${stateName}.`} />
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold">🏙️ {displayName} — {stateName}</h1>
          <p className="text-gray-600">Local updates mentioning this {tHeading(language as any, 'city').toLowerCase()} filtered from {tHeading(language as any, 'regional')} feed.</p>
        </div>

        {(() => {
          const filtered = city ? feed.filter((a) => matchesCity(a as any, displayName)) : feed;
          return (
            <div className="grid md:grid-cols-2 gap-6">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="p-6 rounded-2xl border shadow-sm animate-pulse bg-gray-50" />
                ))
              ) : filtered.length ? (
                filtered.map((article: any, idx: number) => {
                  const id = String(article?._id || article?.id || '').trim();
                  const slug = String(article?.slug || id).trim();
                  const href = id ? buildNewsUrl({ id, slug, lang: language }) : '#';
                  return (
                  <a key={idx} href={href} className="block p-6 rounded-2xl border shadow-sm hover:shadow-md bg-white dark:bg-gray-800 transition">
                    <div className="text-xs text-gray-500 mb-2">{article.publishedAt ? new Date(article.publishedAt).toLocaleString() : ''}</div>
                    {(() => {
                      const titleRes = resolveArticleTitle(article, uiLang);
                      const summaryRes = resolveArticleSummaryOrExcerpt(article, uiLang);
                      const desc =
                        summaryRes.text ||
                        article.excerpt ||
                        (article.content ? String(article.content).slice(0, 160) + '...' : '');

                      return (
                        <>
                          <h3 className="font-bold text-lg mb-2">
                            {titleRes.text || article.title}{' '}
                            {titleRes.isOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                            {desc}
                            {summaryRes.isOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
                          </p>
                        </>
                      );
                    })()}
                    <div className="mt-3 text-xs text-gray-400">{t('common.source')}: {article.source || t('brand.name')}</div>
                  </a>
                );
                })
              ) : (
                <div className="col-span-2 text-gray-600">
                  {t('regionalUI.noStoriesFoundTryBroader', { name: displayName, category: tHeading(language as any, 'regional') })}
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
