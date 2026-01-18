import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function toOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

async function safeJson(res: Response): Promise<any | null> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function clampDurationSec(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(10, n));
}

function normalizeConfig(raw: any) {
  // Accept a few possible upstream shapes:
  // - { config: { breaking: { enabled, durationSec }, live: ... } }
  // - { breaking: { enabled, durationSec }, live: ... }
  // - { settings: { breaking: { enabled, speedSec }, live: ... } }
  const root = raw && typeof raw === 'object' ? raw : {};
  const cfg = root.config && typeof root.config === 'object' ? root.config : root;
  const settings = root.settings && typeof root.settings === 'object' ? root.settings : null;

  const breakingSrc = (cfg as any).breaking ?? (settings as any)?.breaking ?? null;
  const liveSrc = (cfg as any).live ?? (settings as any)?.live ?? null;

  const breakingEnabled = breakingSrc?.enabled;
  const liveEnabled = liveSrc?.enabled;

  const breakingDuration =
    breakingSrc?.durationSec ?? breakingSrc?.durationSeconds ?? breakingSrc?.speedSec ?? breakingSrc?.speedSeconds;
  const liveDuration = liveSrc?.durationSec ?? liveSrc?.durationSeconds ?? liveSrc?.speedSec ?? liveSrc?.speedSeconds;

  return {
    ok: root.ok !== false,
    config: {
      breaking: {
        enabled: breakingEnabled === undefined ? true : Boolean(breakingEnabled),
        durationSec: clampDurationSec(breakingDuration, 18),
      },
      live: {
        enabled: liveEnabled === undefined ? true : Boolean(liveEnabled),
        durationSec: clampDurationSec(liveDuration, 24),
      },
    },
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  noStore(res);

  const base = getPublicApiBaseUrl();
  const origin = toOrigin(base);

  // Fail-open: keep UI alive even if env not configured.
  if (!origin) {
    return res.status(200).json({
      ok: true,
      config: {
        breaking: { enabled: true, durationSec: 18 },
        live: { enabled: true, durationSec: 24 },
      },
    });
  }

  const fetchUpstream = async (path: string) => {
    const upstream = await fetch(`${origin}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        cookie: String(req.headers.cookie || ''),
        authorization: String(req.headers.authorization || ''),
      },
    });
    const json = await safeJson(upstream);
    return { upstream, json };
  };

  try {
    // Preferred: /api/public/broadcast/config
    const primary = await fetchUpstream('/api/public/broadcast/config');
    if (primary.upstream.ok && primary.json) return res.status(200).json(normalizeConfig(primary.json));

    // Fallback: /api/public/broadcast/settings (older backend)
    const fallback = await fetchUpstream('/api/public/broadcast/settings');
    if (fallback.upstream.ok && fallback.json) return res.status(200).json(normalizeConfig(fallback.json));

    return res.status(200).json(normalizeConfig({ ok: true }));
  } catch {
    return res.status(200).json(normalizeConfig({ ok: true }));
  }
}
