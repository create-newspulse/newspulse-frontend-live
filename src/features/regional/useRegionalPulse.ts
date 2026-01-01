import { useEffect, useMemo, useState } from "react";
import type { City, District, FilterKey, NewsItem } from "./types";
import { FILTERS } from "./types";
import { FALLBACK_TOP_CITIES, FALLBACK_DISTRICTS } from "./fallback";
import { fetchCivicMetrics, fetchRegionalNews, fetchYouthVoices } from "./api";

export function useRegionalPulse(stateSlug: string, language?: string) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [cities] = useState<City[]>(FALLBACK_TOP_CITIES);
  const [districts] = useState<District[]>(FALLBACK_DISTRICTS);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [youth, setYouth] = useState<NewsItem[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [n, y, m] = await Promise.all([
        fetchRegionalNews(stateSlug, language),
        fetchYouthVoices(stateSlug, language),
        fetchCivicMetrics(stateSlug),
      ]);
      if (cancelled) return;
      setNews(n);
      setYouth(y);
      setMetrics(m);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [stateSlug, language]);

  const filteredCities = useMemo(() => {
    const q = query.toLowerCase();
    return cities.filter((c) => {
      const byQuery = !q || c.name.toLowerCase().includes(q);
      const byFilter =
        filter === "all" ||
        (filter === "smart" && c.badges?.includes("Smart City")) ||
        (filter === "industrial" && c.badges?.some((b) => /Industrial|Refinery|Ceramics|Port/i.test(b))) ||
        (filter === "coastal" && c.badges?.includes("Coastal")) ||
        (filter === "tribal" && c.badges?.includes("Tribal"));
      return byQuery && byFilter;
    });
  }, [cities, filter, query]);

  const highlightsText = useMemo(() => {
    return news
      .slice(0, 5)
      .map((n) => n.title + ". ")
      .join(" ");
  }, [news]);

  return {
    FILTERS,
    filter,
    setFilter,
    query,
    setQuery,
    filteredCities,
    districts,
    news,
    youth,
    metrics,
    highlightsText,
    loading,
  } as const;
}

export type UseRegionalPulseReturn = ReturnType<typeof useRegionalPulse>;
