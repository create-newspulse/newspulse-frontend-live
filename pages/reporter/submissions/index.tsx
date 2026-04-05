import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import ReporterPortalLayout from '../../../components/reporter-portal/ReporterPortalLayout';
import { PortalRouteState } from '../../../components/reporter-portal/PortalRouteState';
import { useCommunityStories } from '../../../hooks/useCommunityStories';
import { usePublicFounderToggles } from '../../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../../hooks/useReporterPortalSession';
import { formatSubmissionDate, getStoryIdentity, getStoryStatusKey } from '../../../lib/reporterPortal';
import { getReporterPortalPageServerProps } from '../../../lib/reporterPortalPage';
import type { FeatureToggleProps } from '../../../types/community-reporter';

export default function ReporterSubmissionsPage({ communityReporterClosed, reporterPortalClosed }: FeatureToggleProps) {
  const router = useRouter();
  const { toggles } = usePublicFounderToggles({ communityReporterClosed, reporterPortalClosed, updatedAt: null });
  const { session, isReady, logout, reason } = useReporterPortalSession({ reportUnauthorizedReason: true });
  const { settings, settingsLoading, stories, isLoading, error, errorStatus, hasLoadedOnce } = useCommunityStories({ reporterEmail: session?.email, reporterAuth: true });
  const hasSessionIssue = errorStatus === 401 || errorStatus === 403;

  if (toggles.communityReporterClosed || toggles.reporterPortalClosed) {
    return <ReporterPortalLayout title="My Submissions" description="Reporter submissions are blocked by toggle." active="submissions"><PortalRouteState title="Reporter Portal is closed" description="The Reporter Portal toggle is off, so submission tracking routes are blocked." actionHref="/community-reporter" actionLabel="Back to Community Reporter" /></ReporterPortalLayout>;
  }

  if (!isReady) {
    return <ReporterPortalLayout title="My Submissions" description="Loading session." active="submissions"><div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading reporter session…</div></ReporterPortalLayout>;
  }

  if (!session?.email) {
    return <ReporterPortalLayout title="My Submissions" description="A reporter login is required." active="submissions"><PortalRouteState title={reason === 'SESSION_EXPIRED' ? 'Session expired' : 'Login required'} description={reason === 'SESSION_EXPIRED' ? 'Your verified reporter session expired. Sign in again to keep tracking your submissions.' : 'Sign in with your reporter email to track submissions and open story details.'} actionHref="/reporter/login" actionLabel="Login to Reporter Portal" /></ReporterPortalLayout>;
  }

  if (!settingsLoading && settings && (!settings.communityReporterEnabled || !settings.allowMyStoriesPortal)) {
    return <ReporterPortalLayout title="My Submissions" description="Portal settings are disabled." active="submissions" session={session} onLogout={() => { void logout().finally(() => router.push('/reporter/login').catch(() => {})); }}><PortalRouteState title="Reporter Portal is unavailable" description="Public settings currently disable submission tracking in the Reporter Portal." actionHref="/community-reporter" actionLabel="Back to Community Reporter" /></ReporterPortalLayout>;
  }

  return (
    <ReporterPortalLayout title="My Submissions" description="Track submission status, category, date, and open detail views for individual community reporter records." active="submissions" session={session} onLogout={() => { void logout().finally(() => router.push('/reporter/login').catch(() => {})); }}>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">Submission Records</h2>
            <p className="mt-1 text-sm text-slate-600">Each row is sourced from the existing community reporter submission history for {session.email}.</p>
          </div>
          <Link href="/reporter/submit" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Submit a Story</Link>
        </div>

        {!hasLoadedOnce || (isLoading && stories.length === 0) ? <div className="mt-6 text-sm text-slate-600">Loading submissions…</div> : null}
        {hasLoadedOnce && !isLoading && error ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">{hasSessionIssue ? 'Your reporter session could not be confirmed for submission records. Sign in again and retry.' : 'Submission records are temporarily unavailable for this verified reporter email. Please try again shortly.'}</div> : null}
        {hasLoadedOnce && !isLoading && !error && stories.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">No submissions yet.</div> : null}

        {!error && stories.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3 pr-4 font-semibold">Title</th>
                  <th className="py-3 pr-4 font-semibold">Category / Track</th>
                  <th className="py-3 pr-4 font-semibold">Submitted</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {stories.map((story) => (
                  <tr key={getStoryIdentity(story) || story.headline} className="border-b border-slate-100 align-top">
                    <td className="py-4 pr-4"><div className="font-semibold text-slate-950">{story.headline}</div></td>
                    <td className="py-4 pr-4 text-slate-700">{story.category}</td>
                    <td className="py-4 pr-4 text-slate-700">{formatSubmissionDate(story.submittedAt || story.createdAt)}</td>
                    <td className="py-4 pr-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">{getStoryStatusKey(story.status).replace(/_/g, ' ')}</span></td>
                    <td className="py-4"><Link href={`/reporter/submissions/${encodeURIComponent(getStoryIdentity(story))}`} className="text-sm font-semibold text-blue-700 hover:underline">View details</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </ReporterPortalLayout>
  );
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = getReporterPortalPageServerProps;