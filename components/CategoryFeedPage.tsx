import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Article } from '../lib/publicNewsApi';

export type CategoryFeedPageProps = {
  title: string;
  categoryKey: string;
  extraQuery?: Record<string, string>;
};

function formatWhenLabel(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export default function CategoryFeedPage({ title, categoryKey, extraQuery }: CategoryFeedPageProps) {
  const [items, setItems] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = useMemo(() => JSON.stringify(extraQuery || {}), [extraQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(null);

    const origin = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:5000';
    const params = new URLSearchParams({
      category: String(categoryKey || ''),
      limit: '30',
      ...(extraQuery || {}),
    });
    const url = `${origin.replace(/\/$/, '')}/api/public/news?${params.toString()}`;

    const run = async () => {
      try {
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        if (!res.ok) {
          if (!cancelled) {
            setError(`Request failed (${res.status})`);
            setItems([]);
            setLoaded(true);
          }
          return;
        }

        const data = await res.json().catch(() => null);
        const list: unknown =
          (data && (data.items || data.articles || data.news || data.data)) ??
          (Array.isArray(data) ? data : []);

        const nextItems = Array.isArray(list) ? (list as Article[]) : [];

        if (!cancelled) {
          setItems(nextItems);
          setLoaded(true);
        }
      } catch {
        // Spec: only show error when res.ok is false.
        if (!cancelled) {
          setItems([]);
          setLoaded(true);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [categoryKey, queryKey]);

  const isUnauthorized = typeof error === 'string' && /\b401\b/.test(error);
  return (
    <>
      <Head>
        <title>{`${title} | News Pulse`}</title>
      </Head>

      <main className="min-h-screen bg-white">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <header className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          </header>

          {error ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-800">
              <div className="text-base font-bold">Unable to load articles</div>
              <div className="mt-1 text-sm">{error}</div>
              <div className="mt-3 text-sm text-slate-600">
                {isUnauthorized ? (
                  <>
                    Public feed endpoint is protected. Backend must allow GET /api/public/news without auth.
                  </>
                ) : (
                  <>
                    Ensure the backend is running and set <span className="font-semibold">NEXT_PUBLIC_API_ORIGIN</span> to your backend origin
                    (fallbacks to <span className="font-semibold">http://localhost:5000</span>).
                  </>
                )}
              </div>
            </div>
          ) : loaded && items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-lg font-semibold text-slate-900">No stories yet.</div>
            </div>
          ) : (
            <section className="mt-8">
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => {
                  // Prefer stable backend identifier; some backends don't support slug lookup
                  // (or may not support non-Latin slugs reliably).
                  const slugOrId = a._id || a.slug;
                  const href = `/news/${encodeURIComponent(String(slugOrId))}`;
                  const when = formatWhenLabel(a.publishedAt || a.createdAt);
                  const summary = a.summary || a.excerpt || '';
                  const image = a.imageUrl || a.image || '';

                  return (
                    <li key={a._id} className="group rounded-2xl border border-slate-200 bg-white overflow-hidden">
                      {image ? (
                        <div className="aspect-[16/9] bg-slate-100">
                          <img
                            src={image}
                            alt={a.title || 'Article image'}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          />
                        </div>
                      ) : null}

                      <div className="p-4">
                        <Link href={href} className="block text-lg font-bold text-slate-900 hover:underline">
                          {a.title || 'Untitled'}
                        </Link>

                        {summary ? (
                          <p
                            className="mt-2 text-sm text-slate-700"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {summary}
                          </p>
                        ) : null}

                        {when ? <div className="mt-3 text-xs font-medium text-slate-500">{when}</div> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
