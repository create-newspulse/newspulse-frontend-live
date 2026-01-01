import { useCallback, useEffect, useState } from "react";
import { getYouthTopics, getYouthTrendingByLanguage, getYouthByCategory } from "./api";
import type { YouthCategory, YouthStory } from "./types";
import { useLanguage } from "../../utils/LanguageContext";

export function useYouthPulse(trendingLimit: number = 12) {
  const { language } = useLanguage();
  const [topics, setTopics] = useState<YouthCategory[]>([]);
  const [trending, setTrending] = useState<YouthStory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, tr] = await Promise.all([
        getYouthTopics(),
        getYouthTrendingByLanguage(trendingLimit, language),
      ]);
      setTopics(t);
      setTrending(tr);
    } catch (e: any) {
      setError(e?.message || "Failed to load youth pulse data");
    } finally {
      setLoading(false);
    }
  }, [language, trendingLimit]);

  useEffect(() => {
    fetchAll();
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
