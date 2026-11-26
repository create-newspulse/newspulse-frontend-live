import { COMMUNITY_REPORTER_CATEGORY_OPTIONS } from './communityReporterCategories';

export const storyLanguages = ['en', 'hi', 'gu'] as const;
export type StoryLanguage = typeof storyLanguages[number];
export type AgeGroup = 'under_18' | '18_24' | '25_40' | '41_plus';
export const ageGroups: Record<AgeGroup, string> = {
  under_18: 'Under 18', '18_24': '18-24', '25_40': '25-40', '41_plus': '41+',
};
export type Scope = 'regional' | 'national' | 'international';
export const scopes: Scope[] = ['regional', 'national', 'international'];

// The portal accepts canonical English category names, not UI slugs or translated labels.
export function intakeCategory(value: unknown) {
  return COMMUNITY_REPORTER_CATEGORY_OPTIONS.find(c => c.value === value || c.label === value);
}
export function storyLanguage(value: unknown): value is StoryLanguage {
  return storyLanguages.some(language => value === language);
}
export function validContactNumber(value: string) {
  return !value || (/^\+?[-()\s0-9]{7,20}$/.test(value) && /^\d{7,15}$/.test(value.replace(/\D/g, '')));
}
export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function receiptIdsAgree(envelope: Record<string, unknown>, reference: string) {
  return ['id', 'storyId', 'referenceId'].every(key => !(key in envelope) || envelope[key] === reference);
}
