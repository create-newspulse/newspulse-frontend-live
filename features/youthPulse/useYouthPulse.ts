import { useCallback, useEffect, useState } from "react";
import { getYouthTopics, getYouthTrending, getYouthByCategory } from "./api";
import type { YouthCategory, YouthStory } from "./types";

export function useYouthPulse() {
  const [topics, setTopics] = useState<YouthCategory[]>([]);
  const [trending, setTrending] = useState<YouthStory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, tr] = await Promise.all([getYouthTopics(), getYouthTrending(6)]);
      setTopics(t);
      setTrending(tr);
    } catch (e: any) {
      setError(e?.message || "Failed to load youth pulse data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    topics,
    trending,
    loading,
    error,
    refresh: fetchAll,
    getByCategory: getYouthByCategory,
  } as const;
}

export type UseYouthPulseReturn = ReturnType<typeof useYouthPulse>;
