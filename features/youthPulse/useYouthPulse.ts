import { useCallback, useEffect, useRef, useState } from "react";
import { getYouthTopics, getYouthTrendingByLanguage, getYouthByCategory } from "./api";
import type { YouthCategory, YouthStory } from "./types";
import { useLanguage } from "../../utils/LanguageContext";
import { useI18n } from "../../src/i18n/LanguageProvider";

export function useYouthPulse(trendingLimit: number = 12) {
  const { language } = useLanguage();
  const { t } = useI18n();
  const [topics, setTopics] = useState<YouthCategory[]>([]);
  const [trending, setTrending] = useState<YouthStory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const inFlightRef = useRef<AbortController | null>(null);
  const fetchSeqRef = useRef(0);

  const fetchAll = useCallback(async () => {
    fetchSeqRef.current += 1;
    const seq = fetchSeqRef.current;

    if (inFlightRef.current) {
      try { inFlightRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    inFlightRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const [t, tr] = await Promise.all([
        getYouthTopics(),
        getYouthTrendingByLanguage(trendingLimit, language, { signal: controller.signal }),
      ]);

      if (controller.signal.aborted || seq !== fetchSeqRef.current) return;
      setTopics(t);
      setTrending(tr);
    } catch (e: any) {
      if (e && e.name === 'AbortError') return;
      setError(e?.message || t('youthPulse.failedToLoad'));
    } finally {
      if (controller.signal.aborted || seq !== fetchSeqRef.current) return;
      setLoading(false);
    }
  }, [language, t, trendingLimit]);

  useEffect(() => {
    fetchAll();
    return () => {
      fetchSeqRef.current += 1;
      if (inFlightRef.current) {
        try { inFlightRef.current.abort(); } catch {}
      }
    };
  }, [fetchAll]);

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
