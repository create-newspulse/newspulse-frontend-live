import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from './publicApiBase';

const DEV_ALLOWED_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

function setCors(req: NextApiRequest, res: NextApiResponse, methods: string[]) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return;

  const isProdDeployment =
    String(process.env.VERCEL_ENV || '').toLowerCase() === 'production' ||
    ['prod', 'production'].includes(String(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '').toLowerCase());

  if (isProdDeployment) return;
  if (!DEV_ALLOWED_ORIGINS.has(origin)) return;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function toOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function getBody(req: NextApiRequest): string | undefined {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  if (req.body == null) return undefined;
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body);
}

function getHeaders(req: NextApiRequest): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: String(req.headers.accept || 'application/json'),
    cookie: String(req.headers.cookie || ''),
    authorization: String(req.headers.authorization || ''),
  };

  const contentType = String(req.headers['content-type'] || '').trim();
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  return headers;
}

async function readUpstream(res: Response): Promise<{ json: any | null; text: string }> {
  const text = await res.text().catch(() => '');
  if (!text) return { json: null, text: '' };
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

export function createAdminApiProxyHandler(input: {
  allowMethods: string[];
  upstreamPath: string;
}) {
  const allowMethods = Array.from(new Set(input.allowMethods.map((method) => method.toUpperCase())));

  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    setCors(req, res, allowMethods);
    noStore(res);

    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', [...allowMethods, 'OPTIONS'].join(','));
      return res.status(200).end();
    }

    const method = String(req.method || 'GET').toUpperCase();
    if (!allowMethods.includes(method)) {
      res.setHeader('Allow', [...allowMethods, 'OPTIONS'].join(','));
      return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
    }

    const base = getPublicApiBaseUrl();
    const origin = toOrigin(base);
    if (!origin) {
      return res.status(500).json({ ok: false, message: 'BACKEND_NOT_CONFIGURED' });
    }

    const queryIndex = String(req.url || '').indexOf('?');
    const query = queryIndex >= 0 ? String(req.url || '').slice(queryIndex) : '';
    const upstreamUrl = `${origin}${input.upstreamPath}${query}`;

    try {
      const upstream = await fetch(upstreamUrl, {
        method,
        headers: getHeaders(req),
        body: getBody(req),
        cache: 'no-store',
      });

      const { json, text } = await readUpstream(upstream);

      if (json !== null) {
        return res.status(upstream.status || 502).json(json);
      }

      if (text) {
        return res.status(upstream.status || 502).send(text);
      }

      return res.status(upstream.status || 502).end();
    } catch {
      return res.status(502).json({ ok: false, message: 'UPSTREAM_REQUEST_FAILED' });
    }
  };
}