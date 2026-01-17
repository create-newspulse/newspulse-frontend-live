import { getPublicApiBaseUrl } from './publicApiBase';

export type BroadcastType = 'breaking' | 'live';
export type BroadcastMode = 'AUTO' | 'FORCE_ON' | 'FORCE_OFF';

export type BroadcastItem = {
  _id?: string;
  id?: string;
  text?: string;
  title?: string;
  createdAt?: string;
  publishedAt?: string;
  updatedAt?: string;
  type?: BroadcastType | string;
};

export type BroadcastTickerSettings = {
  enabled: boolean;
  mode: BroadcastMode;
  speedSec: number;
};

export type PublicBroadcast = {
  ok: boolean;
  meta: {
    hasSettings: boolean;
  };
  settings: {
    breaking: BroadcastTickerSettings;
    live: BroadcastTickerSettings;
  };
  items: {
    breaking: BroadcastItem[];
    live: BroadcastItem[];
  };
};

const DEFAULT_BREAKING_SETTINGS: BroadcastTickerSettings = {
  enabled: true,
  mode: 'AUTO',
  speedSec: 18,
};

const DEFAULT_LIVE_SETTINGS: BroadcastTickerSettings = {
  enabled: true,
  mode: 'AUTO',
  speedSec: 24,
};

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function normalizeMode(v: unknown): BroadcastMode {
  const s = String(v || '')
    .trim()
    .toUpperCase();
  if (s === 'FORCE_ON' || s === 'FORCE_OFF' || s === 'AUTO') return s as BroadcastMode;
  return 'AUTO';
}

function asArray<T = any>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function normalizePublicBroadcast(raw: unknown): PublicBroadcast {
  const root = raw && typeof raw === 'object' ? (raw as any) : null;

  const settingsRaw = root?.settings ?? root?.data?.settings ?? null;
  const itemsRaw = root?.items ?? root?.data?.items ?? root?.data ?? null;

  const breakingSettingsRaw = settingsRaw?.breaking ?? settingsRaw?.tickers?.breaking ?? settingsRaw?.breakingTicker ?? null;
  const liveSettingsRaw = settingsRaw?.live ?? settingsRaw?.tickers?.live ?? settingsRaw?.liveTicker ?? null;

  const hasBreakingSettings =
    !!breakingSettingsRaw &&
    typeof breakingSettingsRaw === 'object' &&
    ('enabled' in (breakingSettingsRaw as any) || 'mode' in (breakingSettingsRaw as any) || 'speedSec' in (breakingSettingsRaw as any) || 'speedSeconds' in (breakingSettingsRaw as any));
  const hasLiveSettings =
    !!liveSettingsRaw &&
    typeof liveSettingsRaw === 'object' &&
    ('enabled' in (liveSettingsRaw as any) || 'mode' in (liveSettingsRaw as any) || 'speedSec' in (liveSettingsRaw as any) || 'speedSeconds' in (liveSettingsRaw as any));
  const hasSettings = Boolean(root?._meta?.hasSettings ?? (hasBreakingSettings || hasLiveSettings));

  const settings = {
    breaking: {
      enabled: Boolean(breakingSettingsRaw?.enabled ?? DEFAULT_BREAKING_SETTINGS.enabled),
      mode: normalizeMode(breakingSettingsRaw?.mode ?? DEFAULT_BREAKING_SETTINGS.mode),
      speedSec: clampNum(breakingSettingsRaw?.speedSec ?? breakingSettingsRaw?.speedSeconds, 5, 300, DEFAULT_BREAKING_SETTINGS.speedSec),
    },
    live: {
      enabled: Boolean(liveSettingsRaw?.enabled ?? DEFAULT_LIVE_SETTINGS.enabled),
      mode: normalizeMode(liveSettingsRaw?.mode ?? DEFAULT_LIVE_SETTINGS.mode),
      speedSec: clampNum(liveSettingsRaw?.speedSec ?? liveSettingsRaw?.speedSeconds, 5, 300, DEFAULT_LIVE_SETTINGS.speedSec),
    },
  };

  // Items may arrive as { breaking: [], live: [] } or as a flat list with type.
  let breaking = asArray<BroadcastItem>(itemsRaw?.breaking);
  let live = asArray<BroadcastItem>(itemsRaw?.live);

  if (!breaking.length && !live.length) {
    const flat = asArray<BroadcastItem>(itemsRaw);
    if (flat.length) {
      breaking = flat.filter((it) => String((it as any)?.type || '').toLowerCase() === 'breaking');
      live = flat.filter((it) => String((it as any)?.type || '').toLowerCase() === 'live');
    }
  }

  return {
    ok: root?.ok !== false,
    meta: { hasSettings },
    settings,
    items: {
      breaking,
      live,
    },
  };
}

export function shouldRenderTicker(s: BroadcastTickerSettings): boolean {
  if (!s) return false;
  if (s.mode === 'FORCE_OFF') return false;
  if (s.mode === 'FORCE_ON') return true;
  return s.enabled === true;
}

export function itemToTickerText(item: BroadcastItem): string | null {
  const t = String(item?.text ?? item?.title ?? '').trim();
  return t ? t : null;
}

export function toTickerTexts(items: BroadcastItem[]): string[] {
  return (items || []).map(itemToTickerText).filter(Boolean) as string[];
}

export async function fetchPublicBroadcast(options?: { signal?: AbortSignal }): Promise<PublicBroadcast> {
  const isBrowser = typeof window !== 'undefined';
  const base = getPublicApiBaseUrl();
  const primaryEndpoint = isBrowser ? '/public-api/broadcast' : `${base}/api/public/broadcast`;
  const fallbackEndpoint = isBrowser ? '/api/public/broadcast' : '';

  const fetchOnce = async (endpoint: string): Promise<PublicBroadcast | null> => {
    if (!endpoint) return null;
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        cache: 'no-store',
        signal: options?.signal,
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json) return null;
      return normalizePublicBroadcast(json);
    } catch {
      return null;
    }
  };

  try {
    const primary = await fetchOnce(primaryEndpoint);
    if (primary) return primary;

    const fallback = await fetchOnce(fallbackEndpoint);
    if (fallback) return fallback;

    return normalizePublicBroadcast({
      ok: false,
      _meta: { hasSettings: false },
      settings: { breaking: DEFAULT_BREAKING_SETTINGS, live: DEFAULT_LIVE_SETTINGS },
      items: { breaking: [], live: [] },
    });
  } catch {
    return normalizePublicBroadcast({
      ok: false,
      _meta: { hasSettings: false },
      settings: { breaking: DEFAULT_BREAKING_SETTINGS, live: DEFAULT_LIVE_SETTINGS },
      items: { breaking: [], live: [] },
    });
  }
}
