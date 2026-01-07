import React from 'react';

import {
  DEFAULT_PUBLIC_SETTINGS,
  getHomeModuleOrder,
  getTickerSpeedSeconds,
  isHomeModuleEnabled,
  isTickerEnabled,
  shouldTickerShowWhenEmpty,
  getPublicSettings,
  type HomeModuleKey,
  type LanguageTheme,
  type PublicSettings,
  type PublishedTickerSettings,
  mergePublicSettingsWithDefaults,
} from '../lib/publicSettings';

export type PublicSettingsContextValue = {
  publicSettings: PublicSettings;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;

  // Convenience getters for UI modules.
  isModuleEnabled: (key: HomeModuleKey, fallback?: boolean) => boolean;
  moduleOrder: (key: HomeModuleKey, fallback?: number) => number;
  ticker: (key: 'breaking' | 'live', fallback?: Partial<PublishedTickerSettings>) => PublishedTickerSettings;
  isTickerEnabled: (key: 'breaking' | 'live', fallback?: boolean) => boolean;
  footerText: () => string | null;
  liveTvEmbedUrl: () => string;
  languageTheme: () => LanguageTheme | null;
};

const PublicSettingsContext = React.createContext<PublicSettingsContextValue | undefined>(undefined);

export function PublicSettingsProvider({ children }: { children: React.ReactNode }) {
  const [publicSettings, setPublicSettings] = React.useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const settingsSource = String(process.env.NEXT_PUBLIC_SETTINGS_SOURCE || 'backend').toLowerCase();
  const useLocalOnly = settingsSource === 'local';

  const load = React.useCallback(async () => {
    if (useLocalOnly) {
      // Escape hatch: ignore published settings entirely.
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getPublicSettings();
      const next = mergePublicSettingsWithDefaults(data);
      setPublicSettings(next);
    } catch (e: any) {
      // Safe defaults (all modules enabled) should render even if backend is down.
      setPublicSettings(DEFAULT_PUBLIC_SETTINGS);
      setError(String(e?.message || 'PUBLIC_SETTINGS_LOAD_FAILED'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const value = React.useMemo<PublicSettingsContextValue>(
    () => ({
      publicSettings,
      isLoading,
      error,
      refetch: load,

      isModuleEnabled: (key, fallback = true) => isHomeModuleEnabled(publicSettings, key, fallback),
      moduleOrder: (key, fallback = 0) => getHomeModuleOrder(publicSettings, key, fallback),
      ticker: (key, fallback) => {
        const enabledFallback = typeof fallback?.enabled === 'boolean' ? fallback.enabled : true;
        const speedFallback = typeof fallback?.speedSeconds === 'number' ? fallback.speedSeconds : (key === 'breaking' ? 18 : 24);
        const showEmptyFallback = typeof fallback?.showWhenEmpty === 'boolean' ? fallback.showWhenEmpty : true;
        return {
          enabled: isTickerEnabled(publicSettings, key, enabledFallback),
          speedSeconds: getTickerSpeedSeconds(publicSettings, key, speedFallback),
          showWhenEmpty: shouldTickerShowWhenEmpty(publicSettings, key, showEmptyFallback),
        };
      },
      isTickerEnabled: (key, fallback = true) => isTickerEnabled(publicSettings, key, fallback),
      footerText: () => {
        const v = publicSettings?.footerText;
        return typeof v === 'string' && v.trim() ? v.trim() : null;
      },
      liveTvEmbedUrl: () => {
        const v = (publicSettings as any)?.modules?.liveTvCard?.url;
        return typeof v === 'string' ? v : '';
      },
      languageTheme: () => (publicSettings?.languageTheme && Object.keys(publicSettings.languageTheme).length ? publicSettings.languageTheme : null),
    }),
    [publicSettings, isLoading, error, load]
  );

  return <PublicSettingsContext.Provider value={value}>{children}</PublicSettingsContext.Provider>;
}

// Alias exports to match naming in product requirements.
export const PublicSiteSettingsProvider = PublicSettingsProvider;
export function usePublicSiteSettings(): PublicSettingsContextValue {
  return usePublicSettings();
}

export function usePublicSettings(): PublicSettingsContextValue {
  const ctx = React.useContext(PublicSettingsContext);
  if (!ctx) {
    // Provider should be installed at app root. Return complete fallback.
    const fallback = DEFAULT_PUBLIC_SETTINGS;
    return {
      publicSettings: fallback,
      isLoading: false,
      error: 'PUBLIC_SETTINGS_PROVIDER_MISSING',
      refetch: async () => {},
      isModuleEnabled: (key, fb = true) => isHomeModuleEnabled(fallback, key, fb),
      moduleOrder: (key, fb = 0) => getHomeModuleOrder(fallback, key, fb),
      ticker: (key, fb) => {
        const enabledFallback = typeof fb?.enabled === 'boolean' ? fb.enabled : true;
        const speedFallback = typeof fb?.speedSeconds === 'number' ? fb.speedSeconds : (key === 'breaking' ? 18 : 24);
        const showEmptyFallback = typeof fb?.showWhenEmpty === 'boolean' ? fb.showWhenEmpty : true;
        return {
          enabled: isTickerEnabled(fallback, key, enabledFallback),
          speedSeconds: getTickerSpeedSeconds(fallback, key, speedFallback),
          showWhenEmpty: shouldTickerShowWhenEmpty(fallback, key, showEmptyFallback),
        };
      },
      isTickerEnabled: (key, fb = true) => isTickerEnabled(fallback, key, fb),
      footerText: () => {
        const v = fallback?.footerText;
        return typeof v === 'string' && v.trim() ? v.trim() : null;
      },
      liveTvEmbedUrl: () => {
        const v = (fallback as any)?.modules?.liveTvCard?.url;
        return typeof v === 'string' ? v : '';
      },
      languageTheme: () => (fallback?.languageTheme && Object.keys(fallback.languageTheme).length ? fallback.languageTheme : null),
    };
  }
  return ctx;
}
