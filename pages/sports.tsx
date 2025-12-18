import React from 'react';
import type { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};
// Removed duplicate default export to fix build
import Head from 'next/head';
import AdminContentLoader from '../components/AdminContentLoader';

export default function SportsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>Sports - News Pulse</title>
        <meta name="description" content="Latest sports news, scores, and highlights." />
      </Head>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-extrabold mb-6">⚽ Sports</h1>
        <AdminContentLoader category="Sports" limit={20}>
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
                <div className="col-span-2 text-gray-600">No sports news available.</div>
              )}
            </div>
          )}
        </AdminContentLoader>
      </div>
    </div>
  );
}
