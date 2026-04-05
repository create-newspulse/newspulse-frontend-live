export type CommunityReporterCategoryOption = {
  value: string;
  label: string;
};

export const COMMUNITY_REPORTER_CATEGORY_PLACEHOLDER = 'Select a category';

export const COMMUNITY_REPORTER_CATEGORY_OPTIONS: CommunityReporterCategoryOption[] = [
  { value: 'regional', label: 'Regional' },
  { value: 'national', label: 'National' },
  { value: 'international', label: 'International' },
  { value: 'civic_issue', label: 'Civic Issue' },
  { value: 'crime_police', label: 'Crime / Police' },
  { value: 'government_public_services', label: 'Government / Public Services' },
  { value: 'politics_local_leadership', label: 'Politics / Local Leadership' },
  { value: 'education_school_college', label: 'Education / School / College' },
  { value: 'health_hospital', label: 'Health / Hospital' },
  { value: 'weather_disaster', label: 'Weather / Disaster' },
  { value: 'business_market', label: 'Business / Market' },
  { value: 'sports', label: 'Sports' },
  { value: 'youth_campus', label: 'Youth / Campus' },
  { value: 'lifestyle_culture', label: 'Lifestyle / Culture' },
  { value: 'entertainment_events', label: 'Entertainment / Events' },
  { value: 'environment', label: 'Environment' },
  { value: 'achievement_inspiration', label: 'Achievement / Inspiration' },
  { value: 'general_tip', label: 'General Tip' },
];