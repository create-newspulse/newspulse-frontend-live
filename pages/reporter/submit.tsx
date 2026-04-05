import { useRouter } from 'next/router';
import type { GetServerSideProps } from 'next';
import SubmissionExperience from '../../components/community-reporter/SubmissionExperience';
import ReporterPortalLayout from '../../components/reporter-portal/ReporterPortalLayout';
import { PortalRouteState } from '../../components/reporter-portal/PortalRouteState';
import { usePublicFounderToggles } from '../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { getReporterPortalPageServerProps } from '../../lib/reporterPortalPage';
import type { FeatureToggleProps } from '../../types/community-reporter';

export default function ReporterSubmitPage({ communityReporterClosed, reporterPortalClosed }: FeatureToggleProps) {
  const { toggles } = usePublicFounderToggles({ communityReporterClosed, reporterPortalClosed, updatedAt: null });
  const { session, isReady, reason } = useReporterPortalSession({ reportUnauthorizedReason: true });

  if (toggles.communityReporterClosed || toggles.reporterPortalClosed) {
    return <ReporterPortalLayout title="Submit Story" description="Reporter submission access is blocked by toggle." active="submit"><PortalRouteState title="Reporter Portal is closed" description="The Reporter Portal toggle is off, so story submission through the portal is blocked." actionHref="/community-reporter" actionLabel="Back to Community Reporter" /></ReporterPortalLayout>;
  }

  if (!isReady) {
    return <ReporterPortalLayout title="Submit Story" description="Loading session." active="submit"><div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading reporter session…</div></ReporterPortalLayout>;
  }

  if (!session?.email) {
    return <ReporterPortalLayout title="Submit Story" description="A reporter login is required." active="submit"><PortalRouteState title={reason === 'SESSION_EXPIRED' ? 'Session expired' : 'Login required'} description={reason === 'SESSION_EXPIRED' ? 'Your verified reporter session expired. Sign in again before sending a new story.' : 'Sign in with your reporter email before using the Reporter Portal submission desk.'} actionHref="/reporter/login" actionLabel="Login to Reporter Portal" /></ReporterPortalLayout>;
  }

  return <SubmissionExperience communityReporterClosed={communityReporterClosed} reporterPortalClosed={reporterPortalClosed} variant="portal" initialEmail={session.email} />;
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = getReporterPortalPageServerProps;