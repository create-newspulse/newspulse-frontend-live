// pages/news.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import type { GetStaticProps } from 'next';
import { getApiOrigin } from '../lib/publicNewsApi';
import { useLanguage } from '../utils/LanguageContext';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle, type UiLang } from '../lib/contentFallback';
import OriginalTag from '../components/OriginalTag';
import { buildNewsUrl } from '../lib/newsRoutes';
import { resolveArticleSlug } from '../lib/articleSlugs';

type NewsApiArticle = {
  title: string;
  titleIsOriginal?: boolean;
  description?: string;
  descriptionIsOriginal?: boolean;
  url?: string;
  publishedAt?: string;
  source?: { name?: string };
};

export default function News() {
  const { language } = useLanguage();
  const [articles, setArticles] = useState<NewsApiArticle[]>([]);

  const uiLang: UiLang = (() => {
    const v = String(language || '').toLowerCase().trim();
    if (v === 'hi' || v === 'hindi') return 'hi';
    if (v === 'gu' || v === 'gujarati') return 'gu';
    return 'en';
  })();

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const origin = getApiOrigin();
        const params = new URLSearchParams({ category: 'national', limit: '5' });
        params.set('lang', String(language));
        params.set('language', String(language));
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
            const titleRes = resolveArticleTitle(raw, uiLang);
            const title = String(titleRes.text || '').trim();
            if (!title) return null;

            const id = String(raw?._id || raw?.id || '').trim();
            const slug = resolveArticleSlug(raw, language);
            const href = id ? buildNewsUrl({ id, slug, lang: language }) : undefined;

            const summaryRes = resolveArticleSummaryOrExcerpt(raw, uiLang);
            const description = String(summaryRes.text || '').trim() || undefined;

            return {
              title,
              titleIsOriginal: titleRes.isOriginal,
              description,
              descriptionIsOriginal: summaryRes.isOriginal,
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
  }, [language]);

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
                {article.title} {article.titleIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
              </h2>
              <p className="text-sm text-gray-500">{(article.source?.name || 'Unknown source')} – {new Date(article.publishedAt || '').toLocaleString()}</p>
              {article.description ? (
                <p className="mt-2 text-gray-700">
                  {article.description} {article.descriptionIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
                </p>
              ) : null}
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

