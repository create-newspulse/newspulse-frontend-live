// lib/publicMode.ts
// Fetches global system mode from backend with TTL caching

export type PublicMode = 'NORMAL' | 'READONLY' | 'LOCKDOWN';

export type PublicModeResponse = {
  ok: boolean;
  mode: PublicMode;
  readOnly: boolean;
  externalFetch: boolean;
  message?: string;
};

function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE || '').toString().trim();
  return raw.replace(/\/+$/, '');
}
const CACHE_TTL_MS = 60_000; // 60 seconds

let cachedResponse: { fetchedAt: number; data: PublicModeResponse } | null = null;

const DEFAULT_MODE: PublicModeResponse = {
  ok: true,
  mode: 'NORMAL',
  readOnly: false,
  externalFetch: true,
};

export async function fetchPublicMode(): Promise<PublicModeResponse> {
  const now = Date.now();

  // Return cached if still valid
  if (cachedResponse && now - cachedResponse.fetchedAt < CACHE_TTL_MS) {
    return cachedResponse.data;
  }

  try {
    // In the browser, use Next API route proxy (avoids CORS and backend-down 502s).
    const url = typeof window !== 'undefined' ? '/api/public/mode' : `${getApiBase()}/api/system/public-mode`;
    if (typeof window === 'undefined' && !getApiBase()) return DEFAULT_MODE;

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // No credentials for public endpoint
    });

    if (!res.ok) {
      console.warn('[publicMode] Backend returned non-OK status:', res.status);
      return DEFAULT_MODE;
    }

    const data = await res.json().catch(() => null);
    if (!data || typeof data !== 'object') {
      console.warn('[publicMode] Invalid JSON response from backend');
      return DEFAULT_MODE;
    }

    const parsed: PublicModeResponse = {
      ok: data.ok === true,
      mode: ['NORMAL', 'READONLY', 'LOCKDOWN'].includes(data.mode) ? data.mode : 'NORMAL',
      readOnly: Boolean(data.readOnly),
      externalFetch: data.externalFetch !== false, // default true
      message: data.message,
    };

    cachedResponse = { fetchedAt: now, data: parsed };
    return parsed;
  } catch {
    return DEFAULT_MODE;
  }
}

export function clearPublicModeCache() {
  cachedResponse = null;
}
