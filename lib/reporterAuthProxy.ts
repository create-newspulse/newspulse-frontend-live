import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicApiBaseUrl } from './publicApiBase';

export function resolveReporterAuthProxyUrl(path: string): string | null {
  const base = String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
  if (!base) {
    return null;
  }

  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getReporterProxySetCookies(headers: Headers): string[] {
  const candidate = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof candidate.getSetCookie === 'function') {
    return candidate.getSetCookie().filter(Boolean);
  }

  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

export function forwardReporterProxyCookies(res: NextApiResponse, headers: Headers, extraCookies: string[] = []) {
  const cookies = [...getReporterProxySetCookies(headers), ...extraCookies].filter(Boolean);
  if (cookies.length > 0) {
    res.setHeader('Set-Cookie', cookies);
  }
}

export async function readReporterProxyBody(response: Response): Promise<{ data: any; text: string }> {
  const text = await response.text().catch(() => '');
  if (!text) {
    return { data: null, text: '' };
  }

  try {
    return { data: JSON.parse(text), text };
  } catch {
    return { data: null, text };
  }
}

export function getReporterForwardCookieHeader(req: NextApiRequest): string {
  return String(req.headers.cookie || '').trim();
}