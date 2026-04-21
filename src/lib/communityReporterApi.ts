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
  | 'young-achievers'
  | 'student-voices';

export type YouthPulseSubmissionType =
  | 'reported-story'
  | 'student-voice'
  | 'campus-event'
  | 'achievement-spotlight'
  | 'exam-career-update';

export type YouthPulseStorySource = 'first-hand' | 'reported';

export interface SubmitYouthPulseStoryPayload {
  reporterName: string;
  reporterEmail: string;
  mobileNumber: string;
  college: string;
  city: string;
  state: string;
  headline: string;
  story: string;
  track: YouthPulseTrackSlug;
  submissionType: YouthPulseSubmissionType;
  storySource: YouthPulseStorySource;
  truthfulnessConfirmed: boolean;
  rightsConfirmed: boolean;
  reviewAcknowledged: boolean;
  safetyConfirmed: boolean;
}

export interface SubmitYouthPulseStoryResult {
  ok: boolean;
  referenceId: string;
  status: string;
  message?: string;
}

export const YOUTH_PULSE_TRACK_OPTIONS: Array<{ value: YouthPulseTrackSlug; label: string }> = [
  { value: 'youth-pulse', label: 'Youth Pulse' },
  { value: 'campus-buzz', label: 'Campus Buzz' },
  { value: 'govt-exam-updates', label: 'Govt Exam Updates' },
  { value: 'career-boosters', label: 'Career Boosters' },
  { value: 'young-achievers', label: 'Young Achievers' },
  { value: 'student-voices', label: 'Student Voices' },
];

export const YOUTH_PULSE_SUBMISSION_TYPE_OPTIONS: Array<{ value: YouthPulseSubmissionType; label: string }> = [
  { value: 'reported-story', label: 'Reported Story' },
  { value: 'student-voice', label: 'Student Voice' },
  { value: 'campus-event', label: 'Campus Event' },
  { value: 'achievement-spotlight', label: 'Achievement Spotlight' },
  { value: 'exam-career-update', label: 'Exam / Career Update' },
];

export const YOUTH_PULSE_STORY_SOURCE_OPTIONS: Array<{ value: YouthPulseStorySource; label: string }> = [
  { value: 'first-hand', label: 'First-hand' },
  { value: 'reported', label: 'Reported' },
];

function getYouthPulseTrackLabel(track: YouthPulseTrackSlug): string {
  return YOUTH_PULSE_TRACK_OPTIONS.find((item) => item.value === track)?.label || 'Youth Pulse';
}

function getYouthPulseBackendCategory(track: YouthPulseTrackSlug): string {
  switch (track) {
    case 'govt-exam-updates':
    case 'career-boosters':
      return 'Education / School / College';
    case 'young-achievers':
      return 'Achievement / Inspiration';
    case 'student-voices':
    case 'campus-buzz':
    case 'youth-pulse':
    default:
      return 'Youth / Campus';
  }
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
      fullName: payload.reporterName,
      reporterEmail: payload.reporterEmail || '',
      reporterPhone: payload.reporterPhone || '',
      reporterWhatsApp: payload.reporterWhatsApp || '',
      phone: payload.reporterPhone || '',
      whatsapp: payload.reporterWhatsApp || '',
      reporterCity: payload.city || '',
      reporterDistrict: payload.district || '',
      reporterState: payload.state || '',
      reporterCountry: payload.country || '',
      city: payload.city || '',
      district: payload.district || '',
      state: payload.state || '',
      country: payload.country || '',
      reporterType: payload.reporterType,
      category: payload.category,
      coverageScope: payload.coverageScope || '',
      coverageType: payload.coverageScope || '',
      headline: payload.headline,
      storyText: payload.story,
      ageGroup: payload.ageGroup,
      preferredLanguages: payload.preferredLanguages || [],
      consentToContact: Boolean(payload.consentToContact),
      beats: payload.beats || payload.communityInterests || payload.beatsProfessional || [],
      beat: (payload.beats || payload.communityInterests || payload.beatsProfessional || [])[0] || '',
      reporterProfile: {
        fullName: payload.reporterName,
        email: payload.reporterEmail || '',
        phone: payload.reporterPhone || '',
        whatsapp: payload.reporterWhatsApp || '',
        city: payload.city || '',
        district: payload.district || '',
        state: payload.state || '',
        country: payload.country || '',
        preferredLanguages: payload.preferredLanguages || [],
        beats: payload.beats || payload.communityInterests || payload.beatsProfessional || [],
        consentToContact: Boolean(payload.consentToContact),
        reporterType: payload.reporterType,
      },
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
  const requestUrl = `/api/public/youth-pulse/submit`;
  const categoryLabel = getYouthPulseTrackLabel(payload.track);
  const backendCategory = getYouthPulseBackendCategory(payload.track);
  const locationLabel = [payload.college, payload.city, payload.state].filter(Boolean).join(', ');

  const requestBody = {
    reporterType: 'community',
    reporterName: payload.reporterName,
    fullName: payload.reporterName,
    name: payload.reporterName,
    reporterEmail: payload.reporterEmail,
    email: payload.reporterEmail,
    reporterPhone: payload.mobileNumber,
    reporterWhatsApp: '',
    phone: payload.mobileNumber,
    whatsapp: '',
    reporterCity: payload.city,
    reporterDistrict: '',
    reporterState: payload.state,
    reporterCountry: '',
    preferredLanguages: [],
    consentToContact: false,
    beats: [categoryLabel],
    communityInterests: [categoryLabel],
    ageGroup: '18-24',
    category: backendCategory,
    coverageScope: '',
    headline: payload.headline,
    storyText: payload.story,
    story: payload.story,
    location: locationLabel,
    college: payload.college,
    campusName: payload.college,
    city: payload.city,
    state: payload.state,
    desk: 'youth-pulse',
    track: payload.track,
    trackLabel: categoryLabel,
    submissionType: 'youth-pulse',
    youthSubmissionType: payload.submissionType,
    storySource: payload.storySource,
    source: 'youth_pulse',
    autoPublish: false,
    publishRequested: false,
    moderationRequired: true,
    acceptPolicy: true,
    confirm: true,
    truthfulnessConfirmed: payload.truthfulnessConfirmed,
    rightsConfirmed: payload.rightsConfirmed,
    reviewAcknowledged: payload.reviewAcknowledged,
    safetyConfirmed: payload.safetyConfirmed,
    reporterProfile: {
      fullName: payload.reporterName,
      email: payload.reporterEmail,
      phone: payload.mobileNumber,
      city: payload.city,
      state: payload.state,
      reporterType: 'community',
      beats: [categoryLabel],
    },
    meta: {
      form: 'youth-pulse-public-submit',
      college: payload.college,
      city: payload.city,
      state: payload.state,
      category: backendCategory,
      track: payload.track,
      trackLabel: categoryLabel,
      youthSubmissionType: payload.submissionType,
      storySource: payload.storySource,
      source: 'youth_pulse',
    },
  };

  if (process.env.NODE_ENV !== 'production') {
    console.info('[submitYouthPulseStory] request', {
      requestUrl,
      method: 'POST',
      requestBody,
    });
  }

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[submitYouthPulseStory] network failure', {
        requestUrl,
        method: 'POST',
        requestBody,
        error,
      });
    }
    throw error;
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  const referenceId = data?.referenceId || data?.storyId || data?.id || data?.reference || '';
  const status = data?.status || 'Under review';
  const message = typeof data?.message === 'string' ? data.message : undefined;

  if (!res.ok) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[submitYouthPulseStory] request failed', {
        requestUrl,
        method: 'POST',
        status: res.status,
        requestBody,
        response: data,
      });
    }
    return { ok: false, referenceId, status, message };
  }

  return { ok: true, referenceId, status, message };
}
