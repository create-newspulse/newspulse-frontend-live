import React from 'react';

import {
  DEFAULT_PUBLIC_SETTINGS_RESPONSE,
  fetchPublicSettings,
  type PublicSettings,
  type PublicSettingsResponse,
} from '../lib/publicSettings';

export type PublicSettingsContextValue = {
  settings: PublicSettings;
  version: string | null;
  updatedAt: string | null;
  hasLoaded: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const PublicSettingsContext = React.createContext<PublicSettingsContextValue | undefined>(undefined);

export function PublicSettingsProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = React.useState<PublicSettingsResponse>(DEFAULT_PUBLIC_SETTINGS_RESPONSE);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = React.useState<boolean>(false);
  const loggedRef = React.useRef(false);

  const settingsSource = String(process.env.NEXT_PUBLIC_SETTINGS_SOURCE || 'backend').toLowerCase();
  const useLocalOnly = settingsSource === 'local';

  const load = React.useCallback(async () => {
    if (useLocalOnly) {
      // Escape hatch: ignore published settings entirely.
      setLoading(false);
      setError(null);
      setHasLoaded(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const next = await fetchPublicSettings();
      setSnapshot(next);
      setHasLoaded(true);

      if (process.env.NODE_ENV === 'development' && !loggedRef.current) {
        loggedRef.current = true;
        // DEV-only debugging hook
        // eslint-disable-next-line no-console
        console.log('[PublicSettings] Loaded published settings', {
          updatedAt: next?.updatedAt ?? null,
          version: next?.version ?? null,
          settings: next?.settings,
        });
      }
    } catch (e: any) {
      // Keep defaults to avoid UI changes/spoiling.
      setError(String(e?.message || 'PUBLIC_SETTINGS_LOAD_FAILED'));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Refresh on focus/visibility so publish changes show up quickly.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (useLocalOnly) return;

    const onFocus = () => {
      void load();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  // Lightweight polling (20s) to reflect admin publishes without manual refresh.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (useLocalOnly) return;
    const POLL_MS = 20_000;
    const id = window.setInterval(() => {
      void load();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const value = React.useMemo<PublicSettingsContextValue>(
    () => ({
      settings: snapshot.settings,
      version: snapshot.version,
      updatedAt: snapshot.updatedAt,
      hasLoaded,
      loading,
      error,
      refetch: load,
    }),
    [snapshot, hasLoaded, loading, error, load]
  );

  return <PublicSettingsContext.Provider value={value}>{children}</PublicSettingsContext.Provider>;
}

export function usePublicSettings(): PublicSettingsContextValue {
  const ctx = React.useContext(PublicSettingsContext);
  if (!ctx) {
    // Provider should be installed at app root.
    return {
      settings: DEFAULT_PUBLIC_SETTINGS_RESPONSE.settings,
      version: null,
      updatedAt: null,
      hasLoaded: false,
      loading: false,
      error: 'PUBLIC_SETTINGS_PROVIDER_MISSING',
      refetch: async () => {},
    };
  }
  return ctx;
}
