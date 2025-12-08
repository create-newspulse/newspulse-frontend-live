import { useEffect, useState } from 'react';

export interface CommunityReporterConfig {
  communityMyStoriesEnabled: boolean;
}

export function useCommunityReporterConfig() {
  const [config, setConfig] = useState<CommunityReporterConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    // Use new public settings endpoint
    fetch('/api/public/community/settings', { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data && data.ok && data.settings) {
          const enabled = Boolean(data.settings.allowMyStoriesPortal);
          setConfig({ communityMyStoriesEnabled: enabled });
        } else {
          setError('CONFIG_FETCH_FAILED');
        }
      })
      .catch(() => {
        if (!cancelled) setError('CONFIG_FETCH_EXCEPTION');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, isLoading, error } as const;
}
