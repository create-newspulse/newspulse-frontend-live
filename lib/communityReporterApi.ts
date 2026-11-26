import type { CommunitySettingsPublic } from '../types/community-reporter';
import { reporterLifecycleStamp, signalReporterSessionInvalid } from './reporterPrivacy';
import { projectList, projectStory, projectSummary, record, reporterObjectId } from './reporterStories';

export async function fetchPublicSettings(): Promise<CommunitySettingsPublic | null> {
  try {
    const res = await fetch('/api/public/community/settings', { cache: 'no-store', headers: { Accept: 'application/json' } });
    const data = await res.json();
    if (!res.ok || data?.ok !== true || !data.settings) return null;
    const { communityReporterEnabled, allowNewSubmissions, allowMyStoriesPortal, allowJournalistApplications } = data.settings;
    if (![communityReporterEnabled, allowNewSubmissions, allowMyStoriesPortal, allowJournalistApplications].every(v => typeof v === 'boolean')) return null;
    return { communityReporterEnabled, allowNewSubmissions, allowMyStoriesPortal, allowJournalistApplications };
  } catch { return null; }
}

export class ReporterReadError extends Error {
  constructor(public status: number) { super('REPORTER_READ_FAILED'); }
}
async function request(path: string, accountId: string, signal?: AbortSignal, method = 'GET') {
  if (!reporterObjectId(accountId)) throw new ReporterReadError(401);
  const stamp = reporterLifecycleStamp();
  const res = await fetch(path, {
    method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
    headers: { Accept: 'application/json', 'X-Reporter-Account': accountId, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
  if (!res.ok) {
    if (!signal?.aborted && reporterLifecycleStamp() === stamp && [401, 403, 409].includes(res.status)) {
      const error = await res.json().catch(() => null);
      // A non-editable draft is not an authentication failure.
      if (!signal?.aborted && reporterLifecycleStamp() === stamp && (res.status !== 409
        || error?.code === 'REPORTER_ACCOUNT_CHANGED' || error?.code === 'LOGOUT_UNCONFIRMED')) signalReporterSessionInvalid();
    }
    throw new ReporterReadError(res.status);
  }
  const data: unknown = await res.json();
  if (!record(data) || data.ok !== true) throw new ReporterReadError(502);
  return data;
}
export async function readStoryList(accountId: string, page: number, limit: number, signal?: AbortSignal) {
  const data = await request(`/api/reporter-portal/submissions?page=${page}&limit=${limit}`, accountId, signal);
  return projectList(data, page, limit);
}
export async function readStorySummary(accountId: string, signal?: AbortSignal) {
  return projectSummary((await request('/api/reporter-portal/dashboard/summary', accountId, signal)).summary);
}
export async function readStoryDetail(accountId: string, id: string, signal?: AbortSignal) {
  if (!reporterObjectId(id)) throw new ReporterReadError(404);
  const data = await request(`/api/reporter-portal/submissions/${id}`, accountId, signal);
  const story = projectStory(data.item, id);
  // The proxy computes this from the exact Backend withdrawal policy; rawStatus is not forwarded.
  return { ...story, canWithdraw: record(data.item) && data.item.canWithdraw === true && story.reviewStatus === 'UNDER_REVIEW' && story.publicationStatus === 'not_published' };
}
export async function withdrawStoryById(id: string, accountId: string) {
  if (!reporterObjectId(id)) throw new ReporterReadError(404);
  await request(`/api/community-reporter/${id}/withdraw`, accountId, undefined, 'POST');
}
