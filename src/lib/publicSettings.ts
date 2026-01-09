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

// Recommended backend response shape for published Public Site Settings.
export type PublicSettingsResp = {
  ok: boolean;
  version: number;
  updatedAt?: string;
  published: unknown;
};

// Normalized public-site settings used by the homepage.
// This supports schema drift across backend versions (old keys/new keys).
export type NormalizedPublicSettingsModule = { enabled: boolean; order: number };

export type NormalizedPublicSettings = {
  version: string | null;
  modules: {
    categoryStrip: NormalizedPublicSettingsModule;
    explore: NormalizedPublicSettingsModule;
    trending: NormalizedPublicSettingsModule;
    quickTools: NormalizedPublicSettingsModule;
    appPromo: NormalizedPublicSettingsModule;
    footer: NormalizedPublicSettingsModule;
    snapshots: NormalizedPublicSettingsModule;
    liveTvCard: NormalizedPublicSettingsModule;
  };
  tickers: {
    live: { enabled: boolean; speedSec: number; order: number; mode: string; showWhenEmpty: boolean };
    breaking: { enabled: boolean; speedSec: number; order: number; mode: string; showWhenEmpty: boolean };
  };
  liveTv: { enabled: boolean; embedUrl: string };
  languageTheme: { languages: string[]; themePreset: string | null };
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

export const DEFAULT_NORMALIZED_PUBLIC_SETTINGS: NormalizedPublicSettings = {
  version: null,
  modules: {
    categoryStrip: { enabled: true, order: 10 },
    explore: { enabled: true, order: 10 },
    liveTvCard: { enabled: true, order: 20 },
    quickTools: { enabled: true, order: 30 },
    snapshots: { enabled: true, order: 40 },
    trending: { enabled: true, order: 30 },
    appPromo: { enabled: true, order: 10 },
    footer: { enabled: true, order: 20 },
  },
  tickers: {
    live: { enabled: true, speedSec: 24, order: 20, mode: 'auto', showWhenEmpty: false },
    breaking: { enabled: true, speedSec: 18, order: 10, mode: 'auto', showWhenEmpty: false },
  },
  liveTv: { enabled: true, embedUrl: '' },
  languageTheme: { languages: ['en', 'hi', 'gu'], themePreset: null },
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

export function sanitizeEmbedUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s) return '';

  try {
    const u = new URL(s);
    const protocol = u.protocol.toLowerCase();
    if (protocol !== 'https:' && protocol !== 'http:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

function getRecord(root: unknown, ...path: Array<string>): JsonRecord | null {
  let cur: any = root as any;
  for (const key of path) {
    if (!isRecord(cur)) return null;
    cur = cur[key];
  }
  return isRecord(cur) ? (cur as JsonRecord) : null;
}

function getUnknown(root: unknown, ...path: Array<string>): unknown {
  let cur: any = root as any;
  for (const key of path) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function normalizeEnabled(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  return fallback;
}

function normalizeOrder(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeModuleFrom(
  rawModule: unknown,
  fallback: NormalizedPublicSettingsModule
): NormalizedPublicSettingsModule {
  if (typeof rawModule === 'boolean') return { ...fallback, enabled: rawModule };
  if (!isRecord(rawModule)) return fallback;
  return {
    enabled: normalizeEnabled((rawModule as any).enabled, fallback.enabled),
    order: normalizeOrder((rawModule as any).order, fallback.order),
  };
}

function normalizeTickerFrom(
  rawTicker: unknown,
  fallback: { enabled: boolean; speedSec: number; order: number; mode: string; showWhenEmpty: boolean }
): { enabled: boolean; speedSec: number; order: number; mode: string; showWhenEmpty: boolean } {
  if (!isRecord(rawTicker)) return fallback;
  const speedRaw = (rawTicker as any).speedSec ?? (rawTicker as any).speedSeconds;
  return {
    enabled: normalizeEnabled((rawTicker as any).enabled, fallback.enabled),
    speedSec: clampNum(speedRaw, 5, 300, fallback.speedSec),
    order: normalizeOrder((rawTicker as any).order, fallback.order),
    mode: typeof (rawTicker as any).mode === 'string' ? String((rawTicker as any).mode) : fallback.mode,
    showWhenEmpty:
      typeof (rawTicker as any).showWhenEmpty === 'boolean'
        ? (rawTicker as any).showWhenEmpty
        : fallback.showWhenEmpty,
  };
}

function normalizeLanguages(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw) || !raw.length) return fallback;
  const cleaned = raw
    .map((v) => String(v || '').toLowerCase().trim())
    .filter(Boolean);
  const uniq = Array.from(new Set(cleaned));
  return uniq.length ? uniq : fallback;
}

function normalizeThemePreset(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  return s ? s : null;
}

export function normalizePublicSettings(raw: unknown, defaults: NormalizedPublicSettings = DEFAULT_NORMALIZED_PUBLIC_SETTINGS): NormalizedPublicSettings {
  const root = isRecord(raw) ? (raw as JsonRecord) : ({} as JsonRecord);

  // The backend can return:
  // - { ok, version, updatedAt, published: {...} }
  // - { ok, version, updatedAt, settings: {...} }
  // - { published: {...} }
  // - { ...publishedObject }
  const published = getRecord(root, 'published') ?? getRecord(root, 'settings') ?? (root as JsonRecord);

  const versionRaw = (root as any).version ?? (published as any).version;
  const version = typeof versionRaw === 'string' || typeof versionRaw === 'number' ? String(versionRaw) : defaults.version;

  const homepageModules =
    getRecord(published, 'homepage', 'modules') ??
    getRecord(published, 'homeModules') ??
    getRecord(published, 'modules') ??
    ({} as JsonRecord);

  // Schema drift mapping (old -> new)
  const exploreRaw = (homepageModules as any).explore ?? (homepageModules as any).exploreCategories;
  const trendingRaw = (homepageModules as any).trending ?? (homepageModules as any).trendingStrip;
  const liveTvCardRaw = (homepageModules as any).liveTvCard;

  const tickers = getRecord(published, 'tickers') ?? getRecord(published, 'homepage', 'tickers') ?? ({} as JsonRecord);
  const liveTickerRaw = (tickers as any).live;
  const breakingTickerRaw = (tickers as any).breaking;

  const liveTv = getRecord(published, 'liveTv') ?? getRecord(published, 'homepage', 'liveTv') ?? ({} as JsonRecord);
  const liveTvEnabled = normalizeEnabled((liveTv as any).enabled, defaults.liveTv.enabled);

  const embedUrlRaw =
    getUnknown(liveTv, 'embedUrl') ??
    getUnknown(liveTv, 'url') ??
    (isRecord(liveTvCardRaw) ? (liveTvCardRaw as any).embedUrl ?? (liveTvCardRaw as any).url : undefined);
  const embedUrl = sanitizeEmbedUrl(embedUrlRaw);

  // languageTheme can exist at root or under published
  const languageTheme =
    getRecord(published, 'languageTheme') ??
    getRecord(published, 'homepage', 'languageTheme') ??
    getRecord(root, 'languageTheme') ??
    ({} as JsonRecord);

  const languagesRaw = (languageTheme as any).languages ?? (languageTheme as any).langs;
  const themePresetRaw = (languageTheme as any).themePreset ?? (languageTheme as any).preset;

  const out: NormalizedPublicSettings = {
    version,
    modules: {
      categoryStrip: normalizeModuleFrom((homepageModules as any).categoryStrip, defaults.modules.categoryStrip),
      explore: normalizeModuleFrom(exploreRaw, defaults.modules.explore),
      trending: normalizeModuleFrom(trendingRaw, defaults.modules.trending),
      quickTools: normalizeModuleFrom((homepageModules as any).quickTools, defaults.modules.quickTools),
      appPromo: normalizeModuleFrom((homepageModules as any).appPromo, defaults.modules.appPromo),
      footer: normalizeModuleFrom((homepageModules as any).footer, defaults.modules.footer),
      snapshots: normalizeModuleFrom((homepageModules as any).snapshots, defaults.modules.snapshots),
      liveTvCard: normalizeModuleFrom(
        liveTvCardRaw,
        // If liveTv.enabled is explicitly false, reflect that in the Live TV card by default.
        ((): NormalizedPublicSettingsModule => {
          const base = defaults.modules.liveTvCard;
          if (typeof (liveTv as any).enabled === 'boolean') return { ...base, enabled: liveTvEnabled };
          return base;
        })()
      ),
    },
    tickers: {
      live: normalizeTickerFrom(liveTickerRaw, defaults.tickers.live),
      breaking: normalizeTickerFrom(breakingTickerRaw, defaults.tickers.breaking),
    },
    liveTv: {
      enabled: liveTvEnabled,
      embedUrl,
    },
    languageTheme: {
      languages: normalizeLanguages(languagesRaw, defaults.languageTheme.languages),
      themePreset: normalizeThemePreset(themePresetRaw) ?? defaults.languageTheme.themePreset,
    },
  };

  return out;
}

// Recommended API: normalize the published object directly.
export function normalizePublished(published: unknown): NormalizedPublicSettings {
  return normalizePublicSettings({ published });
}

async function fetchPublicSettingsBody(options?: { signal?: AbortSignal }): Promise<unknown> {
  // Always use same-origin. Next.js rewrites (and/or the local API route)
  // take care of proxying to the backend.
  const endpoint = '/api/public/settings';

  const init = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
    signal: options?.signal,
    cache: 'no-store',
    // Next.js server fetch hint (ignored in the browser).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    next: { revalidate: 0 } as any,
  } as unknown as RequestInit;

  const res = await fetch(endpoint, init);

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

// Legacy: returns the older {settings, version, updatedAt} shape (kept for internal tools).
export async function fetchPublicSettingsResponse(options?: { signal?: AbortSignal }): Promise<PublicSettingsResponse> {
  const body = await fetchPublicSettingsBody(options);
  return mergePublicSettingsResponseWithDefaults(body);
}

// Required by product: UI should fetch GET /api/public/settings, then normalize.
export async function fetchPublicSettings(options?: { signal?: AbortSignal }): Promise<NormalizedPublicSettings> {
  // On the server (if ever called there), hint Next to not cache.
  const body = await fetchPublicSettingsBody({ signal: options?.signal });
  return normalizePublicSettings(body);
}
