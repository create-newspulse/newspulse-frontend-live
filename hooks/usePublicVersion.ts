import { useEffect, useRef, useState } from 'react';

import { dispatchPublicDataRefresh } from '../lib/publicDataRefresh';
import { fetchPublicVersion } from '../lib/publicVersion';

type UsePublicVersionResult = {
  version: string | null;
  updatedAt: string | null;
  isLoading: boolean;
  error: string | null;
};

const DEFAULT_VERSION_POLL_MS = 15_000;
const VERSION_DEDUPE_MS = 5_000;

export function usePublicVersion(pollMs: number = DEFAULT_VERSION_POLL_MS): UsePublicVersionResult {
  const [version, setVersion] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const versionRef = useRef<string | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);
  const lastCheckedAtRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const effectivePollMs = Number.isFinite(Number(pollMs)) && Number(pollMs) > 0
      ? Math.max(DEFAULT_VERSION_POLL_MS, Number(pollMs))
      : DEFAULT_VERSION_POLL_MS;

    let cancelled = false;

    const checkVersion = (source: 'initial' | 'poll' | 'focus' | 'visible') => {
      const now = Date.now();
      if (inFlightRef.current) return;
      if (source !== 'initial' && now - lastCheckedAtRef.current < VERSION_DEDUPE_MS) return;

      const controller = new AbortController();
      inFlightRef.current = controller;
      lastCheckedAtRef.current = now;

      if (versionRef.current == null) setIsLoading(true);

      void fetchPublicVersion({ signal: controller.signal })
        .then((next) => {
          if (cancelled || controller.signal.aborted) return;

          const previousVersion = versionRef.current;
          versionRef.current = next.version;
          setVersion(next.version);
          setUpdatedAt(next.updatedAt);
          setError(null);
          setIsLoading(false);

          if (previousVersion && next.version && previousVersion !== next.version) {
            dispatchPublicDataRefresh({
              version: next.version,
              previousVersion,
              source,
            });
          }
        })
        .catch((err: any) => {
          if (cancelled || controller.signal.aborted) return;
          setError(String(err?.message || 'PUBLIC_VERSION_FETCH_FAILED'));
          setIsLoading(false);
        })
        .finally(() => {
          if (inFlightRef.current === controller) inFlightRef.current = null;
        });
    };

    checkVersion('initial');

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      checkVersion('poll');
    }, effectivePollMs);

    const onFocus = () => checkVersion('focus');
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkVersion('visible');
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      inFlightRef.current?.abort();
    };
  }, [pollMs]);

  return { version, updatedAt, isLoading, error };
}