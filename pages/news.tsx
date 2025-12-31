// pages/news.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import type { GetStaticProps } from 'next';
import { getApiOrigin } from '../lib/publicNewsApi';

type NewsApiArticle = {
  title: string;
  description?: string;
  url?: string;
  publishedAt?: string;
  source?: { name?: string };
};

export default function News() {
  const [articles, setArticles] = useState<NewsApiArticle[]>([]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const origin = getApiOrigin();
        const params = new URLSearchParams({ category: 'national', limit: '5' });
        const url = `${origin}/api/public/news?${params.toString()}`;

        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        if (!res.ok) {
          setArticles([]);
          return;
        }

        const data = await res.json().catch(() => null);
        const list: unknown =
          (data && (data.items || data.articles || data.news || data.data)) ??
          (Array.isArray(data) ? data : []);

        const items = Array.isArray(list) ? (list as any[]) : [];
        const mapped: NewsApiArticle[] = items
          .map((raw) => {
            const title = String(raw?.title || '').trim();
            if (!title) return null;

            const slugOrId = raw?._id || raw?.id || raw?.slug;
            const href = slugOrId ? `/news/${encodeURIComponent(String(slugOrId))}` : undefined;

            return {
              title,
              description: String(raw?.summary || raw?.excerpt || '').trim() || undefined,
              url: href,
              publishedAt: String(raw?.publishedAt || raw?.createdAt || '').trim() || undefined,
              source: { name: String(raw?.source?.name || raw?.source || '').trim() || undefined },
            } as NewsApiArticle;
          })
          .filter(Boolean) as NewsApiArticle[];

        setArticles(mapped);
      } catch {
        setArticles([]);
      }
    };

    fetchNews();
  }, []);

  return (
    <>
      <Head>
        <title>Top News | News Pulse</title>
      </Head>

      <main className="min-h-screen p-6 bg-gray-100">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">🗞️ Top Headlines - India</h1>

        <div className="space-y-6">
          {articles.map((article, idx) => (
            <div
              key={idx}
              className="bg-white p-4 rounded-xl shadow-md border-l-4 border-blue-600 transition hover:shadow-lg"
            >
              <h2 className="text-xl font-semibold text-gray-800">{article.title}</h2>
              <p className="text-sm text-gray-500">{(article.source?.name || 'Unknown source')} – {new Date(article.publishedAt || '').toLocaleString()}</p>
              <p className="mt-2 text-gray-700">{article.description}</p>
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 mt-3 inline-block underline"
                >
                  Read more →
                </a>
              )}
            </div>
          ))}
        </div>
      </main>
    </>
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

