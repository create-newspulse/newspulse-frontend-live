import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { promises as fs } from 'fs';

import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';
import {
  DEFAULT_PUBLIC_SETTINGS_RESPONSE,
  mergePublicSettingsWithDefaults,
  mergePublicSettingsResponseWithDefaults,
  type PublicSettingsResponse,
} from '../../../../../src/lib/publicSettings';

const DRAFT_PATH = path.join(process.cwd(), 'data', 'public-site-settings.draft.json');
const PUBLISHED_PATH = path.join(process.cwd(), 'data', 'public-site-settings.published.json');

const DEV_ALLOWED_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

function setCors(req: NextApiRequest, res: NextApiResponse) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return;

  const isProdDeployment =
    String(process.env.VERCEL_ENV || '').toLowerCase() === 'production' ||
    ['prod', 'production'].includes(String(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '').toLowerCase());

  if (isProdDeployment) return;
  if (!DEV_ALLOWED_ORIGINS.has(origin)) return;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

async function readDraftSettingsLocal(): Promise<unknown> {
  try {
    const raw = await fs.readFile(DRAFT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed?.settings ?? parsed;
  } catch (e: any) {
    if (e?.code === 'ENOENT') {
      return DEFAULT_PUBLIC_SETTINGS_RESPONSE.settings;
    }
    throw e;
  }
}

async function writePublishedLocal(settingsRaw: unknown): Promise<PublicSettingsResponse> {
  const settings = mergePublicSettingsWithDefaults(settingsRaw);

  const doc: PublicSettingsResponse = {
    settings,
    version: String(Date.now()),
    updatedAt: new Date().toISOString(),
  };

  await fs.mkdir(path.dirname(PUBLISHED_PATH), { recursive: true });
  await fs.writeFile(PUBLISHED_PATH, JSON.stringify(doc, null, 2), 'utf8');

  return mergePublicSettingsResponseWithDefaults(doc);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(req, res);
  noStore(res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getPublicApiBaseUrl();

  // Prefer backend publish when configured.
  if (base) {
    try {
      const upstream = await fetch(`${base}/api/admin/settings/public/publish`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          cookie: String(req.headers.cookie || ''),
          authorization: String(req.headers.authorization || ''),
        },
        cache: 'no-store',
      });

      const json = await upstream.json().catch(() => null);
      if (upstream.ok && json) {
        return res.status(200).json(json);
      }

      // If the backend route doesn't exist yet, use local publish so the admin UI
      // isn't blocked by a missing endpoint.
      if (upstream.status === 404) {
        // Fall through to local publish.
      } else {
        // If backend responded with an error, pass it through so the UI doesn't show fake success.
        if (json) {
          return res.status(upstream.status || 502).json(json);
        }
      }
    } catch {
      // Fall through
    }
  }

  try {
    const draftSettingsRaw = await readDraftSettingsLocal();
    const published = await writePublishedLocal(draftSettingsRaw);
    return res.status(200).json({ ok: true, ...published });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: String(e?.message || 'PUBLISH_FAILED') });
  }
}
