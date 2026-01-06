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

  const allowLocalFallback = process.env.NODE_ENV !== 'production';

  // In production we expect a real backend source of truth.
  // If it's not configured, signal failure so the client can fall back to local UI behavior.
  if (!base && !allowLocalFallback) {
    return res.status(503).json({ ok: false, message: 'PUBLIC_SETTINGS_BACKEND_NOT_CONFIGURED' });
  }

  // Prefer backend as the source of truth when configured.
  if (base) {
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

      if (!allowLocalFallback) {
        return res.status(502).json({ ok: false, message: `PUBLIC_SETTINGS_UPSTREAM_${upstream.status || 0}` });
      }
      // DEV: fall through to local published file.
    } catch {
      if (!allowLocalFallback) {
        return res.status(502).json({ ok: false, message: 'PUBLIC_SETTINGS_UPSTREAM_FETCH_FAILED' });
      }
      // DEV: fall through
    }
  }

  if (!allowLocalFallback) {
    return res.status(503).json({ ok: false, message: 'PUBLIC_SETTINGS_NO_SOURCE' });
  }

  try {
    const local = await readPublishedLocal();
    return res.status(200).json(local);
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: String(e?.message || 'PUBLISHED_SETTINGS_READ_FAILED') });
  }
}
