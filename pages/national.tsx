import Head from 'next/head';
import Link from 'next/link';
import type { GetStaticProps } from 'next';
import AdminContentLoader from '../components/AdminContentLoader';
import LanguageToggle from '../components/LanguageToggle';
import { useLanguage } from '../utils/LanguageContext';
import { tHeading } from '../utils/localizedNames';

export default function NationalNewsFeed() {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>{`${tHeading(language as any, 'national')} — News Feed | News Pulse`}</title>
        <meta name="description" content="Latest national headlines and top updates." />
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <LanguageToggle />
          <Link href="/national/states" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
            Browse states &amp; UTs →
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold">🏛️ National News Feed</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-300">Latest national headlines and top updates.</p>
        </div>

        <AdminContentLoader category="National" limit={40}>
          {({ news, loading }) => (
            <div className="grid md:grid-cols-2 gap-6">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="p-6 rounded-2xl border shadow-sm animate-pulse bg-gray-50" />
                ))
              ) : news.length ? (
                news.map((article: any, idx: number) => (
                  <a
                    key={idx}
                    href={article._id ? `/story/${article._id}` : '#'}
                    className="block p-6 rounded-2xl border shadow-sm hover:shadow-md bg-white dark:bg-gray-800 transition"
                  >
                    <div className="text-xs text-gray-500 mb-2">{new Date(article.publishedAt).toLocaleString()}</div>
                    <h3 className="font-bold text-lg mb-2">{article.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                      {article.excerpt || (article.content ? article.content.slice(0, 160) + '...' : '')}
                    </p>
                  </a>
                ))
              ) : (
                <div className="col-span-2 text-gray-600">No national news available.</div>
              )}
            </div>
          )}
        </AdminContentLoader>
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
