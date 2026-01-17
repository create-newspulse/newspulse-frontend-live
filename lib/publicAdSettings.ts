import { useEffect, useState } from 'react';

export type AdSlotName = 'HOME_728x90' | 'HOME_RIGHT_300x250';

export type PublicAdSettingsResponse = {
  ok: boolean;
  slotEnabled: Partial<Record<AdSlotName, boolean>>;
};

const DEFAULT: PublicAdSettingsResponse = {
  ok: true,
  slotEnabled: {
    HOME_728x90: true,
    HOME_RIGHT_300x250: true,
  },
};

let cached: PublicAdSettingsResponse | null = null;
let inFlight: Promise<PublicAdSettingsResponse> | null = null;

function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE || '').toString().trim();
  return raw.replace(/\/+$/, '');
}

export function isAdSlotEnabled(settings: PublicAdSettingsResponse | null | undefined, slot: AdSlotName): boolean {
  // Fail open: missing settings or missing key means enabled.
  return settings?.slotEnabled?.[slot] !== false;
}

export async function fetchPublicAdSettingsOnce(): Promise<PublicAdSettingsResponse> {
  // This helper is meant for client-side usage.
  if (typeof window === 'undefined') return DEFAULT;
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const base = getApiBase();
      if (!base) return DEFAULT;
      const url = `${base}/api/public/ad-settings`;

      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json().catch(() => null)) as any;

      const slotEnabledRaw = data && typeof data === 'object' ? data.slotEnabled : null;
      const normalized: PublicAdSettingsResponse = {
        ok: data?.ok === true,
        slotEnabled: {
          HOME_728x90: slotEnabledRaw?.HOME_728x90 !== false,
          HOME_RIGHT_300x250: slotEnabledRaw?.HOME_RIGHT_300x250 !== false,
        },
      };

      cached = normalized;
      return normalized;
    } catch {
      cached = DEFAULT;
      return DEFAULT;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function usePublicAdSettings() {
  const [settings, setSettings] = useState<PublicAdSettingsResponse | null>(cached);
  const [loaded, setLoaded] = useState<boolean>(!!cached);

  useEffect(() => {
    let cancelled = false;

    fetchPublicAdSettingsOnce()
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSettings(DEFAULT);
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loaded };
}
