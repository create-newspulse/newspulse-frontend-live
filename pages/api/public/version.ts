import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { promises as fs } from 'fs';

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { normalizePublicVersion } from '../../../lib/publicVersion';

const PUBLISHED_PATH = path.join(process.cwd(), 'data', 'public-site-settings.published.json');

type PublicVersionResponse = {
  ok: boolean;
  version: string | null;
  updatedAt: string | null;
  message?: string;
};

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

async function readLocalPublishedVersion(): Promise<PublicVersionResponse> {
  try {
    const raw = await fs.readFile(PUBLISHED_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const normalized = normalizePublicVersion(parsed);
    return {
      ok: normalized.ok,
      version: normalized.version,
      updatedAt: normalized.updatedAt,
    };
  } catch {
    return {
      ok: false,
      version: null,
      updatedAt: null,
      message: 'LOCAL_VERSION_UNAVAILABLE',
    };
  }
}

async function tryFetchVersion(url: string): Promise<PublicVersionResponse | null> {
  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });

    const body = await upstream.json().catch(() => null);
    const normalized = normalizePublicVersion(body);
    if (!upstream.ok || !normalized.version) return null;

    return {
      ok: normalized.ok,
      version: normalized.version,
      updatedAt: normalized.updatedAt,
    };
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<PublicVersionResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, version: null, updatedAt: null, message: 'METHOD_NOT_ALLOWED' });
  }

  noStore(res);

  const origin = normalizeOrigin(getPublicApiBaseUrl());
  if (!origin) {
    const local = await readLocalPublishedVersion();
    return res.status(200).json(local);
  }

  const direct = await tryFetchVersion(`${origin}/api/public/version`);
  if (direct) return res.status(200).json(direct);

  const legacy = await tryFetchVersion(`${origin}/public/version`);
  if (legacy) return res.status(200).json(legacy);

  const settingsFallback = await tryFetchVersion(`${origin}/api/public/settings`);
  if (settingsFallback) return res.status(200).json(settingsFallback);

  const local = await readLocalPublishedVersion();
  return res.status(200).json(local);
}