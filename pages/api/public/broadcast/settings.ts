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

const DEV_ALLOWED_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
const LOCAL_CONFIG_PATH = path.join(process.cwd(), 'data', 'broadcast-config.json');

function setCors(req: NextApiRequest, res: NextApiResponse) {
  const origin = String(req.headers.origin || '');
  if (!origin || !DEV_ALLOWED_ORIGINS.has(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function clampSpeedSec(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(40, Math.max(10, n));
}

async function readLocalConfig(): Promise<any> {
  try {
    const raw = await fs.readFile(LOCAL_CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeLocalConfig(next: any): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_CONFIG_PATH), { recursive: true });
  await fs.writeFile(LOCAL_CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
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
  if (!origin) {
    const local = await readLocalConfig();
    const cfg = local && typeof local === 'object' ? ((local as any).config ?? local) : null;
    const breaking = cfg && (cfg as any).breaking ? (cfg as any).breaking : {};
    const live = cfg && (cfg as any).live ? (cfg as any).live : {};

    if (req.method === 'PUT') {
      if (!allowWrite) return res.status(405).json({ ok: false, message: 'WRITE_DISABLED' });

      const raw = req.body && typeof req.body === 'object' ? req.body : {};
      const incoming = (raw as any).settings && typeof (raw as any).settings === 'object' ? (raw as any).settings : raw;

      const nextCfg = {
        breaking: {
          enabled:
            (incoming as any).breaking?.enabled === undefined
              ? (breaking.enabled === undefined ? true : Boolean(breaking.enabled))
              : Boolean((incoming as any).breaking.enabled),
          durationSec: clampSpeedSec(
            (incoming as any).breaking?.speedSec ?? (incoming as any).breaking?.speedSeconds,
            clampSpeedSec(breaking.durationSec ?? breaking.speedSec, 18)
          ),
        },
        live: {
          enabled:
            (incoming as any).live?.enabled === undefined
              ? (live.enabled === undefined ? true : Boolean(live.enabled))
              : Boolean((incoming as any).live.enabled),
          durationSec: clampSpeedSec(
            (incoming as any).live?.speedSec ?? (incoming as any).live?.speedSeconds,
            clampSpeedSec(live.durationSec ?? live.speedSec, 24)
          ),
        },
      };

      await writeLocalConfig({ ok: true, config: nextCfg });
      return res.status(200).json({
        ok: true,
        settings: {
          breaking: { enabled: nextCfg.breaking.enabled, mode: 'AUTO', speedSec: nextCfg.breaking.durationSec },
          live: { enabled: nextCfg.live.enabled, mode: 'AUTO', speedSec: nextCfg.live.durationSec },
        },
      });
    }

    return res.status(200).json({
      ok: true,
      settings: {
        breaking: { enabled: breaking.enabled === undefined ? true : Boolean(breaking.enabled), mode: 'AUTO', speedSec: clampSpeedSec(breaking.durationSec ?? breaking.speedSec, 18) },
        live: { enabled: live.enabled === undefined ? true : Boolean(live.enabled), mode: 'AUTO', speedSec: clampSpeedSec(live.durationSec ?? live.speedSec, 24) },
      },
    });
  }

  // Writes are never proxied here (public route). Only support local dev file-backed writes.
  if (req.method === 'PUT') {
    res.setHeader('Allow', 'GET,OPTIONS');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const upstream = await fetch(`${origin}/api/public/broadcast/settings`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        cookie: String(req.headers.cookie || ''),
        authorization: String(req.headers.authorization || ''),
      },
    });

    const json = await safeJson(upstream);
    if (!upstream.ok || !json) return res.status(200).json({ ok: true, settings: {} });
    return res.status(200).json(json);
  } catch {
    return res.status(200).json({ ok: true, settings: {} });
  }
}
