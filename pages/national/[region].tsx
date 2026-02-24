import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminContentLoader from '../../components/AdminContentLoader';
import { ALL_REGIONS } from '../../utils/india';
import { useLanguage } from '../../utils/LanguageContext';
import { getRegionName, tHeading, toLanguageKey } from '../../utils/localizedNames';
import type { GetStaticProps } from 'next';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle, type UiLang } from '../../lib/contentFallback';
import OriginalTag from '../../components/OriginalTag';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { buildNewsUrl } from '../../lib/newsRoutes';
import { localizeArticle } from '../../lib/localizeArticle';
import { resolveArticleSlug } from '../../lib/articleSlugs';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://newspulse-backend-real.onrender.com';

function normalizeLang(locale: unknown): 'en' | 'hi' | 'gu' {
  const v = String(locale || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

function normalize(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchRegion(article: any, regionName: string) {
  const n = normalize(regionName);
  const text = normalize(`${article.title || ''} ${article.excerpt || ''} ${article.content || ''} ${article.location || ''} ${(article.tags || []).join(' ')}`);
  if (!n) return false;
  return new RegExp(`(^|\n|\r|\s)${n}(\s|\n|\r|$)`).test(text) || text.includes(n);
}

export default function RegionPage(props: { lang: 'en' | 'hi' | 'gu'; data?: any[] | null }) {
  const router = useRouter();
  const { region } = router.query as { region?: string };
  const { language } = useLanguage();
  const { t } = useI18n();
  const effectiveLang = normalizeLang(router.locale || language || props.lang);
  const langKey = toLanguageKey(effectiveLang);

  const uiLang: UiLang = effectiveLang;

  const entry = ALL_REGIONS.find((r) => r.slug === region);
  const displayName = entry ? getRegionName(langKey, entry.type, entry.slug, entry.name) : 'Region';

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>{`${displayName} News — ${tHeading(langKey, 'national')} | News Pulse`}</title>
        <meta name="description" content={`Latest ${tHeading(langKey, 'national')} news related to ${displayName}.`} />
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold">🏛️ {displayName}</h1>
          <p className="text-gray-600">Stories filtered from {tHeading(langKey, 'national')}/{tHeading(langKey, 'regional')} feeds that reference this {entry?.type === 'state' ? tHeading(langKey, 'state').toLowerCase() : tHeading(langKey, 'union-territory').toLowerCase()}.</p>
        </div>

        <AdminContentLoader category="National" limit={80}>
          {({ news, loading }) => {
            // If National yields nothing, try Regional set
            const primary = entry ? news.filter((a) => matchRegion(a, entry.name)) : news;
            const display = primary;

            return (
              <div className="grid md:grid-cols-2 gap-6">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="p-6 rounded-2xl border shadow-sm animate-pulse bg-gray-50" />
                  ))
                ) : display.length ? (
                  display.map((article: any, idx: number) => {
                    const id = String(article?._id || article?.id || '').trim();
                    const slug = resolveArticleSlug(article, effectiveLang);
                    const href = id ? buildNewsUrl({ id, slug, lang: effectiveLang }) : '#';
                    return (
                    <a key={idx} href={href} className="block p-6 rounded-2xl border shadow-sm hover:shadow-md bg-white dark:bg-gray-800 transition">
                      <div className="text-xs text-gray-500 mb-2">{new Date(article.publishedAt).toLocaleString()}</div>
                      {(() => {
                        const titleRes = resolveArticleTitle(article, uiLang);
                        const summaryRes = resolveArticleSummaryOrExcerpt(article, uiLang);
                        const { title, content } = localizeArticle(article, effectiveLang);
                        const desc = summaryRes.text || (article.excerpt || (article.content ? String(article.content).slice(0, 160) + '...' : ''));
                        const safeTitle = title || titleRes.text || article.title || t('common.untitled');
                        return (
                          <>
                            <h3 className="font-bold text-lg mb-2">
                              {safeTitle}{' '}
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
                    <div className="col-span-2 text-gray-600">{t('regionalUI.noStoriesFoundForYet', { name: displayName })}</div>
                )}
              </div>
            );
          }}
        </AdminContentLoader>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const lang = normalizeLang(locale);
  try {
    const { getMessages } = await import('../../lib/getMessages');
    return {
      props: {
        lang,
        data: null,
        messages: await getMessages(lang),
      },
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('SSR national error', err);
    return {
      props: {
        lang,
        data: null,
        messages: {},
      },
    };
  }
};

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  };
}
