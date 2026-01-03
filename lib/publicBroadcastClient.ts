import { getApiOrigin } from './publicNewsApi';

export type BroadcastShowOnKey = 'home' | 'category' | 'article';

export type BroadcastBreakingMode = 'off' | 'auto' | 'force_on';

export type BroadcastBreakingSettings = {
  enabled: boolean;
  mode: BroadcastBreakingMode;
  showWhenEmpty: boolean;
  speedSec: number;
  maxItems: number;
};

export type BroadcastLiveSettings = {
  enabled: boolean;
  speedSec: number;
  maxItems: number;
  showOn: Record<BroadcastShowOnKey, boolean>;
};

export type BroadcastSettings = {
  breaking: BroadcastBreakingSettings;
  live: BroadcastLiveSettings;
};

export type BroadcastItem = {
  id?: string;
  _id?: string;
  text?: string;
  title?: string;
  message?: string;
  url?: string;
  href?: string;
};

export type PublicBroadcastPayload = {
  settings: BroadcastSettings;
  breaking: { items: BroadcastItem[] };
  live: { items: BroadcastItem[] };
};

export type PublicBroadcastSettingsPayload = {
  settings: BroadcastSettings;
};

const DEFAULT_SETTINGS: BroadcastSettings = {
  breaking: {
    enabled: false,
    mode: 'off',
    showWhenEmpty: false,
    speedSec: 18,
    maxItems: 8,
  },
  live: {
    enabled: false,
    speedSec: 24,
    maxItems: 12,
    showOn: { home: true, category: true, article: false },
  },
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  const i = Math.trunc(v);
  return Math.min(max, Math.max(min, i));
}

function normalizeMode(input: unknown, fallback: BroadcastBreakingMode): BroadcastBreakingMode {
  const v = String(input || '').trim().toLowerCase();
  if (v === 'off') return 'off';
  if (v === 'auto') return 'auto';
  if (v === 'force_on' || v === 'force-on' || v === 'on' || v === 'force') return 'force_on';
  return fallback;
}

function normalizeShowOn(input: unknown, fallback: BroadcastLiveSettings['showOn']): BroadcastLiveSettings['showOn'] {
  if (!input) return fallback;

  if (Array.isArray(input)) {
    const set = new Set(input.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean));
    return {
      home: set.has('home'),
      category: set.has('category'),
      article: set.has('article'),
    };
  }

  if (typeof input === 'string') {
    const set = new Set(
      input
        .split(/[\s,;|]+/g)
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean)
    );

    return {
      home: set.has('home'),
      category: set.has('category'),
      article: set.has('article'),
    };
  }

  if (typeof input === 'object') {
    const o = input as any;
    return {
      home: !!o.home,
      category: !!o.category,
      article: !!o.article,
    };
  }

  return fallback;
}

function toItemList(input: unknown): BroadcastItem[] {
  if (!input) return [];

  if (Array.isArray(input)) return input as BroadcastItem[];

  if (typeof input === 'object') {
    const o = input as any;
    if (Array.isArray(o.items)) return o.items as BroadcastItem[];
    if (Array.isArray(o.data)) return o.data as BroadcastItem[];
    if (Array.isArray(o.results)) return o.results as BroadcastItem[];
  }

  return [];
}

export function normalizePublicBroadcastPayload(raw: unknown): PublicBroadcastPayload {
  const obj = raw && typeof raw === 'object' ? (raw as any) : {};

  const settingsRaw = obj.settings && typeof obj.settings === 'object' ? obj.settings : obj;
  const breakingRaw = settingsRaw.breaking && typeof settingsRaw.breaking === 'object' ? settingsRaw.breaking : settingsRaw;
  const liveRaw = settingsRaw.live && typeof settingsRaw.live === 'object' ? settingsRaw.live : settingsRaw;

  const settings: BroadcastSettings = {
    breaking: {
      enabled: typeof breakingRaw.enabled === 'boolean' ? breakingRaw.enabled : DEFAULT_SETTINGS.breaking.enabled,
      mode: normalizeMode(breakingRaw.mode, DEFAULT_SETTINGS.breaking.mode),
      showWhenEmpty:
        typeof breakingRaw.showWhenEmpty === 'boolean' ? breakingRaw.showWhenEmpty : DEFAULT_SETTINGS.breaking.showWhenEmpty,
      speedSec: clampInt(breakingRaw.speedSec, 5, 300, DEFAULT_SETTINGS.breaking.speedSec),
      maxItems: clampInt(breakingRaw.maxItems, 1, 100, DEFAULT_SETTINGS.breaking.maxItems),
    },
    live: {
      enabled: typeof liveRaw.enabled === 'boolean' ? liveRaw.enabled : DEFAULT_SETTINGS.live.enabled,
      speedSec: clampInt(liveRaw.speedSec, 5, 300, DEFAULT_SETTINGS.live.speedSec),
      maxItems: clampInt(liveRaw.maxItems, 1, 100, DEFAULT_SETTINGS.live.maxItems),
      showOn: normalizeShowOn(liveRaw.showOn, DEFAULT_SETTINGS.live.showOn),
    },
  };

  const breakingItems = toItemList(obj.breaking ?? obj.breakingItems ?? obj.breakingTicker ?? obj.breakingTickerItems);
  const liveItems = toItemList(obj.live ?? obj.liveItems ?? obj.liveTicker ?? obj.liveTickerItems);

  return {
    settings,
    breaking: { items: breakingItems },
    live: { items: liveItems },
  };
}

export function normalizePublicBroadcastSettingsPayload(raw: unknown): PublicBroadcastSettingsPayload {
  const normalized = normalizePublicBroadcastPayload(raw);
  return { settings: normalized.settings };
}

export async function fetchPublicBroadcastSettings(opts?: { signal?: AbortSignal }): Promise<PublicBroadcastSettingsPayload> {
  const origin = getApiOrigin();
  const endpoint = `${origin}/api/public/broadcast/settings`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: opts?.signal,
    });

    const data = await res.json().catch(() => null);
    return normalizePublicBroadcastSettingsPayload(data);
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    return { settings: DEFAULT_SETTINGS };
  }
}

export async function fetchPublicBroadcast(opts?: { signal?: AbortSignal }): Promise<PublicBroadcastPayload> {
  try {
    // First, fetch settings from the dedicated settings endpoint.
    const settings = await fetchPublicBroadcastSettings(opts);

    // Then, fetch items from the broadcast endpoint (if available).
    // Some backends may also include items in /settings; normalize handles both.
    const origin = getApiOrigin();
    const endpoint = `${origin}/api/public/broadcast`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: opts?.signal,
    });

    const data = await res.json().catch(() => null);
    const normalized = normalizePublicBroadcastPayload(data);

    return {
      settings: settings.settings,
      breaking: normalized.breaking,
      live: normalized.live,
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err;
    return {
      settings: DEFAULT_SETTINGS,
      breaking: { items: [] },
      live: { items: [] },
    };
  }
}

export function toTickerStrings(items: BroadcastItem[], maxItems: number): string[] {
  const list = (items || [])
    .map((it) => {
      const s = String(it?.text || it?.message || it?.title || '').trim();
      return s;
    })
    .filter(Boolean);

  const limit = Math.max(1, Math.min(100, Math.trunc(Number(maxItems) || list.length || 0)));
  return list.slice(0, limit);
}
