import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getPublicApiBaseUrl } from '../lib/publicApiBase';

export type FeatureFlagKey = 'comments.enabled' | 'voice.enabled' | 'askAnchor.enabled';
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

type FeatureFlagContextValue = {
  flags: Partial<FeatureFlags>;
  isLoading: boolean;
  isEnabled: (key: FeatureFlagKey, fallback?: boolean) => boolean;
  refresh: () => Promise<void>;
};

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

const DEFAULT_KEYS: FeatureFlagKey[] = ['comments.enabled', 'voice.enabled', 'askAnchor.enabled'];
const TTL_MS = 60_000;

let cached: { fetchedAt: number; flags: Partial<FeatureFlags> } | null = null;

async function fetchPublicSettings(keys: FeatureFlagKey[]): Promise<Partial<FeatureFlags>> {
  const base = getPublicApiBaseUrl();
  const qs = encodeURIComponent(keys.join(','));
  const res = await fetch(`${base}/api/public/settings?keys=${qs}`, { headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok !== true || !data.settings) return {};
  return data.settings as Partial<FeatureFlags>;
}

async function getFlagsWithCache(keys: FeatureFlagKey[]): Promise<Partial<FeatureFlags>> {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < TTL_MS) return cached.flags;
  const flags = await fetchPublicSettings(keys);
  cached = { fetchedAt: now, flags };
  return flags;
}

export function FeatureFlagProvider({
  children,
  initialFlags,
}: {
  children: React.ReactNode;
  initialFlags?: Partial<FeatureFlags>;
}) {
  const [flags, setFlags] = useState<Partial<FeatureFlags>>(() => initialFlags ?? {});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const mounted = useRef(false);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const nextFlags = await getFlagsWithCache(DEFAULT_KEYS);
      if (mounted.current) setFlags((prev) => ({ ...prev, ...nextFlags }));
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    // SSR-friendly: only fetch in the browser.
    refresh().catch(() => {});
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<FeatureFlagContextValue>(() => {
    const isEnabled = (key: FeatureFlagKey, fallback: boolean = true) => {
      const v = flags[key];
      return typeof v === 'boolean' ? v : fallback;
    };

    return { flags, isLoading, isEnabled, refresh };
  }, [flags, isLoading]);

  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>;
}

export function useFeatureFlags(): FeatureFlagContextValue {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) {
    return {
      flags: {},
      isLoading: false,
      isEnabled: (_k: FeatureFlagKey, fallback: boolean = true) => fallback,
      refresh: async () => {},
    };
  }
  return ctx;
}
