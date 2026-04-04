import { useEffect, useState } from 'react';

import {
  DEFAULT_PUBLIC_FOUNDER_TOGGLES,
  fetchPublicFounderToggles,
  type PublicFounderToggles,
} from '../lib/publicFounderToggles';

export function usePublicFounderToggles() {
  const [toggles, setToggles] = useState<PublicFounderToggles>(DEFAULT_PUBLIC_FOUNDER_TOGGLES);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    fetchPublicFounderToggles()
      .then((next) => {
        if (!cancelled) {
          setToggles(next);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { toggles, isLoading } as const;
}