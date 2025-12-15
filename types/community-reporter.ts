export type CommunityStorySummary = {
  id: string;
  referenceId?: string;
  headline: string;
  category: string;
  city?: string;
  state?: string;
  status: string;
  createdAt: string;
  submittedAt?: string;
  priority?: string;
  urgency?: string;
  [key: string]: any;
};

export type CommunitySettingsPublic = {
  communityReporterEnabled: boolean;
  allowNewSubmissions: boolean;
  allowMyStoriesPortal: boolean;
  allowJournalistApplications: boolean;
};

export type FeatureToggleProps = {
  communityReporterClosed: boolean;
  reporterPortalClosed: boolean;
};
