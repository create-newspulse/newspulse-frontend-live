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

export function clampTickerSpeedSeconds(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(10, n));
}

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function isRecord(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
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

  // Some backends wrap payload as { success, data }. Support both.
  const rootData = isRecord(root?.data) ? (root.data as any) : null;

  const okFromRoot = typeof root?.ok === 'boolean' ? root.ok : undefined;
  const okFromSuccess = typeof root?.success === 'boolean' ? root.success : undefined;
  const ok = okFromRoot !== undefined ? okFromRoot : okFromSuccess !== undefined ? okFromSuccess : true;

  // New backend shape (single-call):
  // {
  //   breaking: { enabled, durationSeconds, items },
  //   live: { enabled, durationSeconds, items }
  // }
  // Bundle shape can be top-level OR nested under data.
  const bundleRoot = (root && (root.breaking != null || root.live != null)) ? root : rootData;
  const breakingBundle = bundleRoot?.breaking;
  const liveBundle = bundleRoot?.live;
  const isBundleShape =
    (isRecord(breakingBundle) || Array.isArray(breakingBundle)) && (isRecord(liveBundle) || Array.isArray(liveBundle));

  if (isBundleShape) {
    const breakingEnabledRaw = isRecord(breakingBundle) ? (breakingBundle as any).enabled : undefined;
    const liveEnabledRaw = isRecord(liveBundle) ? (liveBundle as any).enabled : undefined;

    const breakingDurationRaw = isRecord(breakingBundle)
      ? (breakingBundle as any).durationSeconds ??
        (breakingBundle as any).durationSec ??
        (breakingBundle as any).tickerSpeedSeconds ??
        (breakingBundle as any).speedSec ??
        (breakingBundle as any).speedSeconds
      : undefined;
    const liveDurationRaw = isRecord(liveBundle)
      ? (liveBundle as any).durationSeconds ??
        (liveBundle as any).durationSec ??
        (liveBundle as any).tickerSpeedSeconds ??
        (liveBundle as any).speedSec ??
        (liveBundle as any).speedSeconds
      : undefined;

    const breakingItemsRaw = isRecord(breakingBundle)
      ? (breakingBundle as any).items ?? (breakingBundle as any).data ?? (breakingBundle as any).list
      : breakingBundle;
    const liveItemsRaw = isRecord(liveBundle) ? (liveBundle as any).items ?? (liveBundle as any).data ?? (liveBundle as any).list : liveBundle;

    const hasSettings =
      (isRecord(breakingBundle) && ('enabled' in (breakingBundle as any) || 'durationSeconds' in (breakingBundle as any) || 'durationSec' in (breakingBundle as any))) ||
      (isRecord(liveBundle) && ('enabled' in (liveBundle as any) || 'durationSeconds' in (liveBundle as any) || 'durationSec' in (liveBundle as any)));

    return {
      ok: ok !== false,
      meta: { hasSettings: Boolean(hasSettings) },
      settings: {
        breaking: {
          enabled: breakingEnabledRaw === undefined ? DEFAULT_BREAKING_SETTINGS.enabled : Boolean(breakingEnabledRaw),
          mode: 'AUTO',
          speedSec: clampTickerSpeedSeconds(breakingDurationRaw, DEFAULT_BREAKING_SETTINGS.speedSec),
        },
        live: {
          enabled: liveEnabledRaw === undefined ? DEFAULT_LIVE_SETTINGS.enabled : Boolean(liveEnabledRaw),
          mode: 'AUTO',
          speedSec: clampTickerSpeedSeconds(liveDurationRaw, DEFAULT_LIVE_SETTINGS.speedSec),
        },
      },
      items: {
        breaking: asArray<BroadcastItem>(breakingItemsRaw),
        live: asArray<BroadcastItem>(liveItemsRaw),
      },
    };
  }

  const settingsRaw = root?.settings ?? rootData?.settings ?? null;
  const itemsRaw = root?.items ?? rootData?.items ?? rootData ?? null;

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
      speedSec: clampTickerSpeedSeconds(
        breakingSettingsRaw?.tickerSpeedSeconds ?? breakingSettingsRaw?.speedSec ?? breakingSettingsRaw?.speedSeconds,
        DEFAULT_BREAKING_SETTINGS.speedSec
      ),
    },
    live: {
      enabled: Boolean(liveSettingsRaw?.enabled ?? DEFAULT_LIVE_SETTINGS.enabled),
      mode: normalizeMode(liveSettingsRaw?.mode ?? DEFAULT_LIVE_SETTINGS.mode),
      speedSec: clampTickerSpeedSeconds(
        liveSettingsRaw?.tickerSpeedSeconds ?? liveSettingsRaw?.speedSec ?? liveSettingsRaw?.speedSeconds,
        DEFAULT_LIVE_SETTINGS.speedSec
      ),
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
    ok: ok !== false,
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
  const wanted = normalizeLang(opts?.lang);
  const source = normalizeLang(it?.sourceLang ?? it?.sourceLanguage ?? it?.lang);
  const rec = getTranslationsRecord(it);

  // If a per-language map exists, prefer the requested language.
  // This keeps tickers reactive when switching languages (even if `text` is present).
  if (wanted && rec?.[wanted]) {
    const s = String(rec[wanted] ?? '').trim();
    if (s) return s;
  }

  const direct = pickFirstNonEmpty([it?.text, it?.title, it?.headline]);
  if (direct) return direct;

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

  const origin = String(base || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/?$/, '');

  const withTs = (url: string): string => {
    if (!isBrowser) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}_ts=${Date.now()}`;
  };

  const devLog = (url: string) => {
    if (!isBrowser) return;
    if (process.env.NODE_ENV === 'production') return;
    // Temporary debug log: selected language + exact URL fetched.
    // eslint-disable-next-line no-console
    console.debug(`[broadcast] lang=${lang || 'none'} url=${url}`);
  };

  // Phase 1 contract:
  // - Config: GET /public/broadcast/config
  // - Items: GET /public/broadcast/items?type=breaking&lang=xx and ...type=live&lang=xx
  // - No caching
  // - durationSec used directly as animation duration seconds (clamped).

  if (!isBrowser && !origin) {
    return normalizePublicBroadcast({
      ok: true,
      _meta: { hasSettings: false },
      settings: { breaking: DEFAULT_BREAKING_SETTINGS, live: DEFAULT_LIVE_SETTINGS },
      items: { breaking: [], live: [] },
    });
  }

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

  const fetchNoStore = async (url: string): Promise<any | null> => {
    try {
      const finalUrl = withTs(url);
      devLog(finalUrl);
      const res = await fetch(finalUrl, {
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

  const configEndpoint = isBrowser ? '/public/broadcast/config' : `${origin}/api/public/broadcast/config`;
  const itemsBase = isBrowser ? '/public/broadcast/items' : `${origin}/api/public/broadcast/items`;

  const langParam = lang ? `&lang=${encodeURIComponent(lang)}` : '';

  try {
    const [configJson, breakingJson, liveJson] = await Promise.all([
      fetchNoStore(configEndpoint),
      fetchNoStore(`${itemsBase}?type=breaking${langParam}`),
      fetchNoStore(`${itemsBase}?type=live${langParam}`),
    ]);

    const cfgRoot = configJson && typeof configJson === 'object' ? (configJson as any) : null;
    const cfg = cfgRoot?.config ?? cfgRoot;
    const breakingCfg = cfg?.breaking ?? cfg?.settings?.breaking ?? null;
    const liveCfg = cfg?.live ?? cfg?.settings?.live ?? null;

    const hasSettings = Boolean(breakingCfg || liveCfg);

    const breakingEnabled = breakingCfg?.enabled;
    const liveEnabled = liveCfg?.enabled;

    const breakingDuration =
      breakingCfg?.durationSec ?? breakingCfg?.durationSeconds ?? breakingCfg?.speedSec ?? breakingCfg?.speedSeconds;
    const liveDuration = liveCfg?.durationSec ?? liveCfg?.durationSeconds ?? liveCfg?.speedSec ?? liveCfg?.speedSeconds;

    const breakingItems = unwrapItems(breakingJson);
    const liveItems = unwrapItems(liveJson);

    return normalizePublicBroadcast({
      ok: true,
      _meta: { hasSettings },
      settings: {
        breaking: {
          enabled: breakingEnabled === undefined ? DEFAULT_BREAKING_SETTINGS.enabled : Boolean(breakingEnabled),
          mode: 'AUTO',
          speedSec: clampTickerSpeedSeconds(breakingDuration, DEFAULT_BREAKING_SETTINGS.speedSec),
        },
        live: {
          enabled: liveEnabled === undefined ? DEFAULT_LIVE_SETTINGS.enabled : Boolean(liveEnabled),
          mode: 'AUTO',
          speedSec: clampTickerSpeedSeconds(liveDuration, DEFAULT_LIVE_SETTINGS.speedSec),
        },
      },
      items: { breaking: breakingItems, live: liveItems },
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
