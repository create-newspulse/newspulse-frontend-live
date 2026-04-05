import type { CommunitySettingsPublic, CommunityStorySummary } from "../types/community-reporter";
import { getPublicApiBaseUrl } from './publicApiBase';
import { normalizeReporterEmail } from './reporterPortal';

type FetchMyStoriesOptions = {
  reporterAuth?: boolean;
  useProxy?: boolean;
  debugContexts?: string[];
};

function shouldLogReporterDebug(): boolean {
  const isJest = Boolean((globalThis as any)?.jest) || (typeof process !== 'undefined' && Boolean((process.env as any)?.JEST_WORKER_ID));
  return process.env.NODE_ENV === 'development' && !isJest;
}

function logReporterDebug(event: string, details: Record<string, unknown>) {
  if (!shouldLogReporterDebug()) {
    return;
  }
  // eslint-disable-next-line no-console
  console.info(`[Reporter Portal] ${event}`, details);
}

export class CommunityReporterHttpError extends Error {
  status: number;
  url: string;
  code?: string;

  constructor(opts: { status: number; url: string; message: string; code?: string }) {
    super(opts.message);
    this.name = 'CommunityReporterHttpError';
    this.status = opts.status;
    this.url = opts.url;
    this.code = opts.code;
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
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
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

export async function fetchMyStoriesByEmail(email: string, options?: FetchMyStoriesOptions): Promise<CommunityStorySummary[]> {
  if (!email) return [];
  const base = getApiBase();
  const normalizedEmail = normalizeReporterEmail(email);
  const useProxy = Boolean(options?.useProxy);
  const url = useProxy
    ? `/api/community-reporter/my-stories?email=${encodeURIComponent(normalizedEmail)}`
    : `${base}/api/community-reporter/my-stories?email=${encodeURIComponent(normalizedEmail)}`;
  const credentialsEnabled = Boolean(options?.reporterAuth);
  const debugContexts = options?.debugContexts?.length ? options.debugContexts : ['reporter submissions fetch'];
  for (const context of debugContexts) {
    logReporterDebug(`${context} request`, {
      url,
      credentialsIncluded: credentialsEnabled,
    });
  }
  const res: any = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
    credentials: credentialsEnabled ? 'include' : undefined,
  });
  const status: number = typeof res?.status === 'number' ? res.status : (res?.ok ? 200 : 500);

  const data = await res.json().catch(() => null as any);
  const responseCode = String(data?.code || '').trim() || null;
  const responseMessage = String(data?.message || '').trim() || null;
  for (const context of debugContexts) {
    logReporterDebug(`${context} response`, {
      url,
      status,
      responseCode,
      responseMessage,
      credentialsIncluded: credentialsEnabled,
    });
  }

  const items = Array.isArray(data?.stories)
    ? data.stories
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data?.stories)
    ? data.data.stories
    : [];
  const hasCollectionShape = Array.isArray(data?.stories) || Array.isArray(data?.items) || Array.isArray(data?.data?.stories);

  // Prefer returning stories if present, even if upstream returns a non-2xx.
  if (items.length) return items as CommunityStorySummary[];

  if (res.ok && (data?.ok === true || data?.success === true || hasCollectionShape)) {
    return [];
  }

  throw new CommunityReporterHttpError({
    status,
    url,
    message: responseMessage || responseCode || 'STORIES_FETCH_FAILED',
    code: responseCode || undefined,
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
