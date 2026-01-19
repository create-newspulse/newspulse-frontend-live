import type { NextApiRequest, NextApiResponse } from 'next';

import path from 'path';
import { promises as fs } from 'fs';

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

const DEV_ALLOWED_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
const LOCAL_CONFIG_PATH = path.join(process.cwd(), 'data', 'broadcast-config.json');
const DEFAULT_LOCAL_CONFIG = {
  breaking: { enabled: true, durationSec: 18 },
  live: { enabled: true, durationSec: 24 },
};

function setCors(req: NextApiRequest, res: NextApiResponse) {
  const origin = String(req.headers.origin || '');
  if (!origin || !DEV_ALLOWED_ORIGINS.has(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function readLocalConfig(): Promise<any> {
  try {
    const raw = await fs.readFile(LOCAL_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const root = parsed && typeof parsed === 'object' ? parsed : {};
    const cfg = (root as any).config && typeof (root as any).config === 'object' ? (root as any).config : root;
    const breaking = (cfg as any).breaking && typeof (cfg as any).breaking === 'object' ? (cfg as any).breaking : {};
    const live = (cfg as any).live && typeof (cfg as any).live === 'object' ? (cfg as any).live : {};
    return {
      ok: true,
      config: {
        breaking: {
          enabled: breaking.enabled === undefined ? DEFAULT_LOCAL_CONFIG.breaking.enabled : Boolean(breaking.enabled),
          durationSec: clampDurationSec(
            breaking.durationSec ?? breaking.durationSeconds ?? breaking.speedSec ?? breaking.speedSeconds,
            DEFAULT_LOCAL_CONFIG.breaking.durationSec
          ),
        },
        live: {
          enabled: live.enabled === undefined ? DEFAULT_LOCAL_CONFIG.live.enabled : Boolean(live.enabled),
          durationSec: clampDurationSec(
            live.durationSec ?? live.durationSeconds ?? live.speedSec ?? live.speedSeconds,
            DEFAULT_LOCAL_CONFIG.live.durationSec
          ),
        },
      },
    };
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      await fs.mkdir(path.dirname(LOCAL_CONFIG_PATH), { recursive: true });
      await fs.writeFile(LOCAL_CONFIG_PATH, JSON.stringify({ ok: true, config: DEFAULT_LOCAL_CONFIG }, null, 2), 'utf8');
      return { ok: true, config: DEFAULT_LOCAL_CONFIG };
    }
    return { ok: true, config: DEFAULT_LOCAL_CONFIG };
  }
}

async function writeLocalConfig(nextConfig: any): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_CONFIG_PATH), { recursive: true });
  await fs.writeFile(LOCAL_CONFIG_PATH, JSON.stringify({ ok: true, config: nextConfig }, null, 2), 'utf8');
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
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'PUT') {
    res.setHeader('Allow', 'GET,PUT,OPTIONS');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const allowWrite = process.env.NODE_ENV !== 'production';

  noStore(res);

  const base = getPublicApiBaseUrl();
  const origin = toOrigin(base);

  // Fail-open: keep UI alive even if env not configured.
  if (!origin) {
    if (req.method === 'PUT') {
      if (!allowWrite) return res.status(405).json({ ok: false, message: 'WRITE_DISABLED' });

      const raw = req.body && typeof req.body === 'object' ? req.body : {};
      const incoming = (raw as any).config && typeof (raw as any).config === 'object' ? (raw as any).config : raw;
      const current = await readLocalConfig();
      const curCfg = (current as any).config || DEFAULT_LOCAL_CONFIG;

      const next = {
        breaking: {
          enabled:
            (incoming as any).breaking?.enabled === undefined
              ? Boolean(curCfg.breaking?.enabled)
              : Boolean((incoming as any).breaking.enabled),
          durationSec: clampDurationSec(
            (incoming as any).breaking?.durationSec ?? (incoming as any).breaking?.durationSeconds,
            Number(curCfg.breaking?.durationSec) || DEFAULT_LOCAL_CONFIG.breaking.durationSec
          ),
        },
        live: {
          enabled:
            (incoming as any).live?.enabled === undefined ? Boolean(curCfg.live?.enabled) : Boolean((incoming as any).live.enabled),
          durationSec: clampDurationSec(
            (incoming as any).live?.durationSec ?? (incoming as any).live?.durationSeconds,
            Number(curCfg.live?.durationSec) || DEFAULT_LOCAL_CONFIG.live.durationSec
          ),
        },
      };

      await writeLocalConfig(next);
      return res.status(200).json(normalizeConfig({ ok: true, config: next }));
    }

    const local = await readLocalConfig();
    return res.status(200).json(normalizeConfig(local));
  }

  // Writes are never proxied here (public route). Only support local dev file-backed writes.
  if (req.method === 'PUT') {
    res.setHeader('Allow', 'GET,OPTIONS');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
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
