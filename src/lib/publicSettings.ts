import { getPublicApiBaseUrl } from '../../lib/publicApiBase';

export type BreakingMode = 'auto' | 'on' | 'off';

export type LanguageTheme = {
  // Optional defaults controlled by backend for public site.
  lang?: 'en' | 'hi' | 'gu';
  themeId?: string;
};

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
  // Optional: breaking mode influences content behavior (auto/on/off)
  breakingMode?: BreakingMode;
  // Optional: footer text override
  footerText?: string;
  // Optional: default language/theme preset
  languageTheme?: LanguageTheme;
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
  breakingMode: 'auto',
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

function normalizeBreakingMode(raw: unknown, fallback: BreakingMode = 'auto'): BreakingMode {
  const v = String(raw ?? '').toLowerCase().trim();
  if (v === 'auto' || v === 'on' || v === 'off') return v as BreakingMode;
  return fallback;
}

function normalizeLanguageTheme(raw: unknown): LanguageTheme | undefined {
  if (!isRecord(raw)) return undefined;
  const langRaw = String((raw as any).lang ?? (raw as any).language ?? '').toLowerCase().trim();
  const lang: LanguageTheme['lang'] = langRaw === 'hi' || langRaw === 'gu' || langRaw === 'en' ? (langRaw as any) : undefined;
  const themeId = typeof (raw as any).themeId === 'string' ? String((raw as any).themeId) : undefined;
  const out: LanguageTheme = {};
  if (lang) out.lang = lang;
  if (themeId) out.themeId = themeId;
  return Object.keys(out).length ? out : undefined;
}

function firstFiniteNumber(...values: unknown[]): number | undefined {
  for (const v of values) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function getUiBoolean(ui: JsonRecord | null, key: string, fallback: boolean): boolean {
  const v = ui ? (ui as any)[key] : undefined;
  return typeof v === 'boolean' ? v : fallback;
}

function normalizeFromAdminPublishedShape(payload: JsonRecord, defaults: PublicSettings): PublicSettings {
  const homeModules = isRecord((payload as any).homeModules) ? ((payload as any).homeModules as JsonRecord) : null;
  const ui = isRecord((payload as any).ui) ? ((payload as any).ui as JsonRecord) : null;
  const tickersRaw = isRecord((payload as any).tickers) ? ((payload as any).tickers as JsonRecord) : null;

  const mapUiKey: Partial<Record<HomeModuleKey, string>> = {
    exploreCategories: 'showExploreCategories',
    categoryStrip: 'showCategoryStrip',
    trendingStrip: 'showTrendingStrip',
    liveUpdatesTicker: 'showLiveUpdatesTicker',
    breakingTicker: 'showBreakingTicker',
    quickTools: 'showQuickTools',
    appPromo: 'showAppPromo',
    footer: 'showFooter',
  };

  const out: PublicSettings = {
    modules: { ...defaults.modules },
    tickers: {
      breaking: { ...defaults.tickers.breaking },
      live: { ...defaults.tickers.live },
    },
    breakingMode: normalizeBreakingMode((payload as any).breakingMode, defaults.breakingMode ?? 'auto'),
    footerText: typeof (payload as any).footerText === 'string' ? String((payload as any).footerText) : defaults.footerText,
    languageTheme: normalizeLanguageTheme((payload as any).languageTheme) ?? defaults.languageTheme,
  };

  // Tickers: show/hide comes from UI flags (fallback true)
  out.tickers.breaking.enabled = getUiBoolean(ui, 'showBreakingTicker', defaults.tickers.breaking.enabled);
  out.tickers.live.enabled = getUiBoolean(ui, 'showLiveUpdatesTicker', defaults.tickers.live.enabled);

  // Ticker speeds: backend already normalizes, but still clamp defensively
  const breakingTickerRaw = tickersRaw && isRecord((tickersRaw as any).breaking) ? ((tickersRaw as any).breaking as JsonRecord) : null;
  const liveTickerRaw = tickersRaw && isRecord((tickersRaw as any).live) ? ((tickersRaw as any).live as JsonRecord) : null;

  if (breakingTickerRaw) {
    out.tickers.breaking.speedSeconds = clampNum((breakingTickerRaw as any).speedSeconds, 5, 300, out.tickers.breaking.speedSeconds);
    const showWhenEmpty = (breakingTickerRaw as any).showWhenEmpty;
    if (typeof showWhenEmpty === 'boolean') out.tickers.breaking.showWhenEmpty = showWhenEmpty;
  }
  if (liveTickerRaw) {
    out.tickers.live.speedSeconds = clampNum((liveTickerRaw as any).speedSeconds, 5, 300, out.tickers.live.speedSeconds);
    const showWhenEmpty = (liveTickerRaw as any).showWhenEmpty;
    if (typeof showWhenEmpty === 'boolean') out.tickers.live.showWhenEmpty = showWhenEmpty;
  }

  // Modules: use homeModules if present; otherwise fall back to older UI flags.
  (Object.keys(defaults.modules) as HomeModuleKey[]).forEach((key) => {
    const uiKey = mapUiKey[key];

    const hmRaw = homeModules && isRecord((homeModules as any)[key]) ? (((homeModules as any)[key]) as JsonRecord) : null;
    if (hmRaw) {
      const enabled = (hmRaw as any).enabled !== false;
      const order = firstFiniteNumber((hmRaw as any).order, (hmRaw as any).position, (hmRaw as any).orderPosition) ?? 999;
      const url = typeof (hmRaw as any).url === 'string' ? String((hmRaw as any).url) : defaults.modules[key].url;
      out.modules[key] = { ...defaults.modules[key], enabled, order, url };
      return;
    }

    if (uiKey) {
      const enabled = getUiBoolean(ui, uiKey, true);
      out.modules[key] = { ...defaults.modules[key], enabled };
      return;
    }

    out.modules[key] = defaults.modules[key];
  });

  return out;
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

  // Backend contracts we accept:
  // - { success: true, data: { homeModules, ui, tickers } }
  // - { ok: true, settings: { modules, tickers } }
  // - { settings: { ... } }
  // - { data: { ... } }
  // - { modules, tickers }
  const payload = isRecord((root as any).data)
    ? ((root as any).data as JsonRecord)
    : isRecord((root as any).settings)
      ? ((root as any).settings as JsonRecord)
      : root;

  // New admin-published shape: { homeModules, ui, tickers }
  if (isRecord((payload as any).homeModules) || isRecord((payload as any).ui)) {
    return normalizeFromAdminPublishedShape(payload, defaults);
  }

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
    breakingMode: normalizeBreakingMode(
      (payload as any).breakingMode ?? (publishedRaw as any)?.breakingMode,
      defaults.breakingMode ?? 'auto'
    ),
    footerText:
      typeof (payload as any).footerText === 'string'
        ? String((payload as any).footerText)
        : typeof (publishedRaw as any)?.footerText === 'string'
          ? String((publishedRaw as any).footerText)
          : defaults.footerText,
    languageTheme: normalizeLanguageTheme((payload as any).languageTheme) ?? normalizeLanguageTheme((publishedRaw as any)?.languageTheme) ?? defaults.languageTheme,
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

async function fetchPublicSettingsBody(options?: { signal?: AbortSignal }): Promise<unknown> {
  const base = getPublicApiBaseUrl();
  // Preferred backend contract (public): GET {API_BASE}/public/settings
  // Dev fallback: GET /api/public/settings (Next.js proxy route)
  const endpoint = base ? `${base}/public/settings` : '/api/public/settings';

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

  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error(`PUBLIC_SETTINGS_FETCH_FAILED_${res.status || 0}`);
  }

  return body;
}

// Required small layer: fetch + return `body.data` (fallback to other known shapes).
export async function getPublicSettings(options?: { signal?: AbortSignal }): Promise<unknown> {
  const body = await fetchPublicSettingsBody(options);
  if (isRecord(body) && isRecord((body as any).data)) return (body as any).data;
  if (isRecord(body) && isRecord((body as any).settings)) return (body as any).settings;
  return body;
}

export async function fetchPublicSettings(options?: { signal?: AbortSignal }): Promise<PublicSettingsResponse> {
  const body = await fetchPublicSettingsBody(options);
  return mergePublicSettingsResponseWithDefaults(body);
}
