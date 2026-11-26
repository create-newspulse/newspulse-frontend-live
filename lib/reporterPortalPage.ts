import type { GetServerSideProps } from 'next';
import { fetchServerPublicFounderToggles } from './publicFounderToggles';
import type { FeatureToggleProps } from '../types/community-reporter';

export const getReporterPortalPageServerProps: GetServerSideProps<FeatureToggleProps> = async ({ locale, res }) => {
  res?.setHeader('Cache-Control', 'private, no-store');
  const toggles = await fetchServerPublicFounderToggles();
  const { getMessages } = await import('./getMessages');

  return {
    props: {
      communityReporterClosed: toggles.communityReporterClosed,
      reporterPortalClosed: toggles.reporterPortalClosed,
      messages: await getMessages(locale as string),
    },
  };
};