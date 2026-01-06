import { getPublicApiBaseUrl } from '../../lib/publicApiBase';

export type HomeModuleKey =
  | 'exploreCategories'
  | 'categoryStrip'
  | 'trendingStrip'
  | 'liveUpdatesTicker'
  | 'breakingTicker'
  | 'liveTvCard'
  | 'quickTools'
  | 'snapshots'
  | 'appPromo'
  | 'footer';

export type PublicSettingsModule = {
  enabled: boolean;
  order: number;
  // Optional module payload (e.g. live TV embed URL) provided by backend.
  url?: string;
};

export type PublishedTickerSettings = {
  enabled: boolean;
  speedSeconds: number;
  // If true, the ticker can render even when there are no items.
  showWhenEmpty?: boolean;
};

export type PublicSettings = {
  modules: Record<HomeModuleKey, PublicSettingsModule>;
  tickers: {
    breaking: PublishedTickerSettings;
    live: PublishedTickerSettings;
  };
};

export type PublicSettingsResponse = {
  settings: PublicSettings;
  version: string | null;
  updatedAt: string | null;
};

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  modules: {
    // Match current homepage default rendering order
    categoryStrip: { enabled: true, order: 10 },
    breakingTicker: { enabled: true, order: 20 },
    liveUpdatesTicker: { enabled: true, order: 30 },
    trendingStrip: { enabled: true, order: 40 },

    exploreCategories: { enabled: true, order: 10 },
    liveTvCard: { enabled: true, order: 20, url: '' },
    quickTools: { enabled: true, order: 30 },
    snapshots: { enabled: true, order: 40 },

    appPromo: { enabled: true, order: 10 },
    footer: { enabled: true, order: 20 },
  },
  tickers: {
    // Match current DEFAULT_PREFS in pages/index.tsx
    breaking: { enabled: true, speedSeconds: 18, showWhenEmpty: true },
    live: { enabled: true, speedSeconds: 24, showWhenEmpty: true },
  },
};

export const DEFAULT_PUBLIC_SETTINGS_RESPONSE: PublicSettingsResponse = {
  settings: DEFAULT_PUBLIC_SETTINGS,
  version: null,
  updatedAt: null,
};

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function normalizeModule(
  key: HomeModuleKey,
  raw: unknown,
  defaults: PublicSettings
): PublicSettingsModule {
  const base = defaults.modules[key];

  // Accept either object shape or booleans for enabled.
  if (typeof raw === 'boolean') {
    return { ...base, enabled: raw };
  }

  if (!isRecord(raw)) return base;

  const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled;
  const order = Number.isFinite(Number(raw.order)) ? Number(raw.order) : base.order;

  const url = typeof (raw as any).url === 'string' ? String((raw as any).url) : base.url;

  return { enabled, order, url };
}

function normalizeTicker(
  raw: unknown,
  fallback: PublishedTickerSettings
): PublishedTickerSettings {
  if (!isRecord(raw)) return fallback;
  const enabled = typeof raw.enabled === 'boolean' ? raw.enabled : fallback.enabled;
  const speedRaw = (raw as any).speedSeconds ?? (raw as any).speedSec;
  const speedSeconds = clampNum(speedRaw, 5, 300, fallback.speedSeconds);
  const showWhenEmptyRaw = (raw as any).showWhenEmpty ?? (raw as any).showEmpty;
  const showWhenEmpty = typeof showWhenEmptyRaw === 'boolean' ? showWhenEmptyRaw : fallback.showWhenEmpty;
  return { enabled, speedSeconds, showWhenEmpty };
}

export function mergePublicSettingsWithDefaults(raw: unknown, defaults: PublicSettings = DEFAULT_PUBLIC_SETTINGS): PublicSettings {
  const root = isRecord(raw) ? raw : {};

  // Preferred backend contract: { settings: { modules, tickers }, version, updatedAt }
  // Backwards compatibility: allow older shapes like { published: ... } or { modules, tickers }.
  const payload = isRecord((root as any).settings) ? ((root as any).settings as JsonRecord) : root;

  const publishedRaw = isRecord((payload as any).published) ? ((payload as any).published as JsonRecord) : null;

  const modulesRaw = isRecord((payload as any).modules)
    ? ((payload as any).modules as JsonRecord)
    : publishedRaw && isRecord((publishedRaw as any).modules)
      ? ((publishedRaw as any).modules as JsonRecord)
      : {};

  const tickersRaw = isRecord((payload as any).tickers)
    ? ((payload as any).tickers as JsonRecord)
    : publishedRaw && isRecord((publishedRaw as any).tickers)
      ? ((publishedRaw as any).tickers as JsonRecord)
      : {};

  const breakingRaw = (tickersRaw as any).breaking;
  const liveRaw = (tickersRaw as any).live;

  const out: PublicSettings = {
    modules: { ...defaults.modules },
    tickers: {
      breaking: normalizeTicker(breakingRaw, defaults.tickers.breaking),
      live: normalizeTicker(liveRaw, defaults.tickers.live),
    },
  };

  (Object.keys(defaults.modules) as HomeModuleKey[]).forEach((key) => {
    out.modules[key] = normalizeModule(key, (modulesRaw as any)[key], defaults);
  });

  return out;
}

export function mergePublicSettingsResponseWithDefaults(raw: unknown): PublicSettingsResponse {
  const root = isRecord(raw) ? raw : {};

  const versionRaw = (root as any).version;
  const updatedAtRaw = (root as any).updatedAt;

  const version = typeof versionRaw === 'string' || typeof versionRaw === 'number' ? String(versionRaw) : null;
  const updatedAt = typeof updatedAtRaw === 'string' ? String(updatedAtRaw) : null;

  const settings = mergePublicSettingsWithDefaults(root);

  return { settings, version, updatedAt };
}

export function getOrderedEnabledKeys(modules: Record<HomeModuleKey, PublicSettingsModule>): HomeModuleKey[] {
  return (Object.keys(modules) as HomeModuleKey[])
    .slice()
    .sort((a, b) => (modules[a]?.order ?? 0) - (modules[b]?.order ?? 0))
    .filter((k) => modules[k]?.enabled !== false);
}

export function isHomeModuleEnabled(
  settings: PublicSettings | null | undefined,
  key: HomeModuleKey,
  fallback: boolean
): boolean {
  const enabled = settings?.modules?.[key]?.enabled;
  return typeof enabled === 'boolean' ? enabled : fallback;
}

export function getHomeModuleOrder(
  settings: PublicSettings | null | undefined,
  key: HomeModuleKey,
  fallback: number
): number {
  const order = Number(settings?.modules?.[key]?.order);
  return Number.isFinite(order) ? order : fallback;
}

export function isTickerEnabled(
  settings: PublicSettings | null | undefined,
  ticker: 'breaking' | 'live',
  fallback: boolean
): boolean {
  const enabled = settings?.tickers?.[ticker]?.enabled;
  return typeof enabled === 'boolean' ? enabled : fallback;
}

export function getTickerSpeedSeconds(
  settings: PublicSettings | null | undefined,
  ticker: 'breaking' | 'live',
  fallback: number
): number {
  const raw = settings?.tickers?.[ticker]?.speedSeconds;
  return clampNum(raw, 5, 300, fallback);
}

export function shouldTickerShowWhenEmpty(
  settings: PublicSettings | null | undefined,
  ticker: 'breaking' | 'live',
  fallback: boolean
): boolean {
  const v = settings?.tickers?.[ticker]?.showWhenEmpty;
  return typeof v === 'boolean' ? v : fallback;
}

export async function fetchPublicSettings(options?: { signal?: AbortSignal }): Promise<PublicSettingsResponse> {
  const cacheBust = Date.now();
  // Always hit same-origin Next.js API route so we can:
  // - enforce `no-store` consistently
  // - avoid CORS complexity
  // - optionally proxy to a configured backend
  const endpoint = `/api/public/settings?ts=${cacheBust}`;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
    signal: options?.signal,
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(`PUBLIC_SETTINGS_FETCH_FAILED_${res.status || 0}`);
  }

  return mergePublicSettingsResponseWithDefaults(data);
}
