import ReporterRecords from '../../../components/reporter-portal/ReporterRecords';
import type { FeatureToggleProps } from '../../../types/community-reporter';
export { getReporterPortalPageServerProps as getServerSideProps } from '../../../lib/reporterPortalPage';

export default function ReporterSubmissions(props: FeatureToggleProps) {
  return <ReporterRecords {...props} view="submissions" />;
}
