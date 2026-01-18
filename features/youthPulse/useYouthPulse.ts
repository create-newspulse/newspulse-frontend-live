import { useCallback, useEffect, useState } from "react";
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
      setError(e?.message || t('youthPulse.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [language, t, trendingLimit]);

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
