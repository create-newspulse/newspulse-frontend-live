import Head from 'next/head';
import AdminContentLoader from '../components/AdminContentLoader';

export default function EditorialPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Editorial - News Pulse</title>
        <meta name="description" content="Opinions, editorials, and in-depth perspectives." />
      </Head>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-6">🖋️ Editorial</h1>
        <AdminContentLoader category="Editorial" limit={20}>
          {({ news, loading }) => (
            <div className="space-y-6">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-6 rounded-2xl border shadow-sm animate-pulse bg-gray-50"></div>
                ))
              ) : news.length ? (
                news.map((article: any, idx: number) => (
                  <a key={idx} href={`/news/${article._id || article.slug || '#'}`} className="block p-6 rounded-2xl border shadow-sm hover:shadow-md bg-white dark:bg-gray-800 transition">
                    <div className="text-xs text-gray-500 mb-2">{new Date(article.publishedAt).toLocaleString()}</div>
                    <h3 className="font-bold text-xl mb-2">{article.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-4">{article.excerpt || article.content?.slice(0,200) + '...'}</p>
                  </a>
                ))
              ) : (
                <div className="text-gray-600">No editorials available.</div>
              )}
            </div>
          )}
        </AdminContentLoader>
      </div>
    </div>
  );
}
