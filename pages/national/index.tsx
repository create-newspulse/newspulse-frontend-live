import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import type { GetStaticProps } from 'next';

import BreakingTicker from '../../components/regional/BreakingTicker';

import { useLanguage } from '../../utils/LanguageContext';
import { tHeading, toLanguageKey } from '../../utils/localizedNames';

import { fetchPublicNews } from '../../lib/publicNewsApi';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { buildNewsUrl } from '../../lib/newsRoutes';
import { localizeArticle } from '../../lib/localizeArticle';
import { resolveArticleSlug } from '../../lib/articleSlugs';
import { COVER_PLACEHOLDER_SRC, onCoverImageError, resolveCoverImageUrl } from '../../lib/coverImages';

type AnyStory = any;

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://newspulse-backend-real.onrender.com';

function normalizeLang(locale: unknown): 'en' | 'hi' | 'gu' {
  const v = String(locale || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

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

function storyHref(story: AnyStory, lang: unknown): string {
  const id = String(story?._id || story?.id || '').trim();
  const slug = resolveArticleSlug(story, lang);
  if (!id) return '#';
  return buildNewsUrl({ id, slug, lang });
}

function storyImage(story: AnyStory): string {
  return resolveCoverImageUrl(story) || COVER_PLACEHOLDER_SRC;
}

function onImgErrorFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  onCoverImageError(e);
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

type IndiaStateUt = { name: string; slug: string };

function unwrapStateUts(payload: any): IndiaStateUt[] {
  if (!payload) return [];
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.states)
          ? payload.states
          : Array.isArray(payload?.result)
            ? payload.result
            : [];

  return (list as any[])
    .map((x) => ({
      name: String(x?.name || x?.label || '').trim(),
      slug: String(x?.slug || x?.key || '').trim(),
    }))
    .filter((x) => x.name && x.slug);
}

function unwrapArticlesList(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const candidates = [payload.items, payload.articles, payload.data, payload.result];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function mergeUniqueStories(primary: any[], secondary: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];

  const push = (s: any) => {
    const key = String(s?._id || s?.id || s?.slug || '').trim();
    if (!key) {
      out.push(s);
      return;
    }
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  for (const s of primary) push(s);
  for (const s of secondary) push(s);
  return out;
}

function useVoiceReader() {
  const synthRef = React.useRef<SpeechSynthesis | null>(null);
  const [speaking, setSpeaking] = React.useState(false);

  React.useEffect(() => {
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
  const [text, setText] = React.useState('');
  React.useEffect(() => {
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

function CompactFeedRow({ story, lang }: { story: AnyStory; lang: 'en' | 'hi' | 'gu' }) {
  const { t } = useI18n();
  const href = storyHref(story, lang);
  const { title, content } = localizeArticle(story, lang);
  const safeTitle = String(title || story?.title || t('common.untitled')).trim();
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
              {safeTitle}
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

export default function NationalFeedPage(props: { lang: 'en' | 'hi' | 'gu'; data: AnyStory[] | null; breaking?: AnyStory[] | null }) {
  const router = useRouter();
  const { language } = useLanguage();
  const { t } = useI18n();
  const voice = useVoiceReader();
  const effectiveLang = React.useMemo(() => normalizeLang(router.locale || language || props.lang), [language, props.lang, router.locale]);
  const langKey = React.useMemo(() => toLanguageKey(effectiveLang), [effectiveLang]);

  const [selectedTopic, setSelectedTopic] = React.useState<TopicChip>('All');
  const [selectedRegion, setSelectedRegion] = React.useState<string>('all');
  const [sortKey, setSortKey] = React.useState<SortKey>('latest');
  const [searchQuery, setSearchQuery] = React.useState('');

  const [stateUts, setStateUts] = React.useState<IndiaStateUt[]>([]);

  const initialStories = React.useMemo(() => (Array.isArray(props.data) ? props.data : []), [props.data]);
  const initialBreaking = React.useMemo(() => (Array.isArray(props.breaking) ? props.breaking : []), [props.breaking]);

  const [stories, setStories] = React.useState<AnyStory[]>(initialStories);
  const [breaking, setBreaking] = React.useState<any[]>(initialBreaking);

  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(!initialStories.length);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const didInitRef = React.useRef(false);

  // URL <-> filter state (shareable links)
  React.useEffect(() => {
    if (!router.isReady) return;

    const topicParam = typeof router.query.topic === 'string' ? router.query.topic : '';
    const stateParam =
      typeof (router.query as any).stateUt === 'string'
        ? String((router.query as any).stateUt)
        : typeof (router.query as any)['location.state'] === 'string'
          ? String((router.query as any)['location.state'])
          : '';

    if (topicParam) {
      const normalized = normalize(topicParam);
      const found = (TOPIC_CHIPS as readonly string[]).find((c) => normalize(c) === normalized) as TopicChip | undefined;
      if (found) setSelectedTopic(found);
    }

    if (stateParam) {
      setSelectedRegion(stateParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  React.useEffect(() => {
    if (!router.isReady) return;

    const nextQuery: Record<string, any> = { ...router.query };

    const topicValue = selectedTopic === 'All' ? '' : normalize(selectedTopic);
    if (topicValue) nextQuery.topic = topicValue;
    else delete nextQuery.topic;

    const stateValue = !selectedRegion || selectedRegion === 'all' ? '' : String(selectedRegion);
    if (stateValue) (nextQuery as any).stateUt = stateValue;
    else delete (nextQuery as any).stateUt;
    // Back-compat cleanup
    delete (nextQuery as any)['location.state'];

    const curTopic = typeof router.query.topic === 'string' ? router.query.topic : '';
    const curState =
      typeof (router.query as any).stateUt === 'string'
        ? String((router.query as any).stateUt)
        : typeof (router.query as any)['location.state'] === 'string'
          ? String((router.query as any)['location.state'])
          : '';

    if (
      String(curTopic || '') === String((nextQuery as any).topic || '') &&
      String(curState || '') === String((nextQuery as any).stateUt || '')
    ) {
      return;
    }

    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true, scroll: false }).catch(() => {});
  }, [router, selectedRegion, selectedTopic]);

  const tTopicChip = (chip: TopicChip) => {
    switch (chip) {
      case 'All':
        return t('topics.all');
      case 'Politics':
        return t('topics.politics');
      case 'Crime':
        return t('topics.crime');
      case 'Business':
        return t('topics.business');
      case 'Education':
        return t('topics.education');
      case 'Health':
        return t('topics.health');
      case 'Tech':
        return t('topics.tech');
      case 'Defence':
        return t('topics.defence');
      default:
        return chip;
    }
  };

  const activeStateUt = React.useMemo(() => {
    return !selectedRegion || selectedRegion === 'all' ? '' : String(selectedRegion);
  }, [selectedRegion]);

  const loadPage = React.useCallback(
    async (pageToLoad: number) => {
      const limit = 20;
      try {
        if (pageToLoad === 1) {
          setLoading(true);
          setError(null);
        } else {
          setLoadingMore(true);
        }

        // Backend may not support pagination; emulate paging by increasing limit.
        const requested = pageToLoad * limit;
        const params = new URLSearchParams();
        params.set('category', 'National');
        if (activeStateUt) params.set('stateUt', activeStateUt);
        params.set('limit', String(requested));
        if (effectiveLang) {
          params.set('lang', effectiveLang);
          params.set('language', effectiveLang);
        }

        const endpoint = `/api/articles?${params.toString()}`;
        const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(`API ${res.status}`);
          setHasMore(false);
          if (pageToLoad === 1) setStories([]);
          return;
        }

        const baseItems = unwrapArticlesList(data);

        // Backward-compatible All-India view: merge legacy public National feed.
        // This keeps older “National” content visible even if /api/articles is stricter.
        const items = await (async () => {
          if (activeStateUt) return baseItems;
          try {
            const legacy = await fetchPublicNews({ category: 'national', language: effectiveLang, limit: requested });
            const legacyItems = Array.isArray(legacy?.items) ? legacy.items : [];
            const merged = mergeUniqueStories(baseItems, legacyItems);
            return merged.slice(0, requested);
          } catch {
            return baseItems;
          }
        })();

        // Heuristic: if backend returns a full page worth, assume there may be more.
        setHasMore(items.length >= requested || baseItems.length >= requested);
        setStories(items);

        setPage(pageToLoad);
      } catch (e: any) {
        setError(e?.message ? String(e.message) : t('nationalPage.failedToLoad'));
        if (pageToLoad === 1) setStories([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeStateUt, effectiveLang, t]
  );

  // Load master list of India states/UTs for the dropdown
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/meta/india-states-uts', { headers: { Accept: 'application/json' } });
        const json = await res.json().catch(() => null);
        if (cancelled) return;

        const list = unwrapStateUts(json);
        setStateUts(list);
      } catch {
        if (cancelled) return;
        setStateUts([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Initial fetch + refetch when language/state changes
  React.useEffect(() => {
    let cancelled = false;

    const isFirstRun = !didInitRef.current;
    didInitRef.current = true;

    // If we already have SSR-provided items, avoid a forced refetch only on first paint.
    // Always refetch when language changes (effect reruns).
    const shouldFetchFirstPage = !isFirstRun || !initialStories.length;

    (async () => {
      if (shouldFetchFirstPage) {
        await loadPage(1);
      }
      if (cancelled) return;
      try {
        // Best-effort: treat breaking as its own public category if backend supports it.
        const resp = await fetchPublicNews({ category: 'breaking', language: effectiveLang, limit: 10 });
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
  }, [effectiveLang, initialStories.length, loadPage]);

  // Infinite scroll
  React.useEffect(() => {
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

  const regionOptions = React.useMemo(() => {
    const list = [...stateUts]
      .map((s) => ({ slug: s.slug, label: s.name, name: s.name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'en-IN'));
    return list;
  }, [stateUts]);

  const activeRegionEntry = React.useMemo(() => {
    if (!selectedRegion || selectedRegion === 'all') return null;
    return regionOptions.find((r) => r.slug === selectedRegion) || null;
  }, [regionOptions, selectedRegion]);

  const filteredStories = React.useMemo(() => {
    const q = normalize(searchQuery);
    let list = stories;

    if (selectedTopic !== 'All') {
      list = list.filter((s) => matchesTopic(s, selectedTopic));
    }

    if (q) {
      list = list.filter((s) => {
        const text = normalize(`${s?.title || ''} ${s?.excerpt || ''} ${s?.summary || ''} ${s?.content || ''}`);
        return text.includes(q);
      });
    }

    return list;
  }, [searchQuery, selectedTopic, stories]);

  const sortedStories = React.useMemo(() => {
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

  const heroLocalizedTitle = React.useMemo(() => {
    if (!hero) return '';
    const { title, content } = localizeArticle(hero, effectiveLang);
    return String(title || hero?.title || '').trim();
  }, [effectiveLang, hero]);

  const topStories = React.useMemo(() => {
    const base = [...sortedStories];
    base.sort((a, b) => (Number(b?.reads || 0) || 0) - (Number(a?.reads || 0) || 0));
    return base.slice(0, 8);
  }, [sortedStories]);

  const trendingTopics = React.useMemo(() => {
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

  const videoStory = React.useMemo(() => {
    return (
      sortedStories.find((s) => !!s?.videoUrl || !!s?.video || tagList(s?.tags).includes('video')) ||
      sortedStories.find((s) => !!s?.image || !!s?.thumbnail) ||
      null
    );
  }, [sortedStories]);

  const heroListenText = React.useMemo(() => {
    if (!hero) return '';
    const parts = [heroLocalizedTitle, storyExcerpt(hero)].filter(Boolean);
    return parts.join('. ');
  }, [hero, heroLocalizedTitle]);

  const shareHero = async () => {
    if (!hero) return;
    const url = typeof window !== 'undefined' ? window.location.origin + storyHref(hero, effectiveLang) : storyHref(hero, effectiveLang);
    const title = String(heroLocalizedTitle || 'News Pulse').trim();
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
        <title>{t('nationalPage.headTitle')}</title>
        <meta name="description" content={t('nationalPage.headDescription')} />
      </Head>

      {/* Top bar */}
      <div className="border-b border-slate-200 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-1 rounded-full bg-red-600" />
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold leading-tight">🏛️ {tHeading(langKey, 'national')}</h1>
                <div className="text-xs text-slate-600 dark:text-gray-400">{t('nationalPage.newsFeed')}</div>
                {activeRegionEntry ? (
                  <div className="mt-0.5 text-xs text-slate-600 dark:text-gray-400">
                    {tHeading(langKey, 'national')} &gt; {activeRegionEntry.label}
                  </div>
                ) : null}
              </div>
              <Link href="/national/states" className="ml-2 text-sm font-semibold text-blue-600 hover:underline">
                {t('nationalPage.browseStates')}
              </Link>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="w-full sm:w-80">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('nationalPage.searchPlaceholder')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:ring-white/10"
                />
              </div>
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
            {TOPIC_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setSelectedTopic(chip)}
                className={classNames(
                  'shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold',
                  selectedTopic === chip
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-900/60'
                )}
                aria-pressed={selectedTopic === chip}
              >
                {tTopicChip(chip)}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
              aria-label={t('nationalPage.filterByStateOrUt')}
            >
              <option value="all">{t('nationalPage.allStatesUts')}</option>
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
              aria-label={t('nationalPage.sortStories')}
            >
              <option value="latest">{t('nationalPage.sortLatest')}</option>
              <option value="most-read">{t('nationalPage.sortMostRead')}</option>
            </select>

            <div className="hidden lg:flex items-center justify-end text-xs text-slate-500 dark:text-gray-400">
              {t('nationalPage.showing')} {sortedStories.length} {t('nationalPage.stories')}
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
                  <a href={storyHref(hero, effectiveLang)} className="block">
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
                            {t('nationalPage.topStory')}
                          </div>
                          <h2 className="mt-1 line-clamp-2 text-xl md:text-2xl font-extrabold leading-tight">
                            {heroLocalizedTitle}
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
                      href={storyHref(hero, effectiveLang)}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      {t('common.read')}
                    </a>
                    <button
                      type="button"
                      onClick={() => voice.toggle(heroListenText)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-900/60"
                      aria-pressed={voice.speaking}
                    >
                      {voice.speaking ? t('common.mute') : t('common.listen')}
                    </button>
                    <button
                      type="button"
                      onClick={shareHero}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-900/60"
                    >
                      {t('common.share')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-sm text-slate-600 dark:text-gray-300">No news found</div>
              )}
            </div>

            {/* Feed list */}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">{t('nationalPage.latestHeading')}</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    {sortedStories.length} {t('common.results')}
                  </div>
                </div>
              </div>

              <div>
                {feed.length === 0 && !loading ? (
                  <div className="p-6 text-sm text-slate-600 dark:text-gray-300">No news found</div>
                ) : null}

                {feed.map((s, idx) => {
                  const row = <CompactFeedRow key={String(s?._id || s?.id || s?.slug || idx)} story={s} lang={effectiveLang} />;
                  // Mobile: insert sidebar blocks after 8 stories
                  if (idx === 7) {
                    return (
                      <React.Fragment key={`row-${String(s?._id || s?.id || s?.slug || idx)}`}>
                        {row}
                        <div className="lg:hidden border-t border-slate-200">
                          <div className="p-4">
                            <NationalSidebar
                              language={effectiveLang}
                              lang={effectiveLang}
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
                  <div className="p-4 text-center text-xs text-slate-500 dark:text-gray-400">{t('common.loadingMore')}</div>
                ) : null}
              </div>
            </div>
          </main>

          {/* Right 30% */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-4">
              <NationalSidebar
                language={effectiveLang}
                lang={effectiveLang}
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
  language,
  lang,
  topStories,
  trendingTopics,
  videoStory,
}: {
  language: any;
  lang: 'en' | 'hi' | 'gu';
  topStories: AnyStory[];
  trendingTopics: string[];
  videoStory: AnyStory | null;
}) {
  const { t } = useI18n();
  const slugify = (value: string) =>
    String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-extrabold">{t('nationalPage.topStoriesTitle')}</div>
        </div>
        <div className="p-2">
          {topStories.length ? (
            topStories.slice(0, 8).map((s, i) => (
              <a
                key={String(s?._id || s?.id || s?.slug || i)}
                href={storyHref(s, language)}
                className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-gray-900/60"
              >
                <div className="shrink-0 text-xs font-black text-slate-500 w-5 text-right dark:text-gray-400">{i + 1}</div>
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-gray-100">
                    {(() => {
                      const { title } = localizeArticle(s, lang);
                      return String(title || s?.title || t('common.untitled'));
                    })()}
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">📍 {storyLocation(s)}</div>
                </div>
              </a>
            ))
          ) : (
            <div className="p-3 text-sm text-slate-600 dark:text-gray-300">{t('nationalPage.noTopStoriesYet')}</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-extrabold">{t('nationalPage.trendingTopicsTitle')}</div>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {trendingTopics.slice(0, 10).map((t) => (
            <Link
              key={t}
              href={`/topic/${encodeURIComponent(slugify(t))}?q=${encodeURIComponent(t)}`}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              #{t}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-extrabold">{t('nationalPage.videoNewsTitle')}</div>
        </div>
        <div className="p-4">
          {videoStory ? (
            <a href={storyHref(videoStory, language)} className="block group">
              <div className="relative">
                <img
                  src={storyImage(videoStory)}
                  alt=""
                  onError={onImgErrorFallback}
                  className="h-40 w-full rounded-xl object-cover border border-slate-200 bg-slate-100 dark:border-gray-800 dark:bg-gray-800"
                  loading="lazy"
                />
                <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-slate-900">
                  ▶ {t('common.video')}
                </div>
              </div>
              <div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:underline dark:text-gray-100">
                {(() => {
                  const { title, content } = localizeArticle(videoStory, lang);
                  return String(title || videoStory?.title || t('nationalPage.watchFallback'));
                })()}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">📍 {storyLocation(videoStory)}</div>
            </a>
          ) : (
            <div className="text-sm text-slate-600 dark:text-gray-300">{t('nationalPage.noVideoStoriesRightNow')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const lang = normalizeLang(locale);

  const messages = await (async () => {
    try {
      const { getMessages } = await import('../../lib/getMessages');
      return await getMessages(lang);
    } catch {
      return {};
    }
  })();

  try {
    const limit = 40;
    const params = new URLSearchParams();
    params.set('category', 'National');
    params.set('lang', lang);
    params.set('language', lang);
    params.set('limit', String(limit));

    const endpoint = `${API_BASE}/api/articles?${params.toString()}`;
    const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    const json = await res.json().catch(() => null);
    const items = Array.isArray(json?.items)
      ? json.items
      : Array.isArray(json?.articles)
        ? json.articles
        : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
            ? json
            : [];

    // Backward-compatible merge with legacy public National feed.
    const legacyItems = await (async () => {
      try {
        const lp = new URLSearchParams();
        lp.set('category', 'national');
        lp.set('lang', lang);
        lp.set('language', lang);
        lp.set('limit', String(limit));

        const lRes = await fetch(`${API_BASE}/api/public/news?${lp.toString()}`, { headers: { Accept: 'application/json' } });
        const lJson = await lRes.json().catch(() => null);
        const list = Array.isArray(lJson?.items)
          ? lJson.items
          : Array.isArray(lJson?.articles)
            ? lJson.articles
            : Array.isArray(lJson?.data)
              ? lJson.data
              : [];
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    })();

    const mergedItems = mergeUniqueStories(items, legacyItems).slice(0, limit);

    // Breaking (best-effort)
    const breaking = await (async () => {
      try {
        const bp = new URLSearchParams();
        bp.set('category', 'breaking');
        bp.set('lang', lang);
        bp.set('language', lang);
        bp.set('limit', '10');
        const bRes = await fetch(`${API_BASE}/api/public/news?${bp.toString()}`, { headers: { Accept: 'application/json' } });
        const bJson = await bRes.json().catch(() => null);
        const bItems = Array.isArray(bJson?.items) ? bJson.items : Array.isArray(bJson?.articles) ? bJson.articles : Array.isArray(bJson?.data) ? bJson.data : [];
        return Array.isArray(bItems) ? bItems : [];
      } catch {
        return [];
      }
    })();

    return {
      props: {
        lang,
        data: Array.isArray(mergedItems) ? mergedItems : [],
        breaking,
        messages,
      },
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('SSR national error', err);
    return {
      props: {
        lang,
        data: null,
        breaking: [],
        messages,
      },
    };
  }
};
