import { useEffect, useMemo, useRef, useState } from 'react';
import { isSafeMode } from '../utils/safeMode';

export type AdSlotName = 'HOME_728x90' | 'HOME_RIGHT_300x250';

type AdSettingsResponse = {
  ok: boolean;
  slotEnabled: Partial<Record<AdSlotName, boolean>>;
};

const DEFAULT_SLOT_ENABLED: Record<AdSlotName, boolean> = {
  HOME_728x90: true,
  HOME_RIGHT_300x250: true,
};

let cachedSlotEnabled: Record<AdSlotName, boolean> | null = null;
let inFlight: Promise<Record<AdSlotName, boolean>> | null = null;

function getPollSec(): number {
  const raw = Number(process.env.NEXT_PUBLIC_PUBLIC_AD_SETTINGS_POLL_SEC || 0);
  return Number.isFinite(raw) && raw > 0 ? Math.min(300, Math.max(5, raw)) : 0;
}

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
        HOME_728x90: slotEnabledRaw?.HOME_728x90 !== false,
        HOME_RIGHT_300x250: slotEnabledRaw?.HOME_RIGHT_300x250 !== false,
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
        HOME_728x90: slotEnabledRaw?.HOME_728x90 !== false,
        HOME_RIGHT_300x250: slotEnabledRaw?.HOME_RIGHT_300x250 !== false,
      };
      cachedSlotEnabled = next;
      return next;
    } catch {
      cachedSlotEnabled = DEFAULT_SLOT_ENABLED;
      return DEFAULT_SLOT_ENABLED;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function useAdSettings() {
  const [slotEnabled, setSlotEnabled] = useState<Record<AdSlotName, boolean> | null>(cachedSlotEnabled);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const pollSec = useMemo(() => getPollSec(), []);
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

  // Auto-refresh without a full page reload.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (SAFE_MODE) return;

    const onMaybeRefresh = () => {
      try {
        if (document.visibilityState && document.visibilityState !== 'visible') return;
      } catch {}
      doRefresh();
    };

    window.addEventListener('focus', onMaybeRefresh);
    document.addEventListener('visibilitychange', onMaybeRefresh);
    return () => {
      window.removeEventListener('focus', onMaybeRefresh);
      document.removeEventListener('visibilitychange', onMaybeRefresh);
    };
  }, [SAFE_MODE]);

  useEffect(() => {
    if (!pollSec) return;
    if (typeof window === 'undefined') return;
    if (SAFE_MODE) return;

    const id = window.setInterval(() => {
      try {
        if (document.visibilityState && document.visibilityState !== 'visible') return;
      } catch {}
      doRefresh();
    }, pollSec * 1000);

    return () => window.clearInterval(id);
  }, [SAFE_MODE, pollSec]);

  return { slotEnabled };
}
