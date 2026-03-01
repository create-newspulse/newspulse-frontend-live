import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';

import { findIndiaStateOrUTBySlug } from '../../../src/data/indiaStatesUT';

type AnyRecord = Record<string, any>;

type FetchState = {
  loading: boolean;
  error: string | null;
  items: AnyRecord[];
};

function getTitleFromArticle(item: AnyRecord): string {
  return (
    item?.title ||
    item?.headline ||
    item?.name ||
    item?.heading ||
    item?.post_title ||
    'Untitled'
  );
}

function getLinkFromArticle(item: AnyRecord): string | null {
  // Prefer a canonical/absolute URL if provided by backend.
  return item?.url || item?.link || item?.canonicalUrl || item?.canonical_url || null;
}

export default function NationalStatePage() {
  const router = useRouter();
  const { stateSlug } = router.query as { stateSlug?: string };

  const stateMeta = React.useMemo(() => findIndiaStateOrUTBySlug(stateSlug), [stateSlug]);

  const [fetchState, setFetchState] = React.useState<FetchState>({
    loading: true,
    error: null,
    items: [],
  });

  React.useEffect(() => {
    if (!router.isReady) return;

    const slug = String(stateSlug || '').trim().toLowerCase();
    if (!slug) return;

    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) {
      setFetchState({
        loading: false,
        error: 'Missing NEXT_PUBLIC_API_URL. Please configure it to load state-wise national stories.',
        items: [],
      });
      return;
    }

    const controller = new AbortController();

    async function run(currentApiBase: string) {
      try {
        setFetchState((s) => ({ ...s, loading: true, error: null }));
        const url = `${currentApiBase.replace(/\/$/, '')}/api/articles/national/state/${encodeURIComponent(slug)}`;

        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Request failed (${res.status}). ${text ? text.slice(0, 200) : ''}`.trim());
        }

        const data = (await res.json()) as any;
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.articles)
              ? data.articles
              : Array.isArray(data?.results)
                ? data.results
                : [];

        setFetchState({ loading: false, error: null, items });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        setFetchState({ loading: false, error: e?.message || 'Failed to load stories.', items: [] });
      }
    }

    run(apiBase);

    return () => controller.abort();
  }, [router.isReady, stateSlug]);

  const displayName = stateMeta?.name || String(stateSlug || '');

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">
              <Link href="/national" className="hover:underline">National</Link>
              <span className="mx-2">/</span>
              <Link href="/national/states" className="hover:underline">States & UTs</Link>
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">{displayName}</h1>
            <p className="text-gray-600 mt-1">National stories filtered by this State/UT.</p>
          </div>

          <button
            type="button"
            onClick={() => router.push('/national/states')}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-50"
          >
            Back
          </button>
        </div>

        <div className="mt-6">
          {fetchState.loading ? (
            <div className="text-gray-600">Loading…</div>
          ) : fetchState.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
              {fetchState.error}
            </div>
          ) : fetchState.items.length === 0 ? (
            <div className="rounded-lg border border-gray-200 p-4 text-gray-700">
              No stories found for this state yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fetchState.items.map((item, idx) => {
                const title = getTitleFromArticle(item);
                const link = getLinkFromArticle(item);

                return (
                  <div key={item?.id || item?._id || `${idx}`} className="rounded-lg border border-gray-200 p-4">
                    <div className="text-gray-900 font-semibold leading-snug">{title}</div>

                    {item?.summary || item?.description ? (
                      <div className="text-gray-600 text-sm mt-2 line-clamp-3">
                        {String(item.summary || item.description)}
                      </div>
                    ) : null}

                    <div className="mt-3">
                      {link ? (
                        <a
                          href={String(link)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Read more
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
