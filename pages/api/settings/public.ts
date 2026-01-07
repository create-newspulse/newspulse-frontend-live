import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { promises as fs } from 'fs';

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import {
  DEFAULT_PUBLIC_SETTINGS_RESPONSE,
  mergePublicSettingsResponseWithDefaults,
  type PublicSettingsResponse,
} from '../../../src/lib/publicSettings';

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
  noStore(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getPublicApiBaseUrl();

  // Prefer backend as the source of truth when configured.
  if (base) {
    try {
      const upstream = await fetch(`${base}/api/settings/public`, {
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

      // If backend route is missing or failing, fall through to local published file.
    } catch {
      // Fall through
    }
  }

  try {
    const local = await readPublishedLocal();
    return res.status(200).json(local);
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: String(e?.message || 'PUBLISHED_SETTINGS_READ_FAILED') });
  }
}
