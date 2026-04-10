import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicApiBaseUrl } from './publicApiBase';

const DEFAULT_PROD_REPORTER_AUTH_BASE = 'https://newspulse-backend-real.onrender.com';
const KNOWN_FRONTEND_HOSTS = new Set(['www.newspulse.co.in', 'newspulse.co.in', 'admin.newspulse.co.in']);

type ReporterAuthProxyTarget = {
  url: string | null;
  base: string | null;
  source: 'reporter_auth_env' | 'public_api_base' | 'prod_default' | 'unavailable';
  reason: 'explicit_env' | 'configured_base' | 'frontend_target_rejected' | 'missing_base' | 'dev_same_host_rejected';
};

function isProdDeployment(): boolean {
  if (String(process.env.VERCEL_ENV || '').toLowerCase() === 'production') return true;
  const explicit = String(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '').toLowerCase();
  return explicit === 'production' || explicit === 'prod';
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizeBase(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function getHostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function getRequestHost(req?: NextApiRequest): string {
  return String(req?.headers['x-forwarded-host'] || req?.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
}

function getConfiguredFrontendHosts(req?: NextApiRequest): Set<string> {
  const hosts = new Set<string>();

  [
    getRequestHost(req),
    String(process.env.VERCEL_URL || '').trim(),
    String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim(),
    String(process.env.NEXT_PUBLIC_SITE_URL || '').trim(),
    String(process.env.NEXT_PUBLIC_APP_URL || '').trim(),
    String(process.env.SITE_URL || '').trim(),
  ].forEach((value) => {
    const hostname = getHostname(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (hostname) {
      hosts.add(hostname);
    }
  });

  KNOWN_FRONTEND_HOSTS.forEach((hostname) => hosts.add(hostname));
  return hosts;
}

function isLikelyFrontendHostname(hostname: string, req?: NextApiRequest): boolean {
  if (!hostname) return false;
  if (hostname.endsWith('.vercel.app')) return true;
  if (hostname === 'vercel.app') return true;
  if (getConfiguredFrontendHosts(req).has(hostname)) return true;
  return false;
}

function isFrontendProxyBase(base: string, req?: NextApiRequest): boolean {
  const hostname = getHostname(base);
  if (!hostname) return false;

  if (isLikelyFrontendHostname(hostname, req)) {
    return true;
  }

  return false;
}

function getReporterAuthConfiguredBase(): string {
  return normalizeBase(
    String(
      process.env.REPORTER_AUTH_API_BASE ||
      process.env.REPORTER_AUTH_BACKEND_URL ||
      process.env.REPORTER_PORTAL_API_BASE ||
      process.env.REPORTER_PORTAL_BACKEND_URL ||
      ''
    )
  );
}

export function resolveReporterAuthProxyTarget(path: string, req?: NextApiRequest): ReporterAuthProxyTarget {
  const explicitReporterBase = getReporterAuthConfiguredBase();
  if (explicitReporterBase) {
    return {
      url: `${explicitReporterBase}${normalizePath(path)}`,
      base: explicitReporterBase,
      source: 'reporter_auth_env',
      reason: 'explicit_env',
    };
  }

  const configuredBase = normalizeBase(String(getPublicApiBaseUrl() || ''));
  if (configuredBase && !isFrontendProxyBase(configuredBase, req)) {
    return {
      url: `${configuredBase}${normalizePath(path)}`,
      base: configuredBase,
      source: 'public_api_base',
      reason: 'configured_base',
    };
  }

  if (isProdDeployment()) {
    return {
      url: `${DEFAULT_PROD_REPORTER_AUTH_BASE}${normalizePath(path)}`,
      base: DEFAULT_PROD_REPORTER_AUTH_BASE,
      source: 'prod_default',
      reason: configuredBase ? 'frontend_target_rejected' : 'missing_base',
    };
  }

  return {
    url: null,
    base: null,
    source: 'unavailable',
    reason: configuredBase ? 'dev_same_host_rejected' : 'missing_base',
  };
}

export function resolveReporterAuthProxyUrl(path: string, req?: NextApiRequest): string | null {
  return resolveReporterAuthProxyTarget(path, req).url;
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