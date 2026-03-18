import React from 'react';

import { subscribePublicDataRefresh } from '../../lib/publicDataRefresh';
import { isSafeMode } from '../../utils/safeMode';

import {
  DEFAULT_NORMALIZED_PUBLIC_SETTINGS,
  fetchPublicSettings,
  type NormalizedPublicSettings,
} from '../lib/publicSettings';

export type HomepageModuleKey = keyof NormalizedPublicSettings['modules'];

export type PublicSettingsContextValue = {
  settings: NormalizedPublicSettings | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;

  // Strict homepage module getters (NO hardcoded defaults).
  isModuleEnabled: (key: HomepageModuleKey) => boolean;
  moduleOrder: (key: HomepageModuleKey) => number;
};

const PublicSettingsContext = React.createContext<PublicSettingsContextValue | undefined>(undefined);

const PUBLIC_SETTINGS_DEDUPE_MS = 5_000;

export function PublicSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<NormalizedPublicSettings | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const SAFE_MODE = isSafeMode();

  const inFlightRef = React.useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = React.useRef<number>(0);

  const load = React.useCallback(async (opts?: { background?: boolean; force?: boolean }) => {
    // Deduplicate overlapping calls (poll + focus + manual refetch).
    if (inFlightRef.current) return inFlightRef.current;

    const now = Date.now();
    if (opts?.background && !opts?.force && now - lastRefreshAtRef.current < PUBLIC_SETTINGS_DEDUPE_MS) return;
    lastRefreshAtRef.current = now;

    const shouldShowLoading = !opts?.background && settings == null;
    if (shouldShowLoading) setIsLoading(true);

    // For background refreshes, keep last-known-good settings visible.
    if (!opts?.background) setError(null);

    const p = (async () => {
      try {
        const next = await fetchPublicSettings();

        // Avoid state churn if nothing changed.
        const prevVersion = settings?.version;
        const nextVersion = next?.version;
        if (prevVersion && nextVersion && prevVersion === nextVersion) {
          return;
        }

        setSettings(next);
      } catch (e: any) {
        // Safe fallback defaults: show all modules.
        if (settings == null) setSettings(DEFAULT_NORMALIZED_PUBLIC_SETTINGS);
        if (!opts?.background) setError(String(e?.message || 'PUBLIC_SETTINGS_LOAD_FAILED'));
      } finally {
        if (shouldShowLoading) setIsLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = p;
    return p;
  }, [settings]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Refresh settings when the shared public version changes.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (SAFE_MODE) return;

    return subscribePublicDataRefresh(() => {
      void load({ background: true, force: true });
    });
  }, [SAFE_MODE, load]);

  const value = React.useMemo<PublicSettingsContextValue>(
    () => ({
      settings,
      isLoading,
      error,
      refetch: load,

      isModuleEnabled: (key) => {
        const v = settings?.modules?.[key]?.enabled;
        // Safe default: if missing, show it.
        return typeof v === 'boolean' ? v : true;
      },
      moduleOrder: (key) => {
        const raw = Number(settings?.modules?.[key]?.order);
        return Number.isFinite(raw) ? raw : Number.POSITIVE_INFINITY;
      },
    }),
    [settings, isLoading, error, load]
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
    // Provider should be installed at app root.
    return {
      settings: DEFAULT_NORMALIZED_PUBLIC_SETTINGS,
      isLoading: false,
      error: 'PUBLIC_SETTINGS_PROVIDER_MISSING',
      refetch: async () => {},
      isModuleEnabled: () => true,
      moduleOrder: () => Number.POSITIVE_INFINITY,
    };
  }
  return ctx;
}
