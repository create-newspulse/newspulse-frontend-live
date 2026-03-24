import type { CommunitySettingsPublic, CommunityStorySummary } from "../types/community-reporter";

export class CommunityReporterHttpError extends Error {
  status: number;
  url: string;

  constructor(opts: { status: number; url: string; message: string }) {
    super(opts.message);
    this.name = 'CommunityReporterHttpError';
    this.status = opts.status;
    this.url = opts.url;
    // Ensure instanceof works when targeting ES5/ES2015 and extending Error.
    Object.setPrototypeOf(this, CommunityReporterHttpError.prototype);
  }
}

export function isCommunityReporterHttpError(err: unknown): err is CommunityReporterHttpError {
  return Boolean(
    err &&
    typeof err === 'object' &&
    (err as any).name === 'CommunityReporterHttpError' &&
    typeof (err as any).status === 'number' &&
    typeof (err as any).url === 'string'
  );
}

function getApiBase(): string {
  return String(process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/+$/, '');
}

export async function fetchPublicSettings(): Promise<CommunitySettingsPublic | null> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/public/community/settings`, { headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => null as any);
    if (res.ok && data && data.ok === true && data.settings) {
      return {
        communityReporterEnabled: Boolean(data.settings.communityReporterEnabled),
        allowNewSubmissions: Boolean(data.settings.allowNewSubmissions),
        allowMyStoriesPortal: Boolean(data.settings.allowMyStoriesPortal),
        allowJournalistApplications: Boolean(data.settings.allowJournalistApplications),
      };
    }
  } catch {}
  return null;
}

export async function fetchMyStoriesByEmail(email: string): Promise<CommunityStorySummary[]> {
  if (!email) return [];
  const base = getApiBase();
  const normalizedEmail = email.trim().toLowerCase();
  const url = `${base}/api/community-reporter/my-stories?email=${encodeURIComponent(normalizedEmail)}`;
  const res: any = await fetch(url, { headers: { Accept: 'application/json' } });
  const status: number = typeof res?.status === 'number' ? res.status : (res?.ok ? 200 : 500);

  const isJest = Boolean((globalThis as any)?.jest) || (typeof process !== 'undefined' && Boolean((process.env as any)?.JEST_WORKER_ID));
  if (process.env.NODE_ENV === 'development' && !isJest) {
    // Dev-only: helps trace backend 500s without breaking UI.
    // Intentionally logs only route + status (no response body).
    // eslint-disable-next-line no-console
    console.log('[communityReporterApi] GET', '/api/community-reporter/my-stories?email=…', '->', status);
  }

  const data = await res.json().catch(() => null as any);
  const items = Array.isArray(data?.stories)
    ? data.stories
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data?.stories)
    ? data.data.stories
    : [];

  // Prefer returning stories if present, even if upstream returns a non-2xx.
  if (items.length) return items as CommunityStorySummary[];

  if (res.ok && (data?.ok === true || data?.success === true)) {
    return [];
  }

  throw new CommunityReporterHttpError({
    status,
    url,
    message: data?.message || 'STORIES_FETCH_FAILED',
  });
}

export async function withdrawStoryById(id: string, reporterId?: string | null): Promise<boolean> {
  const sid = String(id || '').trim();
  if (!sid) return false;
  const base = getApiBase();
  const res = await fetch(`${base}/api/public/community-reporter/${encodeURIComponent(sid)}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ reporterId: reporterId || undefined }),
  });
  const data = await res.json().catch(() => null as any);
  return Boolean(res.ok && (data?.ok === true || data?.success === true));
}
