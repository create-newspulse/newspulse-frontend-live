import { useCallback, useEffect, useMemo, useState } from "react";
import { getRegionalFeed, getGujaratDistricts, getTopCities, matchesCity, matchesDistrict } from "./api";
import type { RegionalArticle, City, District, RegionalFilters } from "./types";

export function useRegionalPulse() {
  const [topCities] = useState<City[]>(() => getTopCities());
  const [districts] = useState<District[]>(() => getGujaratDistricts());
  const [rawFeed, setRawFeed] = useState<RegionalArticle[]>([]);
  const [filters, setFilters] = useState<RegionalFilters>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await getRegionalFeed(60);
      setRawFeed(items);
    } catch (e: any) {
      setError(e?.message || "Failed to load regional feed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const feed = useMemo(() => {
    const q = (filters.query || "").toLowerCase().trim();
    let list = rawFeed;
    if (filters.districtName) {
      list = list.filter((a) => matchesDistrict(a, filters.districtName!));
    }
    if (filters.cityName) {
      list = list.filter((a) => matchesCity(a, filters.cityName!));
    }
    if (q) {
      list = list.filter((a) => (a.title || "").toLowerCase().includes(q) || (a.excerpt || a.content || "").toLowerCase().includes(q));
    }
    return list;
  }, [rawFeed, filters]);

  return {
    topCities,
    districts,
    feed,
    filters,
    setFilters,
    loading,
    error,
    refresh: fetchFeed,
  } as const;
}

export type UseRegionalPulseReturn = ReturnType<typeof useRegionalPulse>;
