import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { promises as fs } from 'fs';

import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';
import {
  DEFAULT_PUBLIC_SETTINGS_RESPONSE,
  mergePublicSettingsWithDefaults,
  type PublicSettings,
} from '../../../../../src/lib/publicSettings';

const DRAFT_PATH = path.join(process.cwd(), 'data', 'public-site-settings.draft.json');

type DraftDoc = {
  settings: PublicSettings;
  updatedAt: string;
};

const DEV_ALLOWED_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

function setCors(req: NextApiRequest, res: NextApiResponse) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return;

  const isProdDeployment =
    String(process.env.VERCEL_ENV || '').toLowerCase() === 'production' ||
    ['prod', 'production'].includes(String(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '').toLowerCase());

  // Only allow cross-origin access from the local admin dev server.
  if (isProdDeployment) return;
  if (!DEV_ALLOWED_ORIGINS.has(origin)) return;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

async function ensureDraftFile(): Promise<void> {
  try {
    await fs.access(DRAFT_PATH);
  } catch (e: any) {
    if (e?.code !== 'ENOENT') throw e;
    await fs.mkdir(path.dirname(DRAFT_PATH), { recursive: true });
    const initial: DraftDoc = {
      settings: DEFAULT_PUBLIC_SETTINGS_RESPONSE.settings,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(DRAFT_PATH, JSON.stringify(initial, null, 2), 'utf8');
  }
}

async function readDraftLocal(): Promise<DraftDoc> {
  await ensureDraftFile();
  const raw = await fs.readFile(DRAFT_PATH, 'utf8');
  const parsed = JSON.parse(raw);

  const settings = mergePublicSettingsWithDefaults(parsed?.settings ?? parsed);
  const updatedAt = typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString();

  return { settings, updatedAt };
}

async function writeDraftLocal(settingsRaw: unknown): Promise<DraftDoc> {
  const settings = mergePublicSettingsWithDefaults(settingsRaw);
  const doc: DraftDoc = { settings, updatedAt: new Date().toISOString() };

  await fs.mkdir(path.dirname(DRAFT_PATH), { recursive: true });
  await fs.writeFile(DRAFT_PATH, JSON.stringify(doc, null, 2), 'utf8');
  return doc;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(req, res);
  noStore(res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET,PUT,OPTIONS');
    return res.status(200).end();
  }

  const base = getPublicApiBaseUrl();

  // Prefer backend draft when configured.
  if (base) {
    try {
      if (req.method === 'GET') {
        const upstream = await fetch(`${base}/api/admin/settings/public/draft`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            cookie: String(req.headers.cookie || ''),
            authorization: String(req.headers.authorization || ''),
          },
          cache: 'no-store',
        });
        const json = await upstream.json().catch(() => null);
        if (upstream.ok && json) return res.status(200).json(json);
      }

      if (req.method === 'PUT') {
        const upstream = await fetch(`${base}/api/admin/settings/public/draft`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            cookie: String(req.headers.cookie || ''),
            authorization: String(req.headers.authorization || ''),
          },
          body: JSON.stringify(req.body ?? {}),
          cache: 'no-store',
        });
        const json = await upstream.json().catch(() => null);
        if (upstream.ok && json) return res.status(200).json(json);
      }
      // Fall through to local if missing/failing.
    } catch {
      // Fall through
    }
  }

  if (req.method === 'GET') {
    try {
      const draft = await readDraftLocal();
      return res.status(200).json({ ok: true, ...draft });
    } catch (e: any) {
      return res.status(500).json({ ok: false, message: String(e?.message || 'DRAFT_READ_FAILED') });
    }
  }

  if (req.method === 'PUT') {
    try {
      const next = await writeDraftLocal(req.body ?? {});
      return res.status(200).json({ ok: true, ...next });
    } catch (e: any) {
      return res.status(400).json({ ok: false, message: String(e?.message || 'DRAFT_WRITE_FAILED') });
    }
  }

  res.setHeader('Allow', 'GET,PUT,OPTIONS');
  return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
}
