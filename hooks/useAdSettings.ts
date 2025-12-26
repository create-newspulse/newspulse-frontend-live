import { useEffect, useState } from 'react';

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

function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '').toString().trim();
  return raw.replace(/\/+$/, '');
}

async function fetchSlotEnabledOnce(): Promise<Record<AdSlotName, boolean>> {
  if (typeof window === 'undefined') return DEFAULT_SLOT_ENABLED;
  if (cachedSlotEnabled) return cachedSlotEnabled;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const base = getApiBase();
      const url = base ? `${base}/api/public/ad-settings` : '/api/public/ad-settings';
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
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

export function useAdSettings() {
  const [slotEnabled, setSlotEnabled] = useState<Record<AdSlotName, boolean> | null>(cachedSlotEnabled);

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

  return { slotEnabled };
}
