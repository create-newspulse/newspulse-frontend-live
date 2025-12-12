import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';

type StoryStatus = 'pending' | 'approved' | 'rejected';

type ReporterStory = {
  id: string;
  headline: string;
  category: string;
  city?: string;
  state?: string;
  status: StoryStatus;
  createdAt: string;
};

// const SAMPLE_STORIES: ReporterStory[] = [
//   {
//     id: 'NP-CR-2025-0001',
//     headline: 'Sample campus cleanliness drive report',
//     category: 'Youth / Campus',
//     city: 'Ahmedabad',
//     state: 'Gujarat',
//     status: 'pending',
//     createdAt: '2025-11-26T10:30:00Z',
//   },
//   {
//     id: 'NP-CR-2025-0002',
//     headline: 'Waterlogging issue near railway colony',
//     category: 'Civic Issue',
//     city: 'Delhi',
//     state: 'Delhi',
//     status: 'approved',
//     createdAt: '2025-11-25T09:15:00Z',
//   },
// ];

// Use Next.js API proxy to avoid CSP and CORS issues
const PROXY_BASE = '/api';

function statusBadge(status: StoryStatus) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'approved':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

type FeatureToggleProps = {
  communityReporterClosed: boolean;
  reporterPortalClosed: boolean;
};

const MyCommunityStoriesPage: React.FC<FeatureToggleProps> = ({ communityReporterClosed, reporterPortalClosed }) => {
  const router = useRouter();
  const [stories, setStories] = useState<ReporterStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporterEmail, setReporterEmail] = useState<string | null>(null);
  const [submittedFlag, setSubmittedFlag] = useState<boolean>(false);

  // later we’ll use this email to fetch real stories
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Prefer the new identity key saved after submission
    const savedEmail = window.localStorage.getItem('np_cr_email');
    if (savedEmail && savedEmail.trim()) {
      setReporterEmail(savedEmail.trim());
    } else {
      // Fallback to older stored profile if present
      const raw = window.localStorage.getItem('npCommunityReporterProfile');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.email) setReporterEmail(String(parsed.email).trim());
        } catch {}
      }
    }
  }, []);

  // Detect success flag from query
  useEffect(() => {
    const q = router.query?.submitted;
    const val = Array.isArray(q) ? q[0] : q;
    setSubmittedFlag(val === '1');
  }, [router.query]);

  // Fetch stories when reporterEmail becomes available
  useEffect(() => {
    const fetchStories = async () => {
      if (!reporterEmail) return;
      setLoading(true);
      setError(null);
      try {
        const url = `${PROXY_BASE}/community-reporter/my-stories?email=${encodeURIComponent(reporterEmail)}`;
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[my-stories] requesting', url);
        }
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[my-stories] status', res.status);
        }
        let data: any = null;
        try { data = await res.json(); } catch (parseErr) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[my-stories] failed to parse JSON');
          }
        }
        if (res.ok && data?.success === true) {
          setStories(Array.isArray(data?.data?.stories) ? data.data.stories : []);
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[my-stories] stories count', Array.isArray(data?.data?.stories) ? data.data.stories.length : 0);
          }
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[my-stories] error body', data);
          }
          setError('Could not load your stories');
          setStories([]);
        }
      } catch (err: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[my-stories] request failed', err?.message);
        }
        setError('Could not load your stories');
        setStories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, [reporterEmail]);

  // Closed state if reporter portal or entire program is closed
  if (communityReporterClosed || reporterPortalClosed) {
    return (
      <div className="min-h-screen bg-white text-black">
        <Head>
          <title>Community Reporter Portal – Temporarily Closed | News Pulse</title>
        </Head>
        <main className="max-w-4xl mx-auto px-4 py-16">
          <h1 className="text-3xl font-black mb-4">Community Reporter Portal</h1>
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <p className="text-lg text-gray-700">Temporarily closed. Please check back soon.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <Head>
        <title>My Community Stories | News Pulse</title>
      </Head>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black mb-1">My Community Stories</h1>
            <p className="text-sm text-gray-600">
              Track what you&apos;ve submitted to News Pulse – status, basic
              details, and next steps.
            </p>
            {reporterEmail && (
              <p className="mt-1 text-xs text-gray-500">
                Showing stories for:{' '}
                <span className="font-medium">{reporterEmail}</span>
              </p>
            )}
          </div>

          <Link
            href="/community-reporter"
            className="text-sm px-4 py-2 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            + Submit new story
          </Link>
        </div>

        {/* Success banner on redirect after submission */}
        {submittedFlag && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            ✅ Your story is submitted for review. You can track its status below.
          </div>
        )}

        {/* Inline load/error indicators */}
        {loading && (
          <p className="text-sm text-gray-600 mb-3">Loading your stories…</p>
        )}
        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        {stories.length === 0 && !loading && !error ? (
          <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center text-gray-600">
            <p className="font-medium">
              You haven&apos;t submitted any community stories yet.
            </p>
            <p className="mt-2 text-sm">
              Once you submit, they will appear here with their review status.
            </p>
            <div className="mt-4">
              <Link
                href="/community-reporter"
                className="inline-flex items-center px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Submit your first story
              </Link>
            </div>
          </div>
        ) : (!loading && !error && stories.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Headline</th>
                  <th className="px-4 py-3 text-left font-semibold">Category</th>
                  <th className="px-4 py-3 text-left font-semibold">Location</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Created</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stories.map((story) => (
                  <tr key={story.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium">{story.headline}</div>
                      <div className="text-xs text-gray-500">Ref ID: {story.id}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="text-xs bg-gray-100 rounded-full px-2 py-1">
                        {story.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-gray-600">
                      {story.city || '-'}
                      {story.state ? `, ${story.state}` : ''}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={
                          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ' +
                          statusBadge(story.status)
                        }
                      >
                        {story.status === 'pending'
                          ? 'Under review'
                          : story.status === 'approved'
                          ? 'Approved'
                          : 'Rejected'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-gray-500">
                      {new Intl.DateTimeFormat('en-GB', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(story.createdAt))}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <button
                        type="button"
                        className="text-xs px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null)}
      </main>
    </div>
  );
};

export default MyCommunityStoriesPage;

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
