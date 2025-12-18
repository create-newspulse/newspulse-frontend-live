import Head from 'next/head';
import Link from 'next/link';
import LanguageToggle from '../components/LanguageToggle';
import { STATES, UNION_TERRITORIES } from '../utils/india';
import { useLanguage } from '../utils/LanguageContext';
import { getRegionName, tHeading } from '../utils/localizedNames';
import type { GetStaticProps } from 'next';

export default function NationalOverview() {
  const { language } = useLanguage();
  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>{`${tHeading(language as any, 'national')} — ${tHeading(language as any, 'states')} & ${tHeading(language as any, 'union-territories')} | News Pulse`}</title>
        <meta name="description" content="Explore news by Indian states and union territories." />
      </Head>

      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-4">
          <LanguageToggle />
        </div>
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold">🏛️ {tHeading(language as any, 'national')}</h1>
          <p className="text-gray-600">Browse all 28 {tHeading(language as any, 'states').toLowerCase()} and 8 {tHeading(language as any, 'union-territories').toLowerCase()}.</p>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">{tHeading(language as any, 'states')}</h2>
          <input
            type="text"
            placeholder="Search state or UT..."
            className="border rounded-xl px-4 py-2 w-72"
            onChange={(e) => {
              const q = e.target.value.toLowerCase();
              document.querySelectorAll('[data-region]')?.forEach((el) => {
                const name = (el as HTMLElement).dataset.region || '';
                (el as HTMLElement).style.display = name.includes(q) ? '' : 'none';
              });
            }}
          />
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 mb-10">
          {STATES.map((r) => {
            const label = getRegionName(language as any, 'state', r.slug, r.name);
            const searchData = `${r.name.toLowerCase()} ${label.toLowerCase()} ${r.capital?.toLowerCase() || ''}`;
            return (
              <Link key={r.slug} href={`/national/${r.slug}`} className="group block bg-white dark:bg-gray-800 rounded-2xl border shadow-sm hover:shadow-md transition p-5" data-region={searchData}>
                <div className="text-3xl mb-2">🏳️</div>
                <div className="font-semibold text-lg group-hover:text-blue-600">{label}</div>
                <div className="text-xs text-gray-500">
                  {tHeading(language as any, 'state')}
                  {r.capital ? ` · Capital: ${r.capital}` : ''}
                </div>
              </Link>
            );
          })}
        </div>

        <h2 className="text-2xl font-bold mb-4">{tHeading(language as any, 'union-territories')}</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {UNION_TERRITORIES.map((r) => {
            const label = getRegionName(language as any, 'ut', r.slug, r.name);
            const searchData = `${r.name.toLowerCase()} ${label.toLowerCase()} ${r.capital?.toLowerCase() || ''}`;
            return (
              <Link key={r.slug} href={`/national/${r.slug}`} className="group block bg-white dark:bg-gray-800 rounded-2xl border shadow-sm hover:shadow-md transition p-5" data-region={searchData}>
                <div className="text-3xl mb-2">🏴</div>
                <div className="font-semibold text-lg group-hover:text-blue-600">{label}</div>
                <div className="text-xs text-gray-500">
                  {tHeading(language as any, 'union-territory')}
                  {r.capital ? ` · Capital: ${r.capital}` : ''}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};
