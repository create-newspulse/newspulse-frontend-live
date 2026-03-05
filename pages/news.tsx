// pages/news.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
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
  translationStatus?: string;
};

const AUTO_REFRESH_MS = 45_000;
const EXPECTED_VISIBLE_COUNT = 10;
const PLACEHOLDER_MIN = 3;
const PLACEHOLDER_MAX = 5;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function TranslationPlaceholderCard() {
  return (
    <div
      className="bg-white p-4 rounded-xl shadow-md border border-slate-200"
    >
      <div className="text-sm font-semibold text-slate-700">Translation in progress</div>
      <div className="mt-3 h-4 w-3/4 rounded bg-slate-100" />
      <div className="mt-2 h-4 w-5/6 rounded bg-slate-100" />
    </div>
  );
}

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
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

  const lang = useMemo(() => normalizeLang((router as any)?.locale || language), [language, router]);

  useEffect(() => {
    let cancelled = false;

    const fetchNews = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('lang', lang);
        params.set('language', lang);
        params.set('limit', '20');

        const url = `/api/public/news?${params.toString()}`;

        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        if (!res.ok) {
          if (!cancelled) setArticles([]);
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
            const translationStatus = String(raw?.translationStatus || '').trim() || undefined;
            const _id = String(raw?._id || '').trim() || undefined;
            const slug = String(raw?.slug || '').trim() || undefined;

            // Keep list items minimal: render only API-returned fields.
            if (!title) return null;
            return {
              _id,
              slug,
              title,
              summary,
              content,
              provider,
              generatedAt,
              translationStatus,
            } as NewsApiArticle;
          })
          .filter(Boolean) as NewsApiArticle[];

        if (!cancelled) setArticles(mapped);
      } catch {
        if (!cancelled) setArticles([]);
      } finally {
        inFlightRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };

    fetchNews();
    const id = window.setInterval(fetchNews, AUTO_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [lang]);

  const placeholderCount = useMemo(() => {
    if (loading) return 0;
    if (articles.length >= EXPECTED_VISIBLE_COUNT) return 0;
    return clamp(EXPECTED_VISIBLE_COUNT - articles.length, PLACEHOLDER_MIN, PLACEHOLDER_MAX);
  }, [articles.length, loading]);

  return (
    <>
      <Head>
        <title>Top News | News Pulse</title>
      </Head>

      <main className="min-h-screen p-6 bg-gray-100">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">🗞️ Top Headlines - India</h1>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          Translating new stories… auto refresh
        </div>

        <div className="space-y-6">
          {articles.map((article, idx) => (
            <div
              key={idx}
              className="bg-white p-4 rounded-xl shadow-md border-l-4 border-blue-600 transition hover:shadow-lg"
            >
              <h2 className="text-xl font-semibold text-gray-800">
                {String(article.title || '').trim()}
              </h2>
              {lang === 'gu' && article.translationStatus ? (
                <div className="mt-2">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {String(article.translationStatus)}
                  </span>
                </div>
              ) : null}
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

          {Array.from({ length: placeholderCount }).map((_, i) => (
            <TranslationPlaceholderCard key={`translation-placeholder-${i}`} />
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

