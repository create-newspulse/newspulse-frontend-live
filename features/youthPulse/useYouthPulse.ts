import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getYouthTopics, getYouthTrendingByLanguage, getYouthByCategory } from "./api";
import type { YouthCategory, YouthStory } from "./types";
import { useLanguage } from "../../utils/LanguageContext";
import { useI18n } from "../../src/i18n/LanguageProvider";

export type InitialYouthFeed = { stories: YouthStory[]; language: string; limit: number };
const EMPTY_STORIES: YouthStory[] = [];

export function useYouthPulse(trendingLimit: number = 12, initialFeed?: InitialYouthFeed) {
  const { language } = useLanguage();
  const { t } = useI18n();
  const [topics, setTopics] = useState<YouthCategory[]>([]);
  const seed = useMemo(() => initialFeed?.language === language && initialFeed.limit === trendingLimit ? initialFeed.stories : EMPTY_STORIES, [initialFeed, language, trendingLimit]);
  const [trending, setTrending] = useState<YouthStory[]>(seed);
  const [loading, setLoading] = useState<boolean>(!seed.length);
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef<AbortController | null>(null);
  const fetchSeqRef = useRef(0);
  const hasStoriesRef = useRef(seed.length > 0);

  const fetchAll = useCallback(async () => {
    fetchSeqRef.current += 1;
    const seq = fetchSeqRef.current;

    if (inFlightRef.current) {
      try { inFlightRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    inFlightRef.current = controller;

    setLoading(!hasStoriesRef.current);
    setError(null);
    try {
      const [t, tr] = await Promise.all([
        getYouthTopics(),
        getYouthTrendingByLanguage(trendingLimit, language, { signal: controller.signal }),
      ]);

      if (controller.signal.aborted || seq !== fetchSeqRef.current) return;
      setTopics(t);
      setTrending(tr);
      hasStoriesRef.current = tr.length > 0;
    } catch (e: any) {
      if (e && e.name === 'AbortError') return;
      if (!hasStoriesRef.current) setError(e?.message || t('youthPulse.failedToLoad'));
    } finally {
      if (controller.signal.aborted || seq !== fetchSeqRef.current) return;
      setLoading(false);
    }
  }, [language, t, trendingLimit]);

  useEffect(() => {
    setTrending(seed);
    hasStoriesRef.current = seed.length > 0;
    setLoading(!seed.length);
    setError(null);
    void getYouthTopics().then(setTopics);
    if (!seed.length) void fetchAll();
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') void fetchAll();
    }, 60_000);
    return () => {
      clearInterval(timer);
      fetchSeqRef.current += 1;
      if (inFlightRef.current) {
        try { inFlightRef.current.abort(); } catch {}
      }
    };
  }, [seed, language, trendingLimit]);

  return {
    topics,
    trending,
    loading,
    error,
    refresh: fetchAll,
    getByCategory: (slug: string) => getYouthByCategory(slug, language),
  } as const;
}

export type UseYouthPulseReturn = ReturnType<typeof useYouthPulse>;
