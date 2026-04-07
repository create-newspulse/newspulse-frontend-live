export interface SubmitCommunityStoryPayload {
  reporterAccountId?: string;
  reporterProfileId?: string;
  reporterName: string;
  reporterEmail?: string;
  reporterPhone?: string;
  reporterWhatsApp?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  ageGroup: string;
  category: string;
  coverageScope?: '' | 'regional' | 'national' | 'international';
  headline: string;
  story: string;
  reporterType: 'community' | 'journalist';
  preferredLanguages?: string[];
  consentToContact?: boolean;
  beats?: string[];
  communityInterests?: string[];
  journalistCharterAccepted?: boolean;
  generalEthicsAccepted?: boolean;
  organisationName?: string;
  organisationType?: 'print' | 'tv' | 'radio' | 'digital' | 'freelance' | 'other';
  positionTitle?: string;
  beatsProfessional?: string[];
  yearsExperience?: string;
  websiteOrPortfolio?: string;
  socialLinks?: { linkedin?: string; twitter?: string };
  heardAbout?: string;
}

export interface SubmitCommunityStoryResult {
  ok: boolean;
  referenceId: string;
  status: string;
  reporterType: 'community' | 'journalist';
}

export type YouthPulseTrackSlug =
  | 'youth-pulse'
  | 'campus-buzz'
  | 'govt-exam-updates'
  | 'career-boosters'
  | 'young-achievers';

export interface SubmitYouthPulseStoryPayload {
  reporterName: string;
  college: string;
  headline: string;
  story: string;
  track: YouthPulseTrackSlug;
}

export interface SubmitYouthPulseStoryResult {
  ok: boolean;
  referenceId: string;
  status: string;
}

export const YOUTH_PULSE_TRACK_OPTIONS: Array<{ value: YouthPulseTrackSlug; label: string }> = [
  { value: 'youth-pulse', label: 'Youth Pulse' },
  { value: 'campus-buzz', label: 'Campus Buzz' },
  { value: 'govt-exam-updates', label: 'Govt Exam Updates' },
  { value: 'career-boosters', label: 'Career Boosters' },
  { value: 'young-achievers', label: 'Young Achievers' },
];

function getYouthPulseTrackLabel(track: YouthPulseTrackSlug): string {
  return YOUTH_PULSE_TRACK_OPTIONS.find((item) => item.value === track)?.label || 'Youth Pulse';
}

export async function submitCommunityStory(
  payload: SubmitCommunityStoryPayload,
): Promise<SubmitCommunityStoryResult> {
  const requestUrl = `/api/community-reporter/submit`;

  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      reporterAccountId: payload.reporterAccountId,
      reporterProfileId: payload.reporterProfileId,
      reporterName: payload.reporterName,
      reporterEmail: payload.reporterEmail || '',
      reporterPhone: payload.reporterPhone || '',
      reporterWhatsApp: payload.reporterWhatsApp || '',
      phone: payload.reporterPhone || '',
      whatsapp: payload.reporterWhatsApp || '',
      reporterCity: payload.city || '',
      reporterDistrict: payload.district || '',
      reporterState: payload.state || '',
      reporterCountry: payload.country || '',
      reporterType: payload.reporterType,
      category: payload.category,
      coverageScope: payload.coverageScope || '',
      headline: payload.headline,
      storyText: payload.story,
      ageGroup: payload.ageGroup,
      preferredLanguages: payload.preferredLanguages || [],
      consentToContact: Boolean(payload.consentToContact),
      beats: payload.beats || payload.communityInterests || payload.beatsProfessional || [],
    }),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    const ref = data?.referenceId || '';
    const status = data?.status || 'under_review';
    const type = (payload.reporterType as 'community' | 'journalist') || 'community';
    return { ok: false, referenceId: ref, status, reporterType: type };
  }

  const referenceId = data?.referenceId || data?.id || '';
  const status = data?.status || 'Under review';
  const reporterType = (data?.reporterType as 'community' | 'journalist') || payload.reporterType;

  return { ok: true, referenceId, status, reporterType };
}

export async function submitYouthPulseStory(
  payload: SubmitYouthPulseStoryPayload,
): Promise<SubmitYouthPulseStoryResult> {
  const requestUrl = `/api/community-reporter/submit`;
  const categoryLabel = getYouthPulseTrackLabel(payload.track);

  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      reporterType: 'community',
      reporterName: payload.reporterName,
      reporterEmail: '',
      reporterPhone: '',
      reporterWhatsApp: '',
      phone: '',
      whatsapp: '',
      reporterCity: '',
      reporterDistrict: '',
      reporterState: '',
      reporterCountry: '',
      preferredLanguages: [],
      consentToContact: false,
      beats: [categoryLabel],
      communityInterests: [categoryLabel],
      ageGroup: '18-24',
      category: categoryLabel,
      coverageScope: '',
      headline: payload.headline,
      storyText: payload.story,
      story: payload.story,
      name: payload.reporterName,
      location: payload.college,
      college: payload.college,
      campusName: payload.college,
      desk: 'youth-pulse',
      track: payload.track,
      submissionType: 'youth-pulse',
      source: 'youth-pulse-frontend',
      autoPublish: false,
      publishRequested: false,
    }),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  const referenceId = data?.referenceId || data?.storyId || data?.id || data?.reference || '';
  const status = data?.status || 'Under review';

  if (!res.ok) {
    return { ok: false, referenceId, status };
  }

  return { ok: true, referenceId, status };
}
