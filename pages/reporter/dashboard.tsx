import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import ReporterPortalLayout from '../../components/reporter-portal/ReporterPortalLayout';
import { PortalRouteState } from '../../components/reporter-portal/PortalRouteState';
import { useCommunityStories } from '../../hooks/useCommunityStories';
import { usePublicFounderToggles } from '../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { getRecentStories, formatSubmissionDate, getStoryIdentity, getStoryStatusKey } from '../../lib/reporterPortal';
import { getReporterPortalPageServerProps } from '../../lib/reporterPortalPage';
import type { FeatureToggleProps } from '../../types/community-reporter';

export default function ReporterDashboardPage({ communityReporterClosed, reporterPortalClosed }: FeatureToggleProps) {
  const router = useRouter();
  const { toggles } = usePublicFounderToggles({ communityReporterClosed, reporterPortalClosed, updatedAt: null });
  const { session, isReady, logout, reason } = useReporterPortalSession();
  const { settings, settingsLoading, stories, counts, isLoading } = useCommunityStories({ reporterEmail: session?.email });

  if (toggles.communityReporterClosed || toggles.reporterPortalClosed) {
    return <ReporterPortalLayout title="Reporter Dashboard" description="Reporter Portal access is blocked by toggle." active="dashboard"><PortalRouteState title="Reporter Portal is closed" description="The Reporter Portal toggle is off, so dashboard access is blocked." actionHref="/community-reporter" actionLabel="Back to Community Reporter" /></ReporterPortalLayout>;
  }

  if (!isReady) {
    return <ReporterPortalLayout title="Reporter Dashboard" description="Loading session." active="dashboard"><div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading reporter session…</div></ReporterPortalLayout>;
  }

  if (!session?.email) {
    return <ReporterPortalLayout title="Reporter Dashboard" description="A reporter login is required." active="dashboard"><PortalRouteState title={reason === 'SESSION_EXPIRED' ? 'Session expired' : 'Login required'} description={reason === 'SESSION_EXPIRED' ? 'Your verified reporter session expired. Sign in again with email verification to reopen the portal.' : 'Sign in with the reporter email used for your community reporter submissions to view your dashboard.'} actionHref="/reporter/login" actionLabel="Login to Reporter Portal" /></ReporterPortalLayout>;
  }

  if (!settingsLoading && settings && (!settings.communityReporterEnabled || !settings.allowMyStoriesPortal)) {
    return <ReporterPortalLayout title="Reporter Dashboard" description="Portal settings are disabled." active="dashboard" session={session} onLogout={() => { void logout().finally(() => router.push('/reporter/login').catch(() => {})); }}><PortalRouteState title="Reporter Portal is unavailable" description="Public settings currently disable the reporter portal, so dashboard access is blocked." actionHref="/community-reporter" actionLabel="Back to Community Reporter" /></ReporterPortalLayout>;
  }

  const recentStories = getRecentStories(stories, 5);

  return (
    <ReporterPortalLayout title="Reporter Dashboard" description="Track your community reporter activity, submission outcomes, and recent editorial movement." active="dashboard" session={session} onLogout={() => { void logout().finally(() => router.push('/reporter/login').catch(() => {})); }}>
      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Total</div><div className="mt-3 text-3xl font-black text-slate-950">{counts.total}</div></div>
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Pending Review</div><div className="mt-3 text-3xl font-black text-blue-900">{counts.pending}</div></div>
        <div className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">Approved</div><div className="mt-3 text-3xl font-black text-green-900">{counts.approved}</div></div>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">Rejected</div><div className="mt-3 text-3xl font-black text-red-900">{counts.rejected}</div></div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Published</div><div className="mt-3 text-3xl font-black text-emerald-900">{counts.published}</div></div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">Recent Submission Activity</h2>
              <p className="mt-1 text-sm text-slate-600">Your latest community reporter records from the existing News Pulse submission system.</p>
            </div>
            <Link href="/reporter/submissions" className="text-sm font-semibold text-blue-700 hover:underline">View all submissions</Link>
          </div>

          {isLoading && stories.length === 0 ? <div className="mt-4 text-sm text-slate-600">Loading submission activity…</div> : null}
          {!isLoading && recentStories.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">No submissions yet. Use the Reporter Portal to send your first story.</div> : null}

          <div className="mt-4 space-y-3">
            {recentStories.map((story) => (
              <div key={getStoryIdentity(story) || story.headline} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{story.headline}</div>
                    <div className="mt-1 text-sm text-slate-600">{story.category} · {formatSubmissionDate(story.submittedAt || story.createdAt)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">{getStoryStatusKey(story.status).replace(/_/g, ' ')}</span>
                    <Link href={`/reporter/submissions/${encodeURIComponent(getStoryIdentity(story))}`} className="text-sm font-semibold text-blue-700 hover:underline">View details</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Quick Actions</h2>
          <div className="mt-4 grid gap-3">
            <Link href="/reporter/submit" className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">Submit a Story</Link>
            <Link href="/reporter/submissions" className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">Track My Submissions</Link>
            <Link href="/reporter/profile" className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">Manage Reporter Profile</Link>
          </div>
        </section>
      </div>
    </ReporterPortalLayout>
  );
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = getReporterPortalPageServerProps;