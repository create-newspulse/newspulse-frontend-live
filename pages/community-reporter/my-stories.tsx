import Head from 'next/head';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

type CommunityStorySummary = {
  id: string;
  referenceId?: string;
  headline: string;
  category: string;
  city?: string;
  state?: string;
  status: string;
  createdAt: string;
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

const CommunityReporterMyStoriesPage: React.FC = () => {
  const router = useRouter();
  const [settings, setSettings] = useState<CommunitySettingsPublic | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [reporterId, setReporterId] = useState<string | null>(null);
  const [stories, setStories] = useState<CommunityStorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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

  useEffect(() => {
    try {
      const newEmail = window.localStorage.getItem('np_communityReporterEmail');
      const newId = window.localStorage.getItem('np_communityReporterId');
      // Backward compatibility
      const oldEmail = window.localStorage.getItem('np.communityReporter.email');
      const oldId = window.localStorage.getItem('npReporterId');
      const useEmail = newEmail || oldEmail || '';
      const useId = newId || oldId || '';
      if (useEmail) setEmail(useEmail);
      if (useId) setReporterId(useId);
    } catch {}
  }, []);

  useEffect(() => {
    if (router.isReady) {
      const qRep = typeof router.query.reporterId === 'string' ? router.query.reporterId : null;
      if (qRep) setReporterId(qRep);
    }
  }, [router.isReady, router.query]);

  const counts = useMemo(() => {
    const total = stories.length;
    const pending = stories.filter(s => ['pending','under_review'].includes((s.status||'').toLowerCase())).length;
    const approved = stories.filter(s => ['approved','published'].includes((s.status||'').toLowerCase())).length;
    const rejected = stories.filter(s => (s.status||'').toLowerCase() === 'rejected').length;
    const withdrawn = stories.filter(s => (s.status||'').toLowerCase() === 'withdrawn').length;
    return { total, pending, approved, rejected, withdrawn };
  }, [stories]);

  const loadStories = async () => {
    const em = email.trim();
    setIsLoading(true);
    setError(null);
    try {
      const hasId = reporterId && reporterId.trim();
      const hasEmail = em && em.includes('@');
      if (!hasId && !hasEmail) {
        setError("We couldn't find your reporter profile. Please submit a new story first.");
        setStories([]);
        setHasLoadedOnce(true);
        return;
      }
      const qs = hasId ? `reporterId=${encodeURIComponent(String(reporterId))}` : `email=${encodeURIComponent(em)}`;
      const res = await fetch(`/api/community-reporter/my-stories?${qs}`);
      const data = await res.json().catch(() => null);
      if (res.ok && (data?.ok === true || data?.success === true)) {
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.stories)
          ? data.stories
          : Array.isArray(data?.data?.stories)
          ? data.data.stories
          : [];
        setStories(items);
        setHasLoadedOnce(true);
        try {
          if (em) window.localStorage.setItem('np_communityReporterEmail', em);
          if (reporterId) window.localStorage.setItem('np_communityReporterId', reporterId);
        } catch {}
      } else {
        setError(data?.message || 'Could not load your stories right now.');
        setStories([]);
        setHasLoadedOnce(true);
      }
    } catch (err) {
      setError('Could not load your stories right now.');
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
    // Only trigger after first identity read
    if (canUsePortal && (email || reporterId)) loadStories();
    else setHasLoadedOnce(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, reporterId, canUsePortal]);

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
              {(email || reporterId) && (
                <p className="text-xs text-gray-500">
                  Using {reporterId ? 'Reporter ID' : 'Email'}:{' '}
                  <span className="font-medium">{reporterId || email}</span>
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

          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
          )}

          {!error && hasLoadedOnce && stories.length === 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
              No stories found for this email yet. Submit a story first, or check the email you entered.
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
                       {stories.map((s) => (
                        <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-3 pr-4">
                            <div className="font-medium">{s.headline}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Ref ID: {s.id || s.referenceId || '-'}</div>
                          </td>
                          <td className="py-3 pr-4">{s.category}</td>
                          <td className="py-3 pr-4">{[s.city, s.state].filter(Boolean).join(', ') || '-'}</td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 rounded-md ${statusColor(s.status)}`}>{s.status}</span>
                          </td>
                          <td className="py-3 pr-4">{new Date(s.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <button className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white">View</button>
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
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <a href="/community-reporter" className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600">Back to Community Reporter</a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CommunityReporterMyStoriesPage;
