import Head from 'next/head';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GetStaticProps } from 'next';

import LanguageToggle from '../../components/LanguageToggle';
import BreakingTicker from '../../components/regional/BreakingTicker';

import { ALL_REGIONS } from '../../utils/india';
import { useLanguage } from '../../utils/LanguageContext';
import { getRegionName, tHeading } from '../../utils/localizedNames';

import { fetchCategoryNews } from '../../lib/fetchCategoryNews';

type AnyStory = any;

const TOPIC_CHIPS = ['All', 'Politics', 'Crime', 'Business', 'Education', 'Health', 'Tech', 'Defence'] as const;
type TopicChip = (typeof TOPIC_CHIPS)[number];

type SortKey = 'latest' | 'most-read';

function classNames(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

function normalize(s: unknown) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagList(tags: any): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => normalize(t)).filter(Boolean);
  if (typeof tags === 'string') {
    return tags
      .split(/[;,|]/g)
      .map((t) => normalize(t))
      .filter(Boolean);
  }
  return [];
}

function storyDateIso(story: AnyStory): string {
  return String(story?.publishedAt || story?.createdAt || story?.updatedAt || '').trim();
}

function storyHref(story: AnyStory): string {
  // National uses the public news feed (articles), whose detail page is /news/[slug].
  const key = story?.slug || story?._id || story?.id;
  if (key) return `/news/${encodeURIComponent(String(key))}`;
  return '#';
}

function storyImage(story: AnyStory): string {
  return (
    story?.image ||
    story?.imageUrl ||
    story?.thumbnail ||
    story?.urlToImage ||
    '/fallback.jpg'
  );
}

function onImgErrorFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  // Prevent infinite loop if fallback is also missing.
  img.onerror = null;
  img.src = '/fallback.jpg';
}

function storyExcerpt(story: AnyStory): string {
  const raw =
    story?.excerpt ||
    story?.summary ||
    story?.description ||
    (typeof story?.content === 'string' ? story.content : '') ||
    '';
  const text = String(raw).trim();
  if (!text) return '';
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
}

function storyLocation(story: AnyStory): string {
  return String(
    story?.location ||
      story?.region ||
      story?.city ||
      story?.state ||
      story?.source?.name ||
      story?.source ||
      'India'
  ).trim();
}

function matchesTopic(story: AnyStory, topic: TopicChip): boolean {
  if (topic === 'All') return true;
  const t = normalize(topic);

  const tags = tagList(story?.tags);
  if (tags.some((x) => x === t || x.includes(t))) return true;

  const fields = normalize(`${story?.topic || ''} ${story?.section || ''} ${story?.subcategory || ''} ${story?.categoryName || ''}`);
  if (fields.includes(t)) return true;

  // Fallback: topic word appears in title/summary
  const text = normalize(`${story?.title || ''} ${story?.excerpt || ''} ${story?.summary || ''}`);
  return text.includes(t);
}

function matchRegion(story: AnyStory, regionName: string) {
  const n = normalize(regionName);
  if (!n) return false;
  const text = normalize(`${story?.title || ''} ${story?.excerpt || ''} ${story?.summary || ''} ${story?.content || ''} ${story?.location || ''} ${(story?.tags || []).join?.(' ') || story?.tags || ''}`);
  if (!text) return false;
  return new RegExp(`(^|\s)${n}(\s|$)`).test(text) || text.includes(n);
}

function useVoiceReader() {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = (text: string) => {
    if (!synthRef.current) return;
    try {
      synthRef.current.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      u.pitch = 1.0;
      u.onend = () => setSpeaking(false);
      setSpeaking(true);
      synthRef.current.speak(u);
    } catch {
      setSpeaking(false);
    }
  };

  const stop = () => {
    try {
      synthRef.current?.cancel();
    } finally {
      setSpeaking(false);
    }
  };

  const toggle = (text: string) => (speaking ? stop() : speak(text));

  return { toggle, speaking };
}

function ClientTime({ iso }: { iso?: string }) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!iso) return;
    try {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) {
        setText(
          d.toLocaleString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short',
          })
        );
      }
    } catch {
      // ignore
    }
  }, [iso]);

  return (
    <span suppressHydrationWarning className="text-xs text-slate-500 dark:text-gray-400">
      {text || '—'}
    </span>
  );
}

function CompactFeedRow({ story }: { story: AnyStory }) {
  const href = storyHref(story);
  const title = String(story?.title || 'Untitled').trim();
  const img = storyImage(story);
  const when = storyDateIso(story);
  const where = storyLocation(story);
  const tags = tagList(story?.tags);
  const tag = tags[0] || String(story?.topic || story?.section || '').trim();

  return (
    <a
      href={href}
      className="group flex gap-3 border-b border-slate-200 py-3 hover:bg-slate-50 dark:border-gray-800 dark:hover:bg-gray-900/60"
    >
      <div className="shrink-0">
        <img
          src={img}
          alt=""
          onError={onImgErrorFallback}
          className="h-16 w-20 rounded-lg object-cover border border-slate-200 bg-slate-100 dark:border-gray-800 dark:bg-gray-900"
          loading="lazy"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 group-hover:underline dark:text-gray-100">
              {title}
            </div>
          </div>
          <div className="shrink-0">
            <ClientTime iso={when} />
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2 text-xs">
            {tag ? (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-gray-900 dark:text-gray-200">
                {tag}
              </span>
            ) : null}
            <span className="truncate text-slate-500 dark:text-gray-400">📍 {where}</span>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function NationalFeedPage() {
  const { language } = useLanguage();
  const voice = useVoiceReader();

  const [selectedTopic, setSelectedTopic] = useState<TopicChip>('All');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('latest');
  const [searchQuery, setSearchQuery] = useState('');

  const [stories, setStories] = useState<AnyStory[]>([]);
  const [breaking, setBreaking] = useState<any[]>([]);

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const apiLang = language === 'hindi' ? 'hi' : language === 'gujarati' ? 'gu' : 'en';

  const loadPage = useCallback(
    async (pageToLoad: number) => {
      const limit = 20;
      try {
        if (pageToLoad === 1) {
          setLoading(true);
          setError(null);
        } else {
          setLoadingMore(true);
        }

        // Public API does not currently support pagination params; emulate paging by increasing limit.
        const requested = pageToLoad * limit;
        const resp = await fetchCategoryNews({ categoryKey: 'national', limit: requested });
        if (resp?.error) {
          setError(resp.error);
          setHasMore(false);
          if (pageToLoad === 1) setStories([]);
          return;
        }

        const items = Array.isArray(resp?.items) ? resp.items : [];

        // Heuristic: if backend returns a full page worth, assume there may be more.
        setHasMore(items.length >= requested);
        setStories(items);

        setPage(pageToLoad);
      } catch (e: any) {
        setError(e?.message ? String(e.message) : 'Failed to load National news');
        if (pageToLoad === 1) setStories([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [apiLang]
  );

  // Initial fetch + refetch when language changes
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await loadPage(1);
      if (cancelled) return;
      try {
        // Best-effort: treat breaking as its own public category if backend supports it.
        const resp = await fetchCategoryNews({ categoryKey: 'breaking', limit: 10 });
        if (resp?.error) {
          setBreaking([]);
        } else {
          setBreaking(Array.isArray(resp?.items) ? resp.items : []);
        }
      } catch {
        setBreaking([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    if (!hasMore) return;
    if (loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        if (loading || loadingMore) return;
        if (!hasMore) return;
        loadPage(page + 1);
      },
      { root: null, rootMargin: '600px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadPage, loading, loadingMore, page]);

  const regionOptions = useMemo(() => {
    return ALL_REGIONS.map((r) => ({
      slug: r.slug,
      label: getRegionName(language as any, r.type, r.slug, r.name),
      name: r.name,
    }));
  }, [language]);

  const activeRegionEntry = useMemo(() => {
    if (!selectedRegion || selectedRegion === 'all') return null;
    return regionOptions.find((r) => r.slug === selectedRegion) || null;
  }, [regionOptions, selectedRegion]);

  const filteredStories = useMemo(() => {
    const q = normalize(searchQuery);
    let list = stories;

    if (selectedTopic !== 'All') {
      list = list.filter((s) => matchesTopic(s, selectedTopic));
    }

    if (activeRegionEntry) {
      list = list.filter((s) => matchRegion(s, activeRegionEntry.name));
    }

    if (q) {
      list = list.filter((s) => {
        const text = normalize(`${s?.title || ''} ${s?.excerpt || ''} ${s?.summary || ''} ${s?.content || ''}`);
        return text.includes(q);
      });
    }

    return list;
  }, [activeRegionEntry, searchQuery, selectedTopic, stories]);

  const sortedStories = useMemo(() => {
    const copy = [...filteredStories];
    if (sortKey === 'most-read') {
      copy.sort((a, b) => (Number(b?.reads || 0) || 0) - (Number(a?.reads || 0) || 0));
      return copy;
    }

    // latest
    copy.sort((a, b) => {
      const ad = new Date(storyDateIso(a)).getTime() || 0;
      const bd = new Date(storyDateIso(b)).getTime() || 0;
      return bd - ad;
    });
    return copy;
  }, [filteredStories, sortKey]);

  const hero = sortedStories[0] || null;
  const feed = hero ? sortedStories.slice(1) : sortedStories;

  const topStories = useMemo(() => {
    const base = [...sortedStories];
    base.sort((a, b) => (Number(b?.reads || 0) || 0) - (Number(a?.reads || 0) || 0));
    return base.slice(0, 8);
  }, [sortedStories]);

  const trendingTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sortedStories) {
      for (const t of tagList(s?.tags)) {
        if (!t) continue;
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    const entries: Array<[string, number]> = [];
    counts.forEach((v, k) => {
      entries.push([k, v]);
    });

    const pairs = entries
      .filter(([k]) => k.length >= 3 && k !== 'breaking' && k !== 'national')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);

    return pairs.length ? pairs : TOPIC_CHIPS.filter((t) => t !== 'All').map((t) => normalize(t));
  }, [sortedStories]);

  const videoStory = useMemo(() => {
    return (
      sortedStories.find((s) => !!s?.videoUrl || !!s?.video || tagList(s?.tags).includes('video')) ||
      sortedStories.find((s) => !!s?.image || !!s?.thumbnail) ||
      null
    );
  }, [sortedStories]);

  const heroListenText = useMemo(() => {
    if (!hero) return '';
    const parts = [String(hero?.title || '').trim(), storyExcerpt(hero)].filter(Boolean);
    return parts.join('. ');
  }, [hero]);

  const shareHero = async () => {
    if (!hero) return;
    const url = typeof window !== 'undefined' ? window.location.origin + storyHref(hero) : storyHref(hero);
    const title = String(hero?.title || 'News Pulse').trim();
    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
        if (typeof nav.share === 'function') {
          await nav.share({ title, url });
        }
        return;
      }
    } catch {
      // ignore
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-dark-primary dark:text-dark-text">
      <Head>
        <title>National News | News Pulse</title>
        <meta name="description" content="National news feed with live updates, top stories, and filters." />
      </Head>

      {/* Top bar */}
      <div className="border-b border-slate-200 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-1 rounded-full bg-red-600" />
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold leading-tight">🏛️ {tHeading(language as any, 'national')}</h1>
                <div className="text-xs text-slate-600 dark:text-gray-400">News Feed</div>
              </div>
              <Link href="/national/states" className="ml-2 text-sm font-semibold text-blue-600 hover:underline">
                Browse states →
              </Link>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="w-full sm:w-80">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search National news…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:ring-white/10"
                />
              </div>
              <LanguageToggle />
            </div>
          </div>
        </div>
      </div>

      {/* LIVE ticker */}
      <BreakingTicker items={breaking as any} variant="live" className="border-red-700 bg-red-600" />

      {/* Sticky filters (mobile) */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:static lg:bg-transparent lg:backdrop-blur-0 dark:border-gray-800 dark:bg-dark-primary/95">
        <div className="mx-auto max-w-7xl px-4 py-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {TOPIC_CHIPS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTopic(t)}
                className={classNames(
                  'shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold',
                  selectedTopic === t
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-900/60'
                )}
                aria-pressed={selectedTopic === t}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
              aria-label="Filter by state or UT"
            >
              <option value="all">All States/UTs</option>
              {regionOptions.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.label}
                </option>
              ))}
            </select>

            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
              aria-label="Sort stories"
            >
              <option value="latest">Latest</option>
              <option value="most-read">Most Read</option>
            </select>

            <div className="hidden lg:flex items-center justify-end text-xs text-slate-500 dark:text-gray-400">
              Showing {sortedStories.length} stories
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-4">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-10">
          {/* Left 70% */}
          <main className="lg:col-span-7">
            {/* Hero */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {loading && !hero ? (
                <div className="p-4">
                  <div className="h-48 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-gray-800" />
                  <div className="mt-3 h-6 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-gray-800" />
                  <div className="mt-2 h-4 w-full animate-pulse rounded bg-slate-100 dark:bg-gray-800" />
                </div>
              ) : hero ? (
                <div className="p-4">
                  <a href={storyHref(hero)} className="block">
                    <img
                      src={storyImage(hero)}
                      alt=""
                      onError={onImgErrorFallback}
                      className="h-56 w-full rounded-xl object-cover border border-slate-200 bg-slate-100 dark:border-gray-800 dark:bg-gray-800"
                    />
                    <div className="mt-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-2 text-xs font-black tracking-widest text-red-700">
                            TOP STORY
                          </div>
                          <h2 className="mt-1 line-clamp-2 text-xl md:text-2xl font-extrabold leading-tight">
                            {String(hero?.title || '').trim()}
                          </h2>
                        </div>
                        <div className="shrink-0 text-right">
                          <ClientTime iso={storyDateIso(hero)} />
                          <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">📍 {storyLocation(hero)}</div>
                        </div>
                      </div>

                      {storyExcerpt(hero) ? (
                        <p className="mt-2 line-clamp-2 text-sm text-slate-700 dark:text-gray-300">
                          {storyExcerpt(hero)}
                        </p>
                      ) : null}
                    </div>
                  </a>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={storyHref(hero)}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Read
                    </a>
                    <button
                      type="button"
                      onClick={() => voice.toggle(heroListenText)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-900/60"
                      aria-pressed={voice.speaking}
                    >
                      {voice.speaking ? 'Mute' : 'Listen'}
                    </button>
                    <button
                      type="button"
                      onClick={shareHero}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-900/60"
                    >
                      Share
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-sm text-slate-600 dark:text-gray-300">No national stories yet.</div>
              )}
            </div>

            {/* Feed list */}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">Latest</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">{sortedStories.length} results</div>
                </div>
              </div>

              <div>
                {feed.length === 0 && !loading ? (
                  <div className="p-6 text-sm text-slate-600 dark:text-gray-300">No stories match your filters.</div>
                ) : null}

                {feed.map((s, idx) => {
                  const row = <CompactFeedRow key={String(s?._id || s?.id || s?.slug || idx)} story={s} />;
                  // Mobile: insert sidebar blocks after 8 stories
                  if (idx === 7) {
                    return (
                      <React.Fragment key={`row-${String(s?._id || s?.id || s?.slug || idx)}`}>
                        {row}
                        <div className="lg:hidden border-t border-slate-200">
                          <div className="p-4">
                            <NationalSidebar
                              language={language}
                              topStories={topStories}
                              trendingTopics={trendingTopics}
                              videoStory={videoStory}
                            />
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  }
                  return row;
                })}

                <div ref={sentinelRef} />

                {loadingMore ? (
                  <div className="p-4 text-center text-xs text-slate-500 dark:text-gray-400">Loading more…</div>
                ) : null}
              </div>
            </div>
          </main>

          {/* Right 30% */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-4">
              <NationalSidebar
                language={language}
                topStories={topStories}
                trendingTopics={trendingTopics}
                videoStory={videoStory}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function NationalSidebar({
  topStories,
  trendingTopics,
  videoStory,
}: {
  language: any;
  topStories: AnyStory[];
  trendingTopics: string[];
  videoStory: AnyStory | null;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-extrabold">Top Stories</div>
        </div>
        <div className="p-2">
          {topStories.length ? (
            topStories.slice(0, 8).map((s, i) => (
              <a
                key={String(s?._id || s?.id || s?.slug || i)}
                href={storyHref(s)}
                className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-gray-900/60"
              >
                <div className="shrink-0 text-xs font-black text-slate-500 w-5 text-right dark:text-gray-400">{i + 1}</div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-gray-100">{String(s?.title || 'Untitled')}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">📍 {storyLocation(s)}</div>
                </div>
              </a>
            ))
          ) : (
            <div className="p-3 text-sm text-slate-600 dark:text-gray-300">No top stories yet.</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-extrabold">Trending Topics</div>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {trendingTopics.slice(0, 10).map((t) => (
            <Link
              key={t}
              href={`/search?q=${encodeURIComponent(t)}`}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              #{t}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-extrabold">Video News</div>
        </div>
        <div className="p-4">
          {videoStory ? (
            <a href={storyHref(videoStory)} className="block group">
              <div className="relative">
                <img
                  src={storyImage(videoStory)}
                  alt=""
                  onError={onImgErrorFallback}
                  className="h-40 w-full rounded-xl object-cover border border-slate-200 bg-slate-100 dark:border-gray-800 dark:bg-gray-800"
                  loading="lazy"
                />
                <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-slate-900">
                  ▶ Video
                </div>
              </div>
              <div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:underline dark:text-gray-100">
                {String(videoStory?.title || 'Watch')}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">📍 {storyLocation(videoStory)}</div>
            </a>
          ) : (
            <div className="text-sm text-slate-600 dark:text-gray-300">No video stories right now.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};
