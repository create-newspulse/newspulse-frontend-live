// v1 Reporter Portal: summary bar, status filter, view modal
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
  // Optional fields that may come from backend; keeping types strict
  referenceId?: string;
  reviewNote?: string;
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

type StoryStatusBucket = 'under-review' | 'published' | 'rejected';

function mapStoryStatus(raw?: string): {
  label: string;
  bucket: StoryStatusBucket;
  badgeClass: string;
} {
  const s = (raw || '').toLowerCase();
  if (s === 'approved' || s === 'published') {
    return { label: 'Published', bucket: 'published', badgeClass: 'bg-green-100 text-green-800' };
  }
  if (s === 'rejected') {
    return { label: 'Rejected', bucket: 'rejected', badgeClass: 'bg-red-100 text-red-800' };
  }
  return { label: 'Under review', bucket: 'under-review', badgeClass: 'bg-yellow-100 text-yellow-800' };
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'under-review' | 'published' | 'rejected'>('all');
  const [selectedStory, setSelectedStory] = useState<ReporterStory | null>(null);

  // Resolve reporter email: prefer query param, then localStorage fallbacks
  useEffect(() => {
    const qEmail = typeof router.query?.email === 'string' ? router.query.email.trim() : '';
    if (qEmail) {
      setReporterEmail(qEmail);
      return;
    }
    if (typeof window === 'undefined') return;
    // Prefer the new identity key saved after submission
    const savedEmail = window.localStorage.getItem('np_cr_email') || window.localStorage.getItem('np_communityReporterEmail');
    if (savedEmail && savedEmail.trim()) {
      setReporterEmail(savedEmail.trim());
      return;
    }
    // Fallback to older stored profile if present
    const raw = window.localStorage.getItem('npCommunityReporterProfile');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.email) setReporterEmail(String(parsed.email).trim());
      } catch {}
    }
  }, [router.query?.email]);

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
      const normalized = reporterEmail.trim().toLowerCase();
      setLoading(true);
      setError(null);
      console.log('[MyStories] loading for email', normalized);
      try {
        const url = `${PROXY_BASE}/community-reporter/my-stories?email=${encodeURIComponent(normalized)}`;
        const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        let data: unknown = null;
        try { data = await res.json(); } catch {}
        if (res.ok && data && typeof data === 'object' && (data as any).ok === true) {
          const incoming = (data as any).stories ?? (data as any).data?.stories ?? [];
          setStories(Array.isArray(incoming) ? incoming : []);
        } else {
          setError('Could not load your stories');
          setStories([]);
        }
      } catch {
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
                <span className="font-medium">{reporterEmail.trim().toLowerCase()}</span>
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
          <>
            {/* Summary bar */}
            {(() => {
              const totals = stories.reduce(
                (acc, st) => {
                  const b = mapStoryStatus(st.status).bucket;
                  acc.total += 1;
                  if (b === 'published') acc.published += 1;
                  else if (b === 'rejected') acc.rejected += 1;
                  else acc.underReview += 1;
                  return acc;
                },
                { total: 0, published: 0, rejected: 0, underReview: 0 }
              );
              return (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">Stories submitted:</span> {totals.total} {' | '}
                    <span className="font-medium">Published:</span> {totals.published} {' | '}
                    <span className="font-medium">Rejected:</span> {totals.rejected}
                  </div>
                  {/* Filter control */}
                  <div className="text-sm">
                    <label className="mr-2 text-gray-600">Filter by status:</label>
                    <select
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as 'all' | 'under-review' | 'published' | 'rejected')}
                    >
                      <option value="all">All</option>
                      <option value="under-review">Under review</option>
                      <option value="published">Published</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              );
            })()}

            {(() => {
              const filteredStories = stories.filter((st) => {
                if (statusFilter === 'all') return true;
                return mapStoryStatus(st.status).bucket === statusFilter;
              });
              return (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Ref ID</th>
                        <th className="px-4 py-3 text-left font-semibold">Headline</th>
                        <th className="px-4 py-3 text-left font-semibold">Category</th>
                        <th className="px-4 py-3 text-left font-semibold">City</th>
                        <th className="px-4 py-3 text-left font-semibold">Date</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStories.map((story) => {
                        const m = mapStoryStatus(story.status);
                        const ref = story.referenceId || story.id;
                        return (
                          <tr key={story.id} className="border-t border-gray-100">
                            <td className="px-4 py-3 align-top text-xs text-gray-600">{ref}</td>
                            <td className="px-4 py-3 align-top">
                              <div className="font-medium">{story.headline}</div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span className="text-xs bg-gray-100 rounded-full px-2 py-1">{story.category}</span>
                            </td>
                            <td className="px-4 py-3 align-top text-xs text-gray-600">{story.city || '-'}</td>
                            <td className="px-4 py-3 align-top text-xs text-gray-500">
                              {new Intl.DateTimeFormat('en-GB', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                timeZone: 'UTC',
                              }).format(new Date(story.createdAt))}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span className={"inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium " + m.badgeClass}>{m.label}</span>
                            </td>
                            <td className="px-4 py-3 align-top text-right">
                              <button
                                type="button"
                                className="text-xs px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-50"
                                onClick={() => setSelectedStory(story)}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Reporter details link + safety note */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-gray-600">
              <button
                type="button"
                className="inline-flex items-center px-3 py-1 rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50"
                onClick={() => {
                  const email = reporterEmail || '';
                  router.push(`/community-reporter?email=${encodeURIComponent(email)}`);
                }}
              >
                Update my reporter details
              </button>
              <div className="text-gray-500">
                If a story is published and you want it changed or removed, contact the News Pulse editorial team.
              </div>
            </div>

            {/* Modal */}
            {selectedStory && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                onClick={() => setSelectedStory(null)}
              >
                <div
                  className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-xl font-bold">{selectedStory.headline}</h2>
                    {(() => {
                      const m = mapStoryStatus(selectedStory.status);
                      return <span className={"ml-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium " + m.badgeClass}>{m.label}</span>;
                    })()}
                  </div>
                  <div className="mb-3 text-xs text-gray-600">
                    <span className="mr-2">Category: <span className="font-medium">{selectedStory.category}</span></span>
                    <span className="mr-2">City: <span className="font-medium">{selectedStory.city || '-'}</span></span>
                    <span>
                      Date: <span className="font-medium">{new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(selectedStory.createdAt))}</span>
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                    {(() => {
                      const s: any = selectedStory || {};
                      const content = s.body || s.text || s.story || s.content || s.details || s.description || s.bodyText || s.fullText || '';
                      return content ? content : selectedStory.headline;
                    })()}
                  </div>
                  {selectedStory.reviewNote ? (
                    <div className="mt-3 text-sm">
                      <div className="mb-1 font-medium">Editor note (if any)</div>
                      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-gray-800">{selectedStory.reviewNote}</div>
                    </div>
                  ) : null}
                  <div className="mt-4 text-right">
                    <button
                      type="button"
                      className="text-sm px-4 py-2 rounded-full border border-gray-300 hover:bg-gray-50"
                      onClick={() => setSelectedStory(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
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
