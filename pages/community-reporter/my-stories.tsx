import Head from 'next/head';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import type { GetServerSideProps } from 'next';

type CommunityStorySummary = {
  id: string;
  referenceId?: string;
  headline: string;
  category: string;
  city?: string;
  state?: string;
  status: string;
  createdAt: string;
  submittedAt?: string;
  priority?: string;
  urgency?: string;
};

const statusColor = (s: string) => {
  const k = (s || '').toLowerCase();
  if (k === 'draft') return 'bg-gray-100 text-gray-800';
  if (k === 'pending' || k === 'under_review' || k === 'under-review') return 'bg-blue-100 text-blue-800';
  if (k === 'approved') return 'bg-green-100 text-green-800';
  if (k === 'published') return 'bg-emerald-100 text-emerald-800';
  if (k === 'rejected') return 'bg-red-100 text-red-800';
  if (k === 'withdrawn') return 'bg-orange-100 text-orange-800';
  return 'bg-gray-100 text-gray-800';
};

type CommunitySettingsPublic = {
  communityReporterEnabled: boolean;
  allowNewSubmissions: boolean;
  allowMyStoriesPortal: boolean;
  allowJournalistApplications: boolean;
};

type FeatureToggleProps = {
  communityReporterClosed: boolean;
  reporterPortalClosed: boolean;
};

const CommunityReporterMyStoriesPage: React.FC<FeatureToggleProps> = ({ communityReporterClosed, reporterPortalClosed }) => {
  const router = useRouter();
  const [settings, setSettings] = useState<CommunitySettingsPublic | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  // Single source of truth for reporter email
  const [reporterEmail, setReporterEmail] = useState<string | null>(null);
  const [stories, setStories] = useState<CommunityStorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<CommunityStorySummary | null>(null);

  // Fetch public community settings on mount
  useEffect(() => {
    let cancelled = false;
    setSettingsLoading(true);
    setSettingsError(null);
    fetch('/api/public/community/settings', { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data && data.ok === true && data.settings) {
          setSettings({
            communityReporterEnabled: Boolean(data.settings.communityReporterEnabled),
            allowNewSubmissions: Boolean(data.settings.allowNewSubmissions),
            allowMyStoriesPortal: Boolean(data.settings.allowMyStoriesPortal),
            allowJournalistApplications: Boolean(data.settings.allowJournalistApplications),
          });
        } else {
          setSettingsError('SETTINGS_FETCH_FAILED');
        }
      })
      .catch(() => {
        if (!cancelled) setSettingsError('SETTINGS_FETCH_EXCEPTION');
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Resolve reporter email: query ?email, else localStorage np_cr_email, else profile JSON
  useEffect(() => {
    // From query if present
    if (router.isReady) {
      const qEmail = typeof router.query.email === 'string' ? router.query.email.trim() : '';
      if (qEmail) {
        setReporterEmail(qEmail);
        return;
      }
    }
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('np_cr_email');
      if (stored && stored.trim()) {
        setReporterEmail(stored.trim());
        return;
      }
      const profileRaw = window.localStorage.getItem('npCommunityReporterProfile');
      if (profileRaw) {
        try {
          const p = JSON.parse(profileRaw);
          if (p && p.email) setReporterEmail(String(p.email).trim());
        } catch {}
      }
    } catch {}
  }, [router.isReady, router.query.email]);

  const counts = useMemo(() => {
    const total = stories.length;
    const pending = stories.filter(s => ['pending','under_review'].includes((s.status||'').toLowerCase())).length;
    const approved = stories.filter(s => ['approved','published'].includes((s.status||'').toLowerCase())).length;
    const rejected = stories.filter(s => (s.status||'').toLowerCase() === 'rejected').length;
    const withdrawn = stories.filter(s => (s.status||'').toLowerCase() === 'withdrawn').length;
    return { total, pending, approved, rejected, withdrawn };
  }, [stories]);

  const loadStories = async () => {
    const em = (reporterEmail || '').trim();
    setIsLoading(true);
    setError(null);
    try {
      const hasEmail = em && em.includes('@');
      if (!hasEmail) {
        setError("We couldn't find your reporter email. Please submit a new story first.");
        setStories([]);
        setHasLoadedOnce(true);
        return;
      }
      const res = await fetch(`/api/community-reporter/my-stories?email=${encodeURIComponent(em.toLowerCase())}`);
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.ok === true || data?.success === true)) {
        const items = Array.isArray(data?.stories)
          ? data.stories
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data?.stories)
          ? data.data.stories
          : [];
        setStories(items);
        setHasLoadedOnce(true);
        try {
          if (em) window.localStorage.setItem('np_cr_email', em.toLowerCase());
        } catch {}
      } else {
        setError(data?.message || "Couldn't load your stories right now. Please try again later.");
        try { console.error('[my-stories] upstream not ok', { status: res.status, data }); } catch {}
        setStories([]);
        setHasLoadedOnce(true);
      }
    } catch (err) {
      setError("Couldn't load your stories right now. Please try again later.");
      try { console.error('[my-stories] exception while loading', err); } catch {}
      setStories([]);
      setHasLoadedOnce(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async (story: CommunityStorySummary) => {
    try {
      if (typeof window !== 'undefined') {
        const proceed = window.confirm('Are you sure you want to withdraw this story?');
        if (!proceed) return;
      }
      const sid = String(story.id || story.referenceId || '').trim();
      if (!sid) return;
      setLoadingId(sid);
      const reporterId = (typeof window !== 'undefined') ? window.localStorage.getItem('np_communityReporterId') : null;
      const res = await fetch(`/api/community-reporter/${encodeURIComponent(sid)}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ reporterId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.ok === true || data?.success === true)) {
        setToast('Story withdrawn successfully.');
        await loadStories();
      } else {
        setToast('Could not withdraw this story.');
      }
    } catch (err) {
      setToast('Could not withdraw this story.');
    } finally {
      setLoadingId(null);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const canUsePortal = settings ? (settings.communityReporterEnabled && settings.allowMyStoriesPortal) : false;

  // Auto-load on mount when identity exists and portal is enabled
  useEffect(() => {
    if (reporterEmail) loadStories();
    else setHasLoadedOnce(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporterEmail]);

  // Hard-close via feature toggle
  if (communityReporterClosed || reporterPortalClosed) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
        <Head>
          <title>My Community Stories | News Pulse</title>
        </Head>
        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-black mb-3">Community Reporter Portal is temporarily closed</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">Temporarily closed. Please check back soon.</p>
            <a href="/community-reporter" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Back to Community Reporter</a>
          </div>
        </section>
      </div>
    );
  }

  if (settingsLoading && !settings) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text grid place-items-center">
        <p className="text-sm text-gray-700 dark:text-gray-300">Loading settings…</p>
      </div>
    );
  }

  if (settings && (!settings.communityReporterEnabled || !settings.allowMyStoriesPortal)) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
        <Head>
          <title>My Community Stories | News Pulse</title>
        </Head>
        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-black mb-3">My Community Stories is temporarily unavailable</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">My Community Stories is currently unavailable. Please contact News Pulse if you have questions about your submissions.</p>
            <a href="/community-reporter" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Back to Community Reporter</a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
      <Head>
        <title>My Community Stories | News Pulse</title>
        <meta name="description" content="View your submitted community stories on News Pulse." />
      </Head>

      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black mb-1">My Community Stories</h1>
              {reporterEmail && (
                <p className="text-xs text-gray-500">
                  Using Email: <span className="font-medium">{reporterEmail}</span>
                </p>
              )}
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                You can withdraw a story only while it is under review. Once approved or published, withdrawal is handled by the editorial team.
              </p>
            </div>
            <Link href="/community-reporter" className="text-sm px-4 py-2 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-800">+ Submit new story</Link>
          </div>

          {toast && (
            <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
              {toast}
            </div>
          )}

          {isLoading && (
            <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
              Loading your stories…
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
          )}

          {!error && hasLoadedOnce && stories.length === 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
              No stories found for this email yet...
            </div>
          )}

          {stories.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-800">Total: {counts.total}</span>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800">Pending: {counts.pending}</span>
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-800">Approved: {counts.approved}</span>
                <span className="px-3 py-1 rounded-full bg-red-100 text-red-800">Rejected: {counts.rejected}</span>
                <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800">Withdrawn: {counts.withdrawn}</span>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                        <th className="py-3 pr-4">Headline</th>
                        <th className="py-3 pr-4">Category</th>
                        <th className="py-3 pr-4">Location</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Created At</th>
                        <th className="py-3 pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                       {stories.map((s) => {
                          const urgent = String((s as any).priority || (s as any).urgency || '').toLowerCase() === 'high';
                          const dtRaw = s.createdAt || (s.submittedAt || '');
                          const dt = dtRaw ? new Date(dtRaw) : null;
                          const dateStr = dt ? dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
                          return (
                        <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-3 pr-4">
                            <div className="font-medium flex items-center gap-2">
                              <span>{s.headline}</span>
                              {urgent && (
                                <span className="inline-flex items-center text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-red-600 text-white">Urgent</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Ref ID: {s.id || s.referenceId || '-'}</div>
                          </td>
                          <td className="py-3 pr-4">{s.category}</td>
                          <td className="py-3 pr-4">{[s.city, s.state].filter(Boolean).join(', ') || '-'}</td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 rounded-md ${statusColor(s.status)}`}>{s.status}</span>
                          </td>
                          <td className="py-3 pr-4">{dateStr}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setSelectedStory(s)}
                                className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                View
                              </button>
                              {['under_review','pending'].includes((s.status || '').toLowerCase()) && (
                                <button
                                  onClick={() => handleWithdraw(s)}
                                  disabled={loadingId === (s.id || s.referenceId)}
                                  className={`text-xs ${loadingId === (s.id || s.referenceId) ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:underline'}`}
                                >
                                  Withdraw
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                          );
                       })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* View Modal */}
          {selectedStory && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
              onClick={() => setSelectedStory(null)}
            >
              <div
                className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xl font-bold">{selectedStory.headline}</h2>
                  <span className={`ml-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(selectedStory.status)}`}>
                    {selectedStory.status}
                  </span>
                </div>
                <div className="mb-3 text-xs text-gray-600 dark:text-gray-300">
                  <span className="mr-2">Category: <span className="font-medium">{selectedStory.category}</span></span>
                  <span className="mr-2">Location: <span className="font-medium">{[selectedStory.city, selectedStory.state].filter(Boolean).join(', ') || '-'}</span></span>
                  <span>
                    Date: <span className="font-medium">{
                      (() => {
                        const dtRaw = selectedStory.createdAt || selectedStory.submittedAt || ''
                        const dt = dtRaw ? new Date(dtRaw) : null
                        return dt ? dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
                      })()
                    }</span>
                  </span>
                </div>
                <div className="whitespace-pre-wrap rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-800 dark:text-gray-100">
                  {(() => {
                    const s: any = selectedStory || {}
                    const body = s.body || s.text || s.story || s.content || s.details || s.description || s.bodyText || s.fullText
                    return body ? String(body) : selectedStory.headline
                  })()}
                </div>
                <div className="mt-4 text-right">
                  <button
                    type="button"
                    className="text-sm px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => setSelectedStory(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <a href="/community-reporter" className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600">Back to Community Reporter</a>
            <Link href="/community-reporter" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white">Submit new story</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CommunityReporterMyStoriesPage;

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = async () => {
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
  let communityReporterClosed = false;
  let reporterPortalClosed = false;
  try {
    const resp = await fetch(`${base}/api/public/feature-toggles`, { headers: { Accept: 'application/json' } });
    const data = await resp.json().catch(() => null as any);
    if (resp.ok && data) {
      communityReporterClosed = Boolean(data.communityReporterClosed);
      reporterPortalClosed = Boolean(data.reporterPortalClosed);
    }
  } catch {}
  return { props: { communityReporterClosed, reporterPortalClosed } };
};
