import type { CommunitySettingsPublic, CommunityStorySummary } from "../types/community-reporter";

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
  const res = await fetch(`${base}/api/community-reporter/my-stories?email=${encodeURIComponent(email.toLowerCase())}`);
  const data = await res.json().catch(() => null as any);
  if (res.ok && (data?.ok === true || data?.success === true)) {
    const items = Array.isArray(data?.stories)
      ? data.stories
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.data?.stories)
      ? data.data.stories
      : [];
    return items as CommunityStorySummary[];
  }
  throw new Error(data?.message || 'STORIES_FETCH_FAILED');
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
