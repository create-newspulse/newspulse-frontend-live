import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import type { GetStaticProps } from 'next';

import BreakingTicker from '../../components/regional/BreakingTicker';
import NewsPulseCategoryShell from '../../components/NewsPulseCategoryShell';

import { ALL_REGIONS } from '../../utils/india';
import { useLanguage } from '../../utils/LanguageContext';
import { getRegionName, toLanguageKey } from '../../utils/localizedNames';

import { fetchPublicNews } from '../../lib/publicNewsApi';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { buildNewsUrl } from '../../lib/newsRoutes';
import { localizeArticle } from '../../lib/localizeArticle';
import { resolveArticleSlug } from '../../lib/articleSlugs';
import { COVER_PLACEHOLDER_SRC, resolveCoverImageUrl } from '../../lib/coverImages';
import { getStoryTitleHookColor, splitStoryTitleHook } from '../../lib/storyTitleHook';
import StoryImage, { TopStoryImage } from '../../src/components/story/StoryImage';
import { getPublicApiBaseUrl } from '../../lib/publicApiBase';
import CategoryDeskHeader from '../../src/components/category/CategoryDeskHeader';
import CategoryStoryHierarchy, { type CategoryStoryHierarchyItem } from '../../components/category/CategoryStoryHierarchy';

type AnyStory = any;

type NationalLiveTickerItem = {
  _id: string;
  title?: string;
  tags?: any;
  kind?: 'live' | 'story' | string;
  href?: string;
};

function resolveLangFromPathname(pathname: unknown): 'en' | 'hi' | 'gu' {
  const p = String(pathname || '').toLowerCase();
  if (p === '/hi' || p.startsWith('/hi/')) return 'hi';
  if (p === '/gu' || p.startsWith('/gu/')) return 'gu';
  if (p === '/en' || p.startsWith('/en/')) return 'en';
  return 'en';
}

function getTickerBaseUrl(): string {
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
}

function unwrapTickerItems(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.ticker)) return payload.ticker;
  return [];
}

function toTickerItems(raw: any[]): NationalLiveTickerItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it, idx) => {
      const id = String(it?._id || it?.id || it?.key || it?.slug || `ticker-${idx}`).trim();
      const title = String(it?.title || it?.text || it?.headline || it?.name || '').trim();
      if (!id) return null;
      const out: NationalLiveTickerItem = { _id: id };

      // IMPORTANT: Next.js props serialization rejects `undefined` values.
      // Only include optional fields when they are present.
      if (title) out.title = title;
      if (typeof it?.href === 'string' && it.href.trim()) out.href = it.href;
      if (it?.kind != null) out.kind = it.kind;
      if (it?.tags != null) out.tags = it.tags;

      return out;
    })
    .filter(Boolean)
    .slice(0, 5) as NationalLiveTickerItem[];
}

async function fetchNationalLiveStrip(options: {
  lang: 'en' | 'hi' | 'gu';
  signal?: AbortSignal;
}): Promise<NationalLiveTickerItem[]> {
  const qs = new URLSearchParams();
  qs.set('lang', options.lang);
  qs.set('limit', '5');
  qs.set('hours', '24');

  // In the browser, always hit same-origin to avoid CORS and to respect dev/prod base separation.
  // This Next API route proxies to the configured backend.
  const endpoint =
    typeof window !== 'undefined'
      ? `/api/ticker/national-live?${qs.toString()}`
      : (() => {
          const base = getTickerBaseUrl();
          if (!base) return '';
          return `${base}/api/ticker/national-live?${qs.toString()}`;
        })();

  if (!endpoint) return [];
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return [];
  return toTickerItems(unwrapTickerItems(json));
}

async function fetchGenericLiveStrip(options: {
  lang: 'en' | 'hi' | 'gu';
  signal?: AbortSignal;
}): Promise<NationalLiveTickerItem[]> {
  const qs = new URLSearchParams();
  qs.set('lang', options.lang);

  const endpoint =
    typeof window !== 'undefined'
      ? `/api/ticker/live?${qs.toString()}`
      : (() => {
          const base = getTickerBaseUrl();
          if (!base) return '';
          return `${base}/api/ticker/live?${qs.toString()}`;
        })();

  if (!endpoint) return [];

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return [];
  return toTickerItems(unwrapTickerItems(json));
}

function normalizeLang(locale: unknown): 'en' | 'hi' | 'gu' {
  const v = String(locale || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

const TOPIC_CHIPS = ['All', 'Politics', 'Crime', 'Business', 'Education', 'Health', 'Tech', 'Defence'] as const;
type TopicChip = (typeof TOPIC_CHIPS)[number];

type SortKey = 'latest' | 'most-read';

const AUTO_REFRESH_MS = 45_000;

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
  const loc = story?.location;

  if (typeof loc === 'string' && loc.trim()) return loc.trim();
  if (loc && typeof loc === 'object' && !Array.isArray(loc)) {
    const parts = [
      (loc as any)?.city,
      (loc as any)?.district,
      (loc as any)?.state,
      (loc as any)?.country,
    ]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    if (parts.length) return parts.join(', ');
  }

  const fallbacks = [story?.region, story?.city, story?.state, story?.source?.name, story?.source];
  for (const v of fallbacks) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }

  return 'India';
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
  const status = String((story as any)?.status || (story as any)?.state || '').trim();
  const footerLocation = where && status && where.toLowerCase() === status.toLowerCase() ? '' : where;
  const translationStatus = String((story as any)?.translationStatus || '').trim();
  const titleParts = splitStoryTitleHook(safeTitle);
  const titleHookColor = getStoryTitleHookColor(tag || story?.category || story?.section);
  const summary = (() => {
    const localizedSummary = String(content || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const fallbackSummary = storyExcerpt(story);
    const text = localizedSummary || fallbackSummary;
    if (!text) return '';
    return text.length > 180 ? `${text.slice(0, 180).trim()}…` : text;
  })();

  return (
    <a
      href={href}
      className="group mx-3 my-3 flex flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white p-0 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.28)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_24px_48px_-28px_rgba(15,23,42,0.2)] sm:grid sm:grid-cols-[300px_minmax(0,1fr)] sm:items-center sm:gap-6 sm:p-5 md:grid-cols-[310px_minmax(0,1fr)] md:gap-6 md:p-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-7 lg:p-5 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
    >
      <div className="h-[210px] w-full shrink-0 overflow-hidden rounded-t-[24px] bg-slate-50 sm:h-[190px] sm:w-[300px] sm:self-center sm:rounded-[18px] md:h-[198px] md:w-[310px] lg:h-[206px] lg:w-[320px] dark:bg-gray-950">
        <StoryImage
          src={img}
          alt={safeTitle}
          variant="card"
          fitMode="cover"
          className="block h-full w-full rounded-none rounded-t-[24px] border-0 border-b border-slate-200 bg-slate-50 sm:rounded-[18px] sm:border dark:border-gray-800 dark:bg-gray-950"
        />
      </div>

      <div className="min-w-0 flex-1 px-4 pb-4 pt-4 sm:px-0 sm:py-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-gray-400">
          {tag ? <span className="rounded-full bg-newsPulse-blue/10 px-2.5 py-1 text-newsPulse-blue">{tag}</span> : null}
          {status ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-gray-800 dark:text-gray-300">{status}</span> : null}
          {lang === 'gu' && translationStatus ? (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
              {translationStatus}
            </span>
          ) : null}
          {when ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium normal-case tracking-normal text-slate-500 dark:text-gray-400">
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-gray-600" />
              <ClientTime iso={when} />
            </span>
          ) : null}
        </div>

        <div className="mt-3 min-w-0">
          <div className="line-clamp-3 text-base font-extrabold leading-snug text-slate-900 transition-colors group-hover:text-slate-700 sm:text-[1.04rem] dark:text-gray-100 dark:group-hover:text-white">
              {titleParts.highlightedHook ? <span style={{ color: titleHookColor }}>{titleParts.highlightedHook}</span> : null}
              {titleParts.remainingTitle ? <span>{` ${titleParts.remainingTitle}`}</span> : null}
            </div>
          {summary ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-gray-300">{summary}</p> : null}
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-gray-400">
          {footerLocation ? <span className="truncate">📍 {footerLocation}</span> : null}
          {footerLocation && status ? <span className="hidden sm:inline text-slate-300 dark:text-gray-600">•</span> : null}
          {status ? <span className="capitalize">{status}</span> : null}
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

  // Allow deep-linking into a filtered view (used by article-page category header search).
  React.useEffect(() => {
    if (!router.isReady) return;
    const raw = (router.query as any)?.search ?? (router.query as any)?.q;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const next = String(value || '').trim();
    if (!next) return;
    setSearchQuery(next);
  }, [router.isReady, router.query]);

  const initialStories = React.useMemo(() => (Array.isArray(props.data) ? props.data : []), [props.data]);
  const initialBreaking = React.useMemo(() => (Array.isArray(props.breaking) ? props.breaking : []), [props.breaking]);

  const [stories, setStories] = React.useState<AnyStory[]>(initialStories);
  const [breaking, setBreaking] = React.useState<any[]>(initialBreaking);

  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(!initialStories.length);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);

  const didInitRef = React.useRef(false);
  const refreshStateRef = React.useRef({ page: 1 });
  const loadingPageRef = React.useRef<number | null>(null);
  const activeFeedRequestRef = React.useRef('');
  const inFlightFeedRequestRef = React.useRef('');

  React.useEffect(() => {
    refreshStateRef.current = { page };
  }, [page]);

  // URL <-> filter state (shareable links)
  React.useEffect(() => {
    if (!router.isReady) return;

    const topicParam = typeof router.query.topic === 'string' ? router.query.topic : '';
    const stateParam = typeof (router.query as any)['location.state'] === 'string' ? String((router.query as any)['location.state']) : '';

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
    if (stateValue) (nextQuery as any)['location.state'] = stateValue;
    else delete (nextQuery as any)['location.state'];

    const curTopic = typeof router.query.topic === 'string' ? router.query.topic : '';
    const curState = typeof (router.query as any)['location.state'] === 'string' ? String((router.query as any)['location.state']) : '';

    if (
      String(curTopic || '') === String((nextQuery as any).topic || '') &&
      String(curState || '') === String((nextQuery as any)['location.state'] || '')
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

  const loadPage = React.useCallback(
    async (pageToLoad: number) => {
      const limit = 20;
      const requestKey = `${effectiveLang}:${pageToLoad}`;
      if (inFlightFeedRequestRef.current === requestKey) return;

      loadingPageRef.current = pageToLoad;
      activeFeedRequestRef.current = requestKey;
      inFlightFeedRequestRef.current = requestKey;

      try {
        if (pageToLoad === 1) {
          setLoading(true);
          setError(null);
          setLoadMoreError(null);
        } else {
          setLoadingMore(true);
          setLoadMoreError(null);
        }

        // Public API does not currently support pagination params; emulate paging by increasing limit.
        const requested = pageToLoad * limit;
        const resp = await fetchPublicNews({ category: 'national', language: effectiveLang, limit: requested });
        if (activeFeedRequestRef.current !== requestKey) return;

        if (resp?.error) {
          if (pageToLoad === 1) {
            setError(resp.error);
            setHasMore(false);
            setStories([]);
          } else {
            setLoadMoreError(resp.error);
            setHasMore(true);
          }
          return;
        }

        const items = Array.isArray(resp?.items) ? resp.items : [];

        // Heuristic: if backend returns a full page worth, assume there may be more.
        const total = typeof resp?.meta?.total === 'number' ? resp.meta.total : undefined;
        const totalPages = typeof resp?.meta?.totalPages === 'number' ? resp.meta.totalPages : undefined;
        setHasMore(typeof total === 'number' ? items.length < total : typeof totalPages === 'number' ? pageToLoad < totalPages : items.length >= requested);
        setStories(items);

        setPage(pageToLoad);
      } catch (e: any) {
        if (activeFeedRequestRef.current !== requestKey) return;
        const message = e?.message ? String(e.message) : t('nationalPage.failedToLoad');
        if (pageToLoad === 1) {
          setError(message);
          setStories([]);
        } else {
          setLoadMoreError(message);
          setHasMore(true);
        }
      } finally {
        if (activeFeedRequestRef.current === requestKey) {
          setLoading(false);
          setLoadingMore(false);
        }
        if (loadingPageRef.current === pageToLoad) loadingPageRef.current = null;
        if (inFlightFeedRequestRef.current === requestKey) inFlightFeedRequestRef.current = '';
      }
    },
    [effectiveLang, t]
  );

  const loadNextPage = React.useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    loadPage(page + 1);
  }, [hasMore, loadPage, loading, loadingMore, page]);

  // Initial fetch + refetch when language changes
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

      const fallbackToLatestNational = async () => {
        try {
          const resp = await fetchPublicNews({ category: 'national', language: effectiveLang, limit: 5 });
          if (resp?.error) return setBreaking([]);
          return setBreaking(Array.isArray(resp?.items) ? resp.items.slice(0, 5) : []);
        } catch {
          return setBreaking([]);
        }
      };

      try {
        const items = await fetchNationalLiveStrip({ lang: effectiveLang });
        if (items.length) return setBreaking(items);

        // Fallback 1: existing backend "live" ticker feed.
        const genericLive = await fetchGenericLiveStrip({ lang: effectiveLang });
        if (genericLive.length) return setBreaking(genericLive);

        // Fallback 2: latest national headlines.
        await fallbackToLatestNational();
      } catch {
        await fallbackToLatestNational();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveLang, initialStories.length, loadPage]);

  // Auto refresh the feed to pick up newly translated stories.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const id = window.setInterval(() => {
      const cur = refreshStateRef.current;
      const curPage = Number(cur?.page || 1) || 1;
      const limit = 20;
      const requested = curPage * limit;

      (async () => {
        try {
          const resp = await fetchPublicNews({ category: 'national', language: effectiveLang, limit: requested });
          if (cancelled) return;
          if (resp?.error) return;
          const items = Array.isArray(resp?.items) ? resp.items : [];
          setHasMore(items.length >= requested);
          setStories(items);
        } catch {
          // keep existing
        }
      })();
    }, AUTO_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [effectiveLang]);

  const regionOptions = React.useMemo(() => {
    return ALL_REGIONS.map((r) => ({
      slug: r.slug,
      label: getRegionName(langKey, r.type, r.slug, r.name),
      name: r.name,
    }));
  }, [langKey]);

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

  const heroLocalizedTitle = React.useMemo(() => {
    if (!hero) return '';
    const { title, content } = localizeArticle(hero, effectiveLang);
    return String(title || hero?.title || '').trim();
  }, [effectiveLang, hero]);

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

  const nationalHierarchyItems: CategoryStoryHierarchyItem[] = sortedStories.map((story) => {
    const href = storyHref(story, effectiveLang);
    const { title, content } = localizeArticle(story, effectiveLang);
    const safeTitle = String(title || story?.title || t('common.untitled')).trim();
    const localizedSummary = String(content || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const tags = tagList(story?.tags);
    const tag = tags[0] || String(story?.topic || story?.section || 'National').trim();
    const where = storyLocation(story);

    return {
      id: String(story?._id || story?.id || story?.slug || safeTitle).trim(),
      href,
      title: safeTitle,
      titleText: safeTitle,
      summary: localizedSummary || storyExcerpt(story),
      summaryText: localizedSummary || storyExcerpt(story),
      imageSrc: storyImage(story),
      imageFitMode: 'cover',
      label: tag || 'National',
      meta: [where].filter(Boolean),
      dateIso: storyDateIso(story),
      readingTime: '',
      raw: story,
    } satisfies CategoryStoryHierarchyItem;
  });

  const nationalTopContent = (
    <CategoryDeskHeader
      eyebrow="NATIONAL DESK • INDIA"
      title="National Pulse – India"
      description="Latest national news, politics, government and major developments from across India."
      actionLayoutBreakpoint="lg"
      contentClassName="lg:flex-[1_1_60%] lg:max-w-[65%]"
      actionsClassName="md:max-w-none lg:flex-[1_1_38%] lg:max-w-[42%] lg:self-start"
      actions={(
        <div className="w-full">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('nationalPage.searchPlaceholder')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-newsPulse-navy outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      )}
    >
        <Link href="/national/states" className="inline-flex w-fit text-sm font-semibold text-newsPulse-blue hover:underline">
          {t('nationalPage.browseStates')}
        </Link>

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
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900/60'
              )}
              aria-pressed={selectedTopic === chip}
            >
              {tTopicChip(chip)}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,320px)_minmax(160px,220px)_1fr] lg:items-center">
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
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
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
            aria-label={t('nationalPage.sortStories')}
          >
            <option value="latest">{t('nationalPage.sortLatest')}</option>
            <option value="most-read">{t('nationalPage.sortMostRead')}</option>
          </select>

          <div className="hidden items-center justify-end text-xs text-slate-500 lg:flex dark:text-gray-400">
            {t('nationalPage.showing')} {sortedStories.length} {t('nationalPage.stories')}
          </div>
        </div>
    </CategoryDeskHeader>
  );

  return (
    <>
      <Head>
        <title>{t('nationalPage.headTitle')}</title>
        <meta name="description" content={t('nationalPage.headDescription')} />
      </Head>

      <NewsPulseCategoryShell
        activeCategory="national"
        latestItems={stories}
        lang={effectiveLang}
        tickerContent={(
          <BreakingTicker items={breaking as any} variant="live" className="overflow-hidden rounded-xl border-0" />
        )}
        topContent={nationalTopContent}
      >
        <div className="min-w-0 text-slate-900 dark:text-gray-100">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

          <CategoryStoryHierarchy
            items={nationalHierarchyItems}
            categoryLabel="National News"
            topLabel={t('nationalPage.topStory')}
            keyLabel="Key National Stories"
            latestLabel="Latest National Stories"
            loadMoreLabel="Load More National Stories"
            emptyTitle="No news found"
            loading={loading}
            hasMore={hasMore}
            loadingMore={loadingMore}
            loadMoreError={loadMoreError}
            autoLoadMore
            onLoadMore={loadNextPage}
            renderTopActions={() => (
              hero ? (
                <>
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
                </>
              ) : null
            )}
          />
        </div>
      </NewsPulseCategoryShell>
    </>
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
    const apiBase = String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
    if (!apiBase) {
      return { props: { lang, data: [], breaking: [], messages } };
    }

    const limit = 40;
    const params = new URLSearchParams();
    params.set('category', 'national');
    params.set('lang', lang);
    params.set('language', lang);
    params.set('limit', String(limit));

    const endpoint = `${apiBase}/api/public/news?${params.toString()}`;
    const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    const json = await res.json().catch(() => null);
    const items = Array.isArray(json?.items) ? json.items : Array.isArray(json?.articles) ? json.articles : Array.isArray(json?.data) ? json.data : [];

    // LIVE UPDATES strip (national-only): use ticker endpoint with fallback to latest national stories.
    const breaking = await (async () => {
      try {
        const items = await fetchNationalLiveStrip({ lang });
        if (items.length) return items;
      } catch {
        // ignore
      }

      // Fallback 1: existing live ticker feed.
      try {
        const items = await fetchGenericLiveStrip({ lang });
        if (items.length) return items;
      } catch {
        // ignore
      }

      try {
        const resp = await fetchPublicNews({ category: 'national', language: lang, limit: 5 });
        if (resp?.error) return [];
        return Array.isArray(resp?.items) ? resp.items.slice(0, 5) : [];
      } catch {
        return [];
      }
    })();

    return {
      props: {
        lang,
        data: Array.isArray(items) ? items : [],
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
