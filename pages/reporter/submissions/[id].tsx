import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import ReporterPortalLayout from '../../../components/reporter-portal/ReporterPortalLayout';
import { PortalRouteState } from '../../../components/reporter-portal/PortalRouteState';
import { useCommunityStories } from '../../../hooks/useCommunityStories';
import { usePublicFounderToggles } from '../../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../../hooks/useReporterPortalSession';
import { canEditStory, formatSubmissionDate, getStoryBody, getStoryIdentity, getStoryLocation, getStoryNotes, getStoryStatusKey } from '../../../lib/reporterPortal';
import { getReporterPortalPageServerProps } from '../../../lib/reporterPortalPage';
import type { FeatureToggleProps } from '../../../types/community-reporter';

export default function ReporterSubmissionDetailPage({ communityReporterClosed, reporterPortalClosed }: FeatureToggleProps) {
  const router = useRouter();
  const { toggles } = usePublicFounderToggles({ communityReporterClosed, reporterPortalClosed, updatedAt: null });
  const { session, profile, isReady, logout, reason } = useReporterPortalSession({ reportUnauthorizedReason: true });
  const { settings, settingsLoading, stories, isLoading, error, errorStatus, hasLoadedOnce, reporterProfile } = useCommunityStories({ reporterEmail: session?.email, reporterAuth: true });
  const storyId = String(router.query.id || '').trim();
  const story = stories.find((item) => getStoryIdentity(item) === storyId) || null;
  const notes = getStoryNotes(story);
  const portalProfile = reporterProfile || profile;

  if (toggles.communityReporterClosed || toggles.reporterPortalClosed) {
    return <ReporterPortalLayout title="Submission Detail" description="Reporter submission detail is blocked by toggle." active="submissions"><PortalRouteState title="Reporter Portal is closed" description="The Reporter Portal toggle is off, so submission details are blocked." actionHref="/community-reporter" actionLabel="Back to Community Reporter" /></ReporterPortalLayout>;
  }

  if (!isReady) {
    return <ReporterPortalLayout title="Submission Detail" description="Loading session." active="submissions"><div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading reporter session…</div></ReporterPortalLayout>;
  }

  if (!session?.email) {
    return <ReporterPortalLayout title="Submission Detail" description="A reporter login is required." active="submissions"><PortalRouteState title={reason === 'SESSION_EXPIRED' ? 'Session expired' : 'Login required'} description={reason === 'SESSION_EXPIRED' ? 'Your verified reporter session expired. Sign in again to reopen submission details.' : 'Sign in to open a submission detail page.'} actionHref="/reporter/login" actionLabel="Login to Reporter Portal" /></ReporterPortalLayout>;
  }

  if (hasLoadedOnce && !isLoading && (errorStatus === 401 || errorStatus === 403)) {
    return <ReporterPortalLayout title="Submission Detail" description="Reporter authentication could not be confirmed for this submission record." active="submissions"><PortalRouteState title="Session expired" description="Your reporter session could not be confirmed for this submission record. Sign in again and retry." actionHref="/reporter/login" actionLabel="Login to Reporter Portal" /></ReporterPortalLayout>;
  }

  if (!settingsLoading && settings && (!settings.communityReporterEnabled || !settings.allowMyStoriesPortal)) {
    return <ReporterPortalLayout title="Submission Detail" description="Portal settings are disabled." active="submissions" session={session} profile={portalProfile} onLogout={() => { void logout().finally(() => router.push('/reporter/login').catch(() => {})); }}><PortalRouteState title="Reporter Portal is unavailable" description="Public settings currently disable submission detail views in the Reporter Portal." actionHref="/community-reporter" actionLabel="Back to Community Reporter" /></ReporterPortalLayout>;
  }

  if (hasLoadedOnce && !isLoading && error) {
    const isSessionIssue = errorStatus === 401 || errorStatus === 403;
    return <ReporterPortalLayout title="Submission Detail" description={isSessionIssue ? 'Reporter session issue.' : 'Submission records are temporarily unavailable.'} active="submissions" session={session} profile={portalProfile} onLogout={() => { void logout().finally(() => router.push('/reporter/login').catch(() => {})); }}>{isSessionIssue ? <PortalRouteState title="Session issue" description="Your reporter session could not be confirmed for this submission record. Sign in again and retry." actionHref="/reporter/login" actionLabel="Login to Reporter Portal" /> : <PortalRouteState title="Submission records unavailable" description="The Reporter Portal could not load submission records for this verified reporter email. Please try again shortly." actionHref="/reporter/submissions" actionLabel="Back to Submissions" />}</ReporterPortalLayout>;
  }

  if (hasLoadedOnce && !isLoading && !story) {
    return <ReporterPortalLayout title="Submission Detail" description="Submission record not found." active="submissions" session={session} profile={portalProfile} onLogout={() => { void logout().finally(() => router.push('/reporter/login').catch(() => {})); }}><PortalRouteState title="Submission not found" description="This submission record could not be matched against the existing community reporter history for your verified email." actionHref="/reporter/submissions" actionLabel="Back to Submissions" /></ReporterPortalLayout>;
  }

  return (
    <ReporterPortalLayout title="Submission Detail" description="Review submitted content, current status, editorial notes, and edit eligibility for an individual submission." active="submissions" session={session} profile={portalProfile} onLogout={() => { void logout().finally(() => router.push('/reporter/login').catch(() => {})); }}>
      {story ? (
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{story.headline}</h2>
                <p className="mt-2 text-sm text-slate-600">{story.category} · {formatSubmissionDate(story.submittedAt || story.createdAt)} · {getStoryLocation(story)}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">{getStoryStatusKey(story.status).replace(/_/g, ' ')}</span>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800 whitespace-pre-wrap">
              {getStoryBody(story) || 'No submission body was returned by the API for this story.'}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Notes and Editorial Context</h3>
            {notes.length > 0 ? (
              <div className="mt-4 space-y-3">
                {notes.map((note) => (
                  <div key={note} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{note}</div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No editorial notes are currently attached to this submission.</p>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-black text-slate-950">Edit Access</h3>
            {canEditStory(story) ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-600">This submission is still editable under the current status rules.</p>
                <Link href={`/reporter/submit?draft=${encodeURIComponent(getStoryIdentity(story))}`} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Edit submission</Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">Editing is only allowed for draft submissions. Under-review, approved, rejected, and published items remain read-only in this MVP.</p>
            )}
          </section>

          <div><Link href="/reporter/submissions" className="text-sm font-semibold text-blue-700 hover:underline">Back to all submissions</Link></div>
        </div>
      ) : <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading submission detail…</div>}
    </ReporterPortalLayout>
  );
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = getReporterPortalPageServerProps;