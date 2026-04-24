import { useEffect, useRef, useState } from 'react';

import { subscribePublicDataRefresh } from '../lib/publicDataRefresh';
import { isSafeMode } from '../utils/safeMode';

export type AdSlotName = 'HOME_728x90' | 'HOME_LEFT_300x250' | 'HOME_LEFT_300x600' | 'HOME_RIGHT_300x250' | 'ARTICLE_INLINE';

type AdSettingsResponse = {
  ok: boolean;
  slotEnabled: Partial<Record<AdSlotName, boolean>>;
};

const DEFAULT_SLOT_ENABLED: Record<AdSlotName, boolean> = {
  HOME_728x90: true,
  HOME_LEFT_300x250: true,
  HOME_LEFT_300x600: true,
  HOME_RIGHT_300x250: true,
  ARTICLE_INLINE: true,
};

function coerceEnabled(value: unknown): boolean {
  if (value === false) return false;
  if (value === 0) return false;
  if (value == null) return true;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return true;
  if (raw === 'false' || raw === '0' || raw === 'off' || raw === 'disabled' || raw === 'no') return false;
  return true;
}

let cachedSlotEnabled: Record<AdSlotName, boolean> | null = null;
let inFlight: Promise<Record<AdSlotName, boolean>> | null = null;

async function fetchSlotEnabledOnce(): Promise<Record<AdSlotName, boolean>> {
  if (typeof window === 'undefined') return DEFAULT_SLOT_ENABLED;
  if (cachedSlotEnabled) return cachedSlotEnabled;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const url = '/api/public/ad-settings';
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => null)) as AdSettingsResponse | null;

      const slotEnabledRaw = json && typeof json === 'object' ? (json as any).slotEnabled : null;
      const next: Record<AdSlotName, boolean> = {
        HOME_728x90: coerceEnabled(slotEnabledRaw?.HOME_728x90),
        HOME_LEFT_300x250: coerceEnabled(slotEnabledRaw?.HOME_LEFT_300x250),
        HOME_LEFT_300x600: coerceEnabled(slotEnabledRaw?.HOME_LEFT_300x600),
        HOME_RIGHT_300x250: coerceEnabled(slotEnabledRaw?.HOME_RIGHT_300x250),
        ARTICLE_INLINE: coerceEnabled(slotEnabledRaw?.ARTICLE_INLINE),
      };

      cachedSlotEnabled = next;
      return next;
    } catch {
      // Fail open: do not hide ads on failure.
      cachedSlotEnabled = DEFAULT_SLOT_ENABLED;
      return DEFAULT_SLOT_ENABLED;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

async function refreshSlotEnabled(): Promise<Record<AdSlotName, boolean>> {
  // Always refetch (no memo short-circuit), but dedupe concurrent calls.
  if (typeof window === 'undefined') return DEFAULT_SLOT_ENABLED;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const url = '/api/public/ad-settings';
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
        cache: 'no-store',
      });
      const json = (await res.json().catch(() => null)) as AdSettingsResponse | null;

      const slotEnabledRaw = json && typeof json === 'object' ? (json as any).slotEnabled : null;
      const next: Record<AdSlotName, boolean> = {
        HOME_728x90: coerceEnabled(slotEnabledRaw?.HOME_728x90),
        HOME_LEFT_300x250: coerceEnabled(slotEnabledRaw?.HOME_LEFT_300x250),
        HOME_LEFT_300x600: coerceEnabled(slotEnabledRaw?.HOME_LEFT_300x600),
        HOME_RIGHT_300x250: coerceEnabled(slotEnabledRaw?.HOME_RIGHT_300x250),
        ARTICLE_INLINE: coerceEnabled(slotEnabledRaw?.ARTICLE_INLINE),
      };
      cachedSlotEnabled = next;
      return next;
    } catch {
      cachedSlotEnabled = cachedSlotEnabled || DEFAULT_SLOT_ENABLED;
      return cachedSlotEnabled;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function useAdSettings() {
  const [slotEnabled, setSlotEnabled] = useState<Record<AdSlotName, boolean> | null>(cachedSlotEnabled);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const SAFE_MODE = isSafeMode();

  const doRefresh = () => {
    if (inFlightRef.current) return;
    inFlightRef.current = refreshSlotEnabled()
      .then((map) => setSlotEnabled(map))
      .finally(() => {
        inFlightRef.current = null;
      });
  };

  useEffect(() => {
    let cancelled = false;

    fetchSlotEnabledOnce().then((map) => {
      if (cancelled) return;
      setSlotEnabled(map);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (SAFE_MODE) return;

    return subscribePublicDataRefresh(() => {
      doRefresh();
    });
  }, [SAFE_MODE]);

  return { slotEnabled };
}
