// pages/news.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import type { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useLanguage } from '../utils/LanguageContext';

type NewsApiArticle = {
  _id?: string;
  slug?: string;
  title?: string;
  summary?: string;
  content?: string;
  provider?: string;
  generatedAt?: string;
};

function normalizeLang(v: unknown): 'en' | 'hi' | 'gu' {
  const s = String(v || '').toLowerCase().trim();
  if (s === 'hi' || s === 'hindi' || s === 'in') return 'hi';
  if (s === 'gu' || s === 'gujarati') return 'gu';
  return 'en';
}

export default function News() {
  const router = useRouter();
  const { language } = useLanguage();
  const [articles, setArticles] = useState<NewsApiArticle[]>([]);

  const lang = useMemo(() => normalizeLang((router as any)?.locale || language), [language, router]);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const params = new URLSearchParams();
        params.set('lang', lang);
        const url = `/api/public/news?${params.toString()}`;

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
            const title = String(raw?.title || '').trim() || undefined;
            const summary = String(raw?.summary || '').trim() || undefined;
            const content = typeof raw?.content === 'string' ? raw.content : undefined;
            const provider = String(raw?.provider || '').trim() || undefined;
            const generatedAt = String(raw?.generatedAt || '').trim() || undefined;
            const _id = String(raw?._id || '').trim() || undefined;
            const slug = String(raw?.slug || '').trim() || undefined;

            // Keep list items minimal: render only API-returned fields.
            if (!title) return null;
            return { _id, slug, title, summary, content, provider, generatedAt } as NewsApiArticle;
          })
          .filter(Boolean) as NewsApiArticle[];

        setArticles(mapped);
      } catch {
        setArticles([]);
      }
    };

    fetchNews();
  }, [lang]);

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
              <h2 className="text-xl font-semibold text-gray-800">
                {String(article.title || '').trim()}
              </h2>
              {article.provider || article.generatedAt ? (
                <p className="text-sm text-gray-500">
                  {article.provider ? String(article.provider) : ''}
                  {article.provider && article.generatedAt ? ' – ' : ''}
                  {article.generatedAt ? String(article.generatedAt) : ''}
                </p>
              ) : null}
              {article.summary ? (
                <p className="mt-2 text-gray-700">
                  {String(article.summary)}
                </p>
              ) : null}
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

