import { useRouter } from 'next/router';
import { useEffect } from 'react';
import type { GetServerSideProps } from 'next';
import SubmissionExperience from '../../components/community-reporter/SubmissionExperience';
import ReporterPortalLayout from '../../components/reporter-portal/ReporterPortalLayout';
import { PortalRouteState } from '../../components/reporter-portal/PortalRouteState';
import { usePublicFounderToggles } from '../../hooks/usePublicFounderToggles';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { getReporterPortalPageServerProps } from '../../lib/reporterPortalPage';
import type { FeatureToggleProps } from '../../types/community-reporter';

export default function ReporterSubmitPage({ communityReporterClosed, reporterPortalClosed }: FeatureToggleProps) {
  const router = useRouter();
  const { toggles } = usePublicFounderToggles({ communityReporterClosed, reporterPortalClosed, youthPulseSubmissionsClosed: false, updatedAt: null });
  const { session, status, reason } = useReporterPortalSession({ reportUnauthorizedReason: true });
  const isAuthenticated = status === 'authenticated' && Boolean(session?.email);
  const reporterEmail = isAuthenticated ? String(session?.email || '') : '';
  const currentPath = typeof router.asPath === 'string' && router.asPath.startsWith('/reporter/') ? router.asPath : '/reporter/submit';
  const loginHref = `/reporter/login?next=${encodeURIComponent(currentPath)}`;
  const shouldRedirectToLogin = !toggles.communityReporterClosed && !toggles.reporterPortalClosed && status === 'anonymous';

  useEffect(() => {
    if (!shouldRedirectToLogin) return;
    void router.replace(loginHref).catch(() => {});
  }, [loginHref, router, shouldRedirectToLogin]);

  if (toggles.communityReporterClosed || toggles.reporterPortalClosed) {
    return <ReporterPortalLayout title="Submit Story" description="Reporter submission access is blocked by toggle." active="submit"><PortalRouteState title="Reporter Portal is closed" description="The Reporter Portal toggle is off, so story submission through the portal is blocked." actionHref="/community-reporter" actionLabel="Back to Community Reporter" /></ReporterPortalLayout>;
  }

  if (status === 'checking') {
    return <ReporterPortalLayout title="Submit Story" description="Checking session." active="submit"><div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Checking reporter session…</div></ReporterPortalLayout>;
  }

  if (!isAuthenticated) {
    return <ReporterPortalLayout title="Submit Story" description="Redirecting to reporter login." active="submit"><div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Checking reporter session…</div></ReporterPortalLayout>;
  }

  return <SubmissionExperience communityReporterClosed={communityReporterClosed} reporterPortalClosed={reporterPortalClosed} variant="portal" initialEmail={reporterEmail} />;
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = getReporterPortalPageServerProps;