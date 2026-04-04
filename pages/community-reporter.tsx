import type { GetServerSideProps } from 'next';
import SubmissionExperience from '../components/community-reporter/SubmissionExperience';
import type { FeatureToggleProps } from '../types/community-reporter';
import { getReporterPortalPageServerProps } from '../lib/reporterPortalPage';

export default function CommunityReporterPage(props: FeatureToggleProps) {
  return <SubmissionExperience {...props} variant="public" />;
}

export const getServerSideProps: GetServerSideProps<FeatureToggleProps> = getReporterPortalPageServerProps;