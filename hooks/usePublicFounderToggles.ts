import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_PUBLIC_FOUNDER_TOGGLES,
  fetchPublicFounderToggles,
  type PublicFounderToggles,
} from '../lib/publicFounderToggles';
import { subscribePublicDataRefresh } from '../lib/publicDataRefresh';

const FOUNDER_TOGGLE_DEDUPE_MS = 5_000;
const FOUNDER_TOGGLE_POLL_MS = 15_000;

export function usePublicFounderToggles() {
  const [toggles, setToggles] = useState<PublicFounderToggles>(DEFAULT_PUBLIC_FOUNDER_TOGGLES);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef<number>(0);

  const refresh = useCallback(async (opts?: { background?: boolean; force?: boolean }) => {
    if (typeof window === 'undefined') return;
    if (inFlightRef.current) return inFlightRef.current;

    const now = Date.now();
    if (!opts?.force && now - lastRefreshAtRef.current < FOUNDER_TOGGLE_DEDUPE_MS) return;
    lastRefreshAtRef.current = now;

    if (!opts?.background) {
      setIsLoading(true);
    }

    const p = fetchPublicFounderToggles()
      .then((next) => {
        setToggles((prev) => {
          if (
            prev.communityReporterClosed === next.communityReporterClosed &&
            prev.reporterPortalClosed === next.reporterPortalClosed &&
            prev.updatedAt === next.updatedAt
          ) {
            return prev;
          }
          return next;
        });
      })
      .finally(() => {
        if (!opts?.background) {
          setIsLoading(false);
        }
        inFlightRef.current = null;
      });

    inFlightRef.current = p;
    return p;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    return subscribePublicDataRefresh(() => {
      void refresh({ background: true, force: true });
    });
  }, [refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onFocus = () => {
      void refresh({ background: true });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh({ background: true, force: true });
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void refresh({ background: true });
    }, FOUNDER_TOGGLE_POLL_MS);

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  return { toggles, isLoading, refresh } as const;
}