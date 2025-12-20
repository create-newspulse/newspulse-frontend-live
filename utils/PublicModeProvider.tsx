import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import type { PublicMode, PublicModeResponse } from '../lib/publicMode';
import { fetchPublicMode } from '../lib/publicMode';

type PublicModeContextValue = {
  mode: PublicMode;
  readOnly: boolean;
  externalFetch: boolean;
  isLockdown: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const PublicModeContext = createContext<PublicModeContextValue | null>(null);

const EXEMPT_ROUTES = ['/maintenance', '/privacy', '/terms', '/offline'];

export function PublicModeProvider({
  children,
  initialMode,
}: {
  children: React.ReactNode;
  initialMode?: Partial<PublicModeResponse>;
}) {
  const router = useRouter();
  const [state, setState] = useState<PublicModeResponse>(() => ({
    ok: true,
    mode: initialMode?.mode ?? 'NORMAL',
    readOnly: initialMode?.readOnly ?? false,
    externalFetch: initialMode?.externalFetch ?? true,
  }));
  const [isLoading, setIsLoading] = useState(false);
  const mounted = useRef(false);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPublicMode();
      if (mounted.current) {
        setState(data);
      }
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    // Fetch on mount in browser
    refresh().catch(() => {});
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enforce LOCKDOWN: redirect to /maintenance unless already on exempt route
  useEffect(() => {
    if (state.mode === 'LOCKDOWN') {
      const currentPath = router.pathname;
      const isExempt = EXEMPT_ROUTES.includes(currentPath);
      if (!isExempt && currentPath !== '/maintenance') {
        router.replace('/maintenance').catch(() => {});
      }
    }
  }, [state.mode, router]);

  const value = useMemo<PublicModeContextValue>(
    () => ({
      mode: state.mode,
      readOnly: state.readOnly,
      externalFetch: state.externalFetch,
      isLockdown: state.mode === 'LOCKDOWN',
      isLoading,
      refresh,
    }),
    [state, isLoading]
  );

  return <PublicModeContext.Provider value={value}>{children}</PublicModeContext.Provider>;
}

export function usePublicMode(): PublicModeContextValue {
  const ctx = useContext(PublicModeContext);
  if (!ctx) {
    // Fallback if provider missing
    return {
      mode: 'NORMAL',
      readOnly: false,
      externalFetch: true,
      isLockdown: false,
      isLoading: false,
      refresh: async () => {},
    };
  }
  return ctx;
}
