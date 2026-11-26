import { useEffect, useState } from 'react';
import { readStoryDetail, readStoryList, readStorySummary, ReporterReadError } from '../lib/communityReporterApi';
import type { ReporterStory, StoryList, StorySummary } from '../lib/reporterStories';

export type ReporterProfileSummary = { fullName?: string; name?: string; firstName?: string; email?: string; phone?: string; whatsapp?: string; city?: string; district?: string; state?: string; country?: string };
export type StoryView = 'dashboard' | 'submissions' | 'detail';
type Records = { list?: StoryList; summary?: StorySummary; story?: ReporterStory };
type Result = { state: 'loading' } | { state: 'error'; status: number } | { state: 'ready'; data: Records };

export function useCommunityStories(accountId: string | null, view: StoryView, page = 1, id = '') {
  const [version, setVersion] = useState(0);
  const key = accountId ? `${accountId}:${view}:${page}:${id}:${version}` : '';
  const [result, setResult] = useState<{ key: string; result: Result } | null>(null);
  useEffect(() => {
    setResult(null);
    if (!accountId) return;
    const controller = new AbortController();
    const signal = controller.signal;
    const load = async (): Promise<Records> => {
      if (view === 'detail') return { story: await readStoryDetail(accountId, id, signal) };
      if (view === 'submissions') return { list: await readStoryList(accountId, page, 20, signal) };
      const [summary, list] = await Promise.all([readStorySummary(accountId, signal), readStoryList(accountId, 1, 5, signal)]);
      return { summary, list };
    };
    void load().then(data => {
      if (!signal.aborted) setResult({ key, result: { state: 'ready', data } });
    }).catch(error => {
      if (!signal.aborted) setResult({ key, result: { state: 'error', status: error instanceof ReporterReadError ? error.status : 502 } });
    });
    return () => controller.abort();
  }, [key, accountId, view, page, id]);
  // Effects run after render: never paint a previous account/page while the new request starts.
  const current: Result = key && result?.key === key ? result.result : { state: 'loading' };
  return { result: current, reload: () => setVersion(v => v + 1) };
}
