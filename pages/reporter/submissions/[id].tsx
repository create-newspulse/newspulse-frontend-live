import ReporterRecords from '../../../components/reporter-portal/ReporterRecords';
import type { FeatureToggleProps } from '../../../types/community-reporter';
export { getReporterPortalPageServerProps as getServerSideProps } from '../../../lib/reporterPortalPage';

export default function ReporterSubmissionDetail(props: FeatureToggleProps) {
  return <ReporterRecords {...props} view="detail" />;
}
