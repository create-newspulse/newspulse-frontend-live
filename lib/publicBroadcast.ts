import { getPublicApiBaseUrl } from './publicApiBase';

export type BroadcastType = 'breaking' | 'live';
export type BroadcastMode = 'AUTO' | 'FORCE_ON' | 'FORCE_OFF';

export type BroadcastLang = 'en' | 'hi' | 'gu';

export type BroadcastItem = {
  _id?: string;
  id?: string;
  text?: string;
  title?: string;
  sourceLang?: BroadcastLang | string;
  texts?: Record<string, string> | null;
  translations?: Record<string, string> | null;
  i18n?: Record<string, string> | null;
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

function normalizeLang(raw: unknown): BroadcastLang | null {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'en' || v === 'hi' || v === 'gu') return v;
  return null;
}

function pickFirstNonEmpty(candidates: unknown[]): string | null {
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s) return s;
  }
  return null;
}

function getTranslationsRecord(item: any): Record<string, string> | null {
  const rec =
    (item && typeof item === 'object' && (item.texts || item.translations || item.i18n || item.textByLang || item.byLang)) ||
    null;
  const r = rec && typeof rec === 'object' ? (rec as Record<string, any>) : null;
  if (!r) return null;
  const out: Record<string, string> = {};
  for (const k of Object.keys(r)) {
    const v = String((r as any)[k] ?? '').trim();
    if (v) out[String(k).toLowerCase().trim()] = v;
  }
  return Object.keys(out).length ? out : null;
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

export function itemToTickerText(item: unknown, opts?: { lang?: BroadcastLang }): string | null {
  if (!item) return null;

  // Backend (or fallbacks) might already provide plain strings.
  if (typeof item === 'string') {
    const s = item.trim();
    return s ? s : null;
  }

  const it = item as any;
  const direct = pickFirstNonEmpty([it?.text, it?.title, it?.headline]);
  if (direct) return direct;

  const wanted = normalizeLang(opts?.lang);
  const source = normalizeLang(it?.sourceLang ?? it?.sourceLanguage ?? it?.lang);
  const rec = getTranslationsRecord(it);

  if (rec) {
    const candidates: unknown[] = [];
    if (wanted && rec[wanted]) candidates.push(rec[wanted]);
    if (source && rec[source]) candidates.push(rec[source]);
    for (const k of ['en', 'hi', 'gu']) {
      if (rec[k]) candidates.push(rec[k]);
    }
    // Last resort: any translation value.
    for (const v of Object.values(rec)) candidates.push(v);
    return pickFirstNonEmpty(candidates);
  }

  return null;
}

export function toTickerTexts(items: unknown[], opts?: { lang?: BroadcastLang }): string[] {
  return (items || []).map((it) => itemToTickerText(it, opts)).filter(Boolean) as string[];
}

export async function fetchPublicBroadcast(options?: { signal?: AbortSignal; lang?: BroadcastLang }): Promise<PublicBroadcast> {
  const isBrowser = typeof window !== 'undefined';
  const base = getPublicApiBaseUrl();
  const lang = normalizeLang(options?.lang);

  const safeJson = async (res: Response): Promise<any | null> => {
    try {
      const text = await res.text().catch(() => '');
      if (!text) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const unwrapItems = (json: any): BroadcastItem[] => {
    if (!json) return [];
    if (Array.isArray(json)) return json as BroadcastItem[];
    if (Array.isArray(json.items)) return json.items as BroadcastItem[];
    if (Array.isArray(json.data)) return json.data as BroadcastItem[];
    if (Array.isArray(json.result)) return json.result as BroadcastItem[];
    return [];
  };

  const fetchItemsByType = async (type: BroadcastType, requestedLang?: BroadcastLang): Promise<BroadcastItem[]> => {
    const langQs = requestedLang ? `&lang=${encodeURIComponent(requestedLang)}` : '';

    // Browser requirement: use /public/broadcast/items?type=...&lang=...
    // (Next rewrite maps this to /api/public/broadcast/items)
    const endpoint = isBrowser
      ? `/public/broadcast/items?type=${encodeURIComponent(type)}${langQs}`
      : `${String(base || '').replace(/\/+$/, '')}/api/public/broadcast/items?type=${encodeURIComponent(type)}${langQs}`;

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
      const json = await safeJson(res);
      if (!res.ok || !json) return [];
      return unwrapItems(json);
    } catch {
      return [];
    }
  };

  const fetchSettings = async (): Promise<any | null> => {
    const endpoint = isBrowser
      ? '/public/broadcast/settings'
      : `${String(base || '').replace(/\/+$/, '')}/api/public/broadcast/settings`;
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
      const json = await safeJson(res);
      if (!res.ok || !json) return null;
      return json;
    } catch {
      return null;
    }
  };

  // Phase 1 requirement:
  // - Fetch ticker items by selected language
  // - Fallback chain if empty: requested -> en -> hi -> gu
  // - Never go blank: as a last resort, retry without lang so backend can return its default/original
  try {
    const settingsRaw = await fetchSettings();

    const fallbackChain = ([lang, 'en', 'hi', 'gu'] as Array<BroadcastLang | null>)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i) as BroadcastLang[];

    let breaking: BroadcastItem[] = [];
    let live: BroadcastItem[] = [];

    for (const l of fallbackChain) {
      if (options?.signal?.aborted) break;

      const [b, lv] = await Promise.all([
        breaking.length ? Promise.resolve([] as BroadcastItem[]) : fetchItemsByType('breaking', l),
        live.length ? Promise.resolve([] as BroadcastItem[]) : fetchItemsByType('live', l),
      ]);

      if (!breaking.length && b.length) breaking = b;
      if (!live.length && lv.length) live = lv;
      if (breaking.length && live.length) break;
    }

    // Last resort: try without lang so backend can return default/original.
    if (!breaking.length) breaking = await fetchItemsByType('breaking', undefined);
    if (!live.length) live = await fetchItemsByType('live', undefined);

    const normalized = normalizePublicBroadcast({
      ok: true,
      _meta: { hasSettings: Boolean(settingsRaw) },
      settings: (settingsRaw as any)?.settings ?? settingsRaw ?? { breaking: DEFAULT_BREAKING_SETTINGS, live: DEFAULT_LIVE_SETTINGS },
      items: { breaking, live },
    });

    return normalized;
  } catch {
    // continue to legacy fallback below
  }

  // IMPORTANT: same-origin path so Vercel rewrites handle backend without CORS.
  // Repo reality: Vercel currently rewrites `/public-api/*` to backend `/admin-api/public/*`.
  // Request requirement: use `/admin-api/*` to keep requests same-origin and avoid CORS.
  // So: try `/admin-api/*` first, then `/public-api/*`.
  const browserAdminApi = isBrowser
    ? `/admin-api/public/broadcast${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`
    : '';
  const browserPublicApi = isBrowser
    ? `/public-api/broadcast${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`
    : '';

  const primaryEndpoint = isBrowser
    ? browserAdminApi || browserPublicApi || '/public-api/broadcast'
    : `${base}/api/public/broadcast${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`;

  const secondaryEndpoint = isBrowser ? (browserPublicApi && browserPublicApi !== primaryEndpoint ? browserPublicApi : '') : '';
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

    const secondary = await fetchOnce(secondaryEndpoint);
    if (secondary) return secondary;

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
