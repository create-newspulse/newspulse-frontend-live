import { getPublicApiBaseUrl } from './publicApiBase';

export type PublicSiteSettings = {
  // Tickering
  liveTickerOn?: boolean;
  breakingMode?: 'auto' | 'on' | 'off';
  liveSpeedSec?: number;
  breakingSpeedSec?: number;
};

const STORAGE_KEY = 'newspulse.publicSettings.v1';
const TTL_MS = 60_000;

let memoryCache: { fetchedAt: number; settings: PublicSiteSettings } | null = null;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function clampNum(n: unknown, min: number, max: number): number | undefined {
  const v = Number(n);
  if (!Number.isFinite(v)) return undefined;
  return Math.min(max, Math.max(min, v));
}

function sanitize(raw: unknown): PublicSiteSettings {
  const s = isRecord(raw) ? raw : {};
  const breakingModeRaw = typeof s.breakingMode === 'string' ? s.breakingMode.trim().toLowerCase() : '';

  const breakingMode: PublicSiteSettings['breakingMode'] =
    breakingModeRaw === 'on' || breakingModeRaw === 'off' || breakingModeRaw === 'auto'
      ? (breakingModeRaw as any)
      : undefined;

  return {
    liveTickerOn: typeof s.liveTickerOn === 'boolean' ? s.liveTickerOn : undefined,
    breakingMode,
    liveSpeedSec: clampNum(s.liveSpeedSec, 10, 120),
    breakingSpeedSec: clampNum(s.breakingSpeedSec, 10, 120),
  };
}

function readFromStorage(): { fetchedAt: number; settings: PublicSiteSettings } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const fetchedAt = Number((parsed as any).fetchedAt);
    const settings = sanitize((parsed as any).settings);
    if (!Number.isFinite(fetchedAt)) return null;
    return { fetchedAt, settings };
  } catch {
    return null;
  }
}

function writeToStorage(entry: { fetchedAt: number; settings: PublicSiteSettings }) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export async function fetchPublicSiteSettings(options?: {
  force?: boolean;
  signal?: AbortSignal;
}): Promise<{ settings: PublicSiteSettings | null; endpoint: string; error?: string }> {
  const base = getPublicApiBaseUrl();
  const endpoint = base ? `${base}/api/site-settings/public` : '';

  if (!base) {
    return { settings: null, endpoint, error: 'NEXT_PUBLIC_API_URL not set' };
  }

  const now = Date.now();
  if (!options?.force) {
    if (memoryCache && now - memoryCache.fetchedAt < TTL_MS) {
      return { settings: memoryCache.settings, endpoint };
    }

    const stored = readFromStorage();
    if (stored && now - stored.fetchedAt < TTL_MS) {
      memoryCache = stored;
      return { settings: stored.settings, endpoint };
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
      signal: options?.signal,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return { settings: null, endpoint, error: `API ${res.status || 0}` };
    }

    // Expected backend shape: { ok: true, settings: { ... } }
    const rawSettings = isRecord(data) && isRecord((data as any).settings) ? (data as any).settings : null;
    if (!rawSettings) {
      return { settings: null, endpoint, error: 'Invalid settings payload' };
    }

    const settings = sanitize(rawSettings);
    const entry = { fetchedAt: now, settings };
    memoryCache = entry;
    writeToStorage(entry);

    return { settings, endpoint };
  } catch {
    return { settings: null, endpoint, error: 'Fetch failed' };
  }
}
