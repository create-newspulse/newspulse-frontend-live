import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminContentLoader from '../../components/AdminContentLoader';
import LanguageToggle from '../../components/LanguageToggle';
import { ALL_REGIONS } from '../../utils/india';
import { useLanguage } from '../../utils/LanguageContext';
import { getRegionName, tHeading } from '../../utils/localizedNames';

function normalize(s: string) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchRegion(article: any, regionName: string) {
  const n = normalize(regionName);
  const text = normalize(`${article.title || ''} ${article.excerpt || ''} ${article.content || ''} ${article.location || ''} ${(article.tags || []).join(' ')}`);
  if (!n) return false;
  return new RegExp(`(^|\n|\r|\s)${n}(\s|\n|\r|$)`).test(text) || text.includes(n);
}

export default function RegionPage() {
  const router = useRouter();
  const { region } = router.query as { region?: string };
  const { language } = useLanguage();

  const entry = ALL_REGIONS.find((r) => r.slug === region);
  const displayName = entry ? getRegionName(language as any, entry.type, entry.slug, entry.name) : 'Region';

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>{`${displayName} News — ${tHeading(language as any, 'national')} | News Pulse`}</title>
        <meta name="description" content={`Latest ${tHeading(language as any, 'national')} news related to ${displayName}.`} />
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-4">
          <LanguageToggle />
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold">🏛️ {displayName}</h1>
          <p className="text-gray-600">Stories filtered from {tHeading(language as any, 'national')}/{tHeading(language as any, 'regional')} feeds that reference this {entry?.type === 'state' ? tHeading(language as any, 'state').toLowerCase() : tHeading(language as any, 'union-territory').toLowerCase()}.</p>
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
                  display.map((article: any, idx: number) => (
                    <a key={idx} href={`/news/${article._id || article.slug || '#'}`} className="block p-6 rounded-2xl border shadow-sm hover:shadow-md bg-white dark:bg-gray-800 transition">
                      <div className="text-xs text-gray-500 mb-2">{new Date(article.publishedAt).toLocaleString()}</div>
                      <h3 className="font-bold text-lg mb-2">{article.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{article.excerpt || article.content?.slice(0,160) + '...'}</p>
                      <div className="mt-3 text-xs text-gray-400">Source: {article.source || 'News Pulse'}</div>
                    </a>
                  ))
                ) : (
                  <div className="col-span-2 text-gray-600">No stories found for {displayName} yet.</div>
                )}
              </div>
            );
          }}
        </AdminContentLoader>
      </div>
    </div>
  );
}
