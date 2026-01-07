import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { promises as fs } from 'fs';

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { getPublicSettings, parsePublicSettingsKeys } from '../../../lib/publicSettings';
import {
  DEFAULT_PUBLIC_SETTINGS_RESPONSE,
  mergePublicSettingsResponseWithDefaults,
  type PublicSettingsResponse,
} from '../../../src/lib/publicSettings';

// This route serves two different purposes for backwards compatibility:
// 1) Feature flags (existing): GET /api/public/settings?keys=comments.enabled,...
// 2) Published homepage public settings (new): GET /api/public/settings

const PUBLISHED_PATH = path.join(process.cwd(), 'data', 'public-site-settings.published.json');

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function mapSiteSettingsToPublicSettingsResponse(raw: unknown): PublicSettingsResponse | null {
  // Backend shapes we accept:
  // - { ok: true, settings: { ... } }
  // - { success: true, data: { ... } }
  const root = isRecord(raw) ? raw : null;
  if (!root) return null;

  const settings = isRecord((root as any).settings)
    ? ((root as any).settings as JsonRecord)
    : isRecord((root as any).data)
      ? ((root as any).data as JsonRecord)
      : null;

  if (!settings) return null;

  // Site settings (current backend/admin contract)
  const out: PublicSettingsResponse = {
    ...DEFAULT_PUBLIC_SETTINGS_RESPONSE,
    version: typeof (root as any).version === 'string' ? String((root as any).version) : DEFAULT_PUBLIC_SETTINGS_RESPONSE.version,
    updatedAt:
      typeof (root as any).updatedAt === 'string'
        ? String((root as any).updatedAt)
        : typeof (root as any).publishedAt === 'string'
          ? String((root as any).publishedAt)
          : DEFAULT_PUBLIC_SETTINGS_RESPONSE.updatedAt,
  };

  // Module toggles
  const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);

  const moduleMap: Array<[keyof PublicSettingsResponse['settings']['modules'], string]> = [
    ['categoryStrip', 'showCategoryStrip'],
    ['exploreCategories', 'showExploreCategories'],
    ['trendingStrip', 'showTrendingStrip'],
    ['liveTvCard', 'showLiveTvCard'],
    ['quickTools', 'showQuickTools'],
    ['snapshots', 'showSnapshots'],
    ['appPromo', 'showAppPromo'],
    ['footer', 'showFooter'],
  ];

  for (const [moduleKey, siteKey] of moduleMap) {
    const v = bool((settings as any)[siteKey]);
    if (typeof v === 'boolean') {
      out.settings.modules[moduleKey] = { ...out.settings.modules[moduleKey], enabled: v };
    }
  }

  // Live TV (current site-settings contract)
  // If present, it should directly control the Live TV module.
  const liveTvEnabled = bool((settings as any).liveTvEnabled);
  if (typeof liveTvEnabled === 'boolean') {
    out.settings.modules.liveTvCard = { ...out.settings.modules.liveTvCard, enabled: liveTvEnabled };
  }
  if (typeof (settings as any).liveTvUrl === 'string') {
    out.settings.modules.liveTvCard = { ...out.settings.modules.liveTvCard, url: String((settings as any).liveTvUrl) };
  }

  // Tickers
  const breakingModeRaw = typeof (settings as any).breakingMode === 'string' ? String((settings as any).breakingMode).toLowerCase() : '';
  const liveTickerOn = bool((settings as any).liveTickerOn);

  // Interpret breakingMode
  // - off => breaking ticker disabled
  // - on/auto/unknown => enabled (UI can still decide content behavior elsewhere)
  if (breakingModeRaw === 'off') {
    out.settings.tickers.breaking = { ...out.settings.tickers.breaking, enabled: false };
  } else if (breakingModeRaw === 'on' || breakingModeRaw === 'auto') {
    out.settings.tickers.breaking = { ...out.settings.tickers.breaking, enabled: true };
  }

  if (typeof liveTickerOn === 'boolean') {
    out.settings.tickers.live = { ...out.settings.tickers.live, enabled: liveTickerOn };
  }

  if ((settings as any).breakingSpeedSec != null || (settings as any).breakingSpeedSeconds != null) {
    const s = (settings as any).breakingSpeedSec ?? (settings as any).breakingSpeedSeconds;
    out.settings.tickers.breaking = {
      ...out.settings.tickers.breaking,
      speedSeconds: clampNum(s, 5, 300, out.settings.tickers.breaking.speedSeconds),
    };
  }

  if ((settings as any).liveSpeedSec != null || (settings as any).liveSpeedSeconds != null) {
    const s = (settings as any).liveSpeedSec ?? (settings as any).liveSpeedSeconds;
    out.settings.tickers.live = {
      ...out.settings.tickers.live,
      speedSeconds: clampNum(s, 5, 300, out.settings.tickers.live.speedSeconds),
    };
  }

  // Make module gating consistent: if ticker is disabled, also disable its wrapper module.
  out.settings.modules.breakingTicker = {
    ...out.settings.modules.breakingTicker,
    enabled: out.settings.tickers.breaking.enabled,
  };
  out.settings.modules.liveUpdatesTicker = {
    ...out.settings.modules.liveUpdatesTicker,
    enabled: out.settings.tickers.live.enabled,
  };

  return out;
}

async function ensurePublishedFile(): Promise<void> {
  try {
    await fs.access(PUBLISHED_PATH);
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e;
    await fs.mkdir(path.dirname(PUBLISHED_PATH), { recursive: true });
    const initial: PublicSettingsResponse = {
      ...DEFAULT_PUBLIC_SETTINGS_RESPONSE,
      version: DEFAULT_PUBLIC_SETTINGS_RESPONSE.version ?? 'local-0',
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(PUBLISHED_PATH, JSON.stringify(initial, null, 2), 'utf8');
  }
}

async function readPublishedLocal(): Promise<PublicSettingsResponse> {
  await ensurePublishedFile();
  const raw = await fs.readFile(PUBLISHED_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return mergePublicSettingsResponseWithDefaults(parsed);
}

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  // Back-compat: feature-flag settings request.
  if (req.query.keys) {
    try {
      const keys = parsePublicSettingsKeys(req.query.keys);
      const settings = await getPublicSettings(keys);
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json({ ok: true, settings });
    } catch {
      return res.status(500).json({ ok: false, message: 'SETTINGS_LOAD_FAILED' });
    }
  }

  // New: published homepage settings (admin-controlled)
  noStore(res);

  const base = getPublicApiBaseUrl();

  // Default to same-origin behavior when API base isn't configured.
  // In this case we serve the locally published settings file so the UI can still render.
  if (!base) {
    const local = await readPublishedLocal();
    return res.status(200).json(local);
  }

  // 1) Preferred backend contract: GET {base}/api/public/settings
  try {
    const upstream = await fetch(`${base}/public/settings`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });

    const json = await upstream.json().catch(() => null);
    if (upstream.ok && json) {
      return res.status(200).json(json);
    }
  } catch {
    // Try compatibility fallback below
  }

  // 1b) Back-compat: some deployments still expose /api/public/settings
  try {
    const upstream = await fetch(`${base}/api/public/settings`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });

    const json = await upstream.json().catch(() => null);
    if (upstream.ok && json) {
      return res.status(200).json(json);
    }
  } catch {
    // Try compatibility fallback below
  }

  // 2) Compatibility: map existing site-settings endpoint into the published public settings shape
  try {
    const upstream = await fetch(`${base}/api/site-settings/public`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });
    const json = await upstream.json().catch(() => null);
    if (upstream.ok && json) {
      const mapped = mapSiteSettingsToPublicSettingsResponse(json);
      if (mapped) {
        return res.status(200).json(mergePublicSettingsResponseWithDefaults(mapped));
      }
    }
  } catch {
    // ignore
  }

  return res.status(502).json({ ok: false, message: 'PUBLIC_SETTINGS_UPSTREAM_UNAVAILABLE' });
}
