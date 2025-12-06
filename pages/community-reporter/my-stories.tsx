import Head from 'next/head';
import React, { useEffect, useMemo, useState } from 'react';
import { useCommunityReporterConfig } from '../../src/hooks/useCommunityReporterConfig';

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
  if (k === 'pending' || k === 'under_review') return 'bg-blue-100 text-blue-800';
  if (k === 'approved' || k === 'published') return 'bg-green-100 text-green-800';
  if (k === 'rejected') return 'bg-red-100 text-red-800';
  if (k === 'withdrawn') return 'bg-orange-100 text-orange-800';
  return 'bg-gray-100 text-gray-800';
};

const CommunityReporterMyStoriesPage: React.FC = () => {
  const { config, isLoading: cfgLoading, error: cfgError } = useCommunityReporterConfig();
  const enabled = config?.communityMyStoriesEnabled ?? true;
  const [email, setEmail] = useState('');
  const [stories, setStories] = useState<CommunityStorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('np.communityReporter.email');
      if (saved) setEmail(saved);
    } catch {}
  }, []);

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
    if (!em || !em.includes('@')) {
      setError('Please enter a valid email address.');
      setStories([]);
      setHasLoadedOnce(true);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/community-reporter/my-stories?email=${encodeURIComponent(em)}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.ok) {
        setStories(Array.isArray(data.stories) ? data.stories : []);
        setHasLoadedOnce(true);
        try { window.localStorage.setItem('np.communityReporter.email', em); } catch {}
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

  if (cfgLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text grid place-items-center">
        <p className="text-sm text-gray-700 dark:text-gray-300">Loading settings…</p>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text">
        <Head>
          <title>My Community Stories | News Pulse</title>
        </Head>
        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-black mb-3">My Community Stories is temporarily unavailable</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">This reporter tool is currently turned off by News Pulse. Please try again later or contact the newsroom if you need help about a submission.</p>
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
          <h1 className="text-3xl font-black mb-2">My Community Stories</h1>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">Enter the same email address you used while submitting stories to see their status.</p>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
              <div className="flex-1 w-full">
                <label htmlFor="email" className="block text-sm font-medium mb-1">Email address</label>
                <input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2" placeholder="you@example.com" />
              </div>
              <button onClick={loadStories} disabled={isLoading} className={`px-5 py-2 rounded-lg font-semibold ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>{isLoading ? 'Loading…' : 'View My Stories'}</button>
            </div>
            {error && (
              <div className="mt-4 rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
            )}
          </div>

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
                        <th className="py-3 pr-4">Reference ID</th>
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
                          <td className="py-3 pr-4">{s.referenceId || '-'}</td>
                          <td className="py-3 pr-4">{s.headline}</td>
                          <td className="py-3 pr-4">{s.category}</td>
                          <td className="py-3 pr-4">{[s.city, s.state].filter(Boolean).join(', ') || '-'}</td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 rounded-md ${statusColor(s.status)}`}>{s.status}</span>
                          </td>
                          <td className="py-3 pr-4">{new Date(s.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 pr-4">
                            <button className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white">View</button>
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
