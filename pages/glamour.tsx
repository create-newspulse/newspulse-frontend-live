import Head from 'next/head';
import AdminContentLoader from '../components/AdminContentLoader';

export default function GlamourPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Glamour - News Pulse</title>
        <meta name="description" content="Glamour, entertainment, and celebrity updates." />
      </Head>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-6">✨ Glamour</h1>
        <AdminContentLoader category="Glamour" limit={20}>
          {({ news, loading }) => (
            <div className="grid md:grid-cols-2 gap-6">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-6 rounded-2xl border shadow-sm animate-pulse bg-gray-50"></div>
                ))
              ) : news.length ? (
                news.map((article: any, idx: number) => (
                  <a key={idx} href={`/news/${article._id || article.slug || '#'}`} className="block p-6 rounded-2xl border shadow-sm hover:shadow-md bg-white dark:bg-gray-800 transition">
                    <div className="text-xs text-gray-500 mb-2">{new Date(article.publishedAt).toLocaleString()}</div>
                    <h3 className="font-bold text-lg mb-2">{article.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{article.excerpt || article.content?.slice(0,140) + '...'}</p>
                  </a>
                ))
              ) : (
                <div className="col-span-2 text-gray-600">No glamour news available.</div>
              )}
            </div>
          )}
        </AdminContentLoader>
      </div>
    </div>
  );
}
