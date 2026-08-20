export type CommunityReporterAgeGroup = 'under_18' | '18_24' | '25_40' | '41_plus';

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
  ageGroup: CommunityReporterAgeGroup;
  category: string;
  coverageScope?: '' | 'regional' | 'national' | 'international';
  headline: string;
  story: string;
  mediaLink?: string;
  priority?: 'normal' | 'high';
  storyCity?: string;
  storyDistrict?: string;
  storyState?: string;
  storyCountry?: string;
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
  professionalJournalistId?: string;
  journalistIdFileId?: string;
  websiteOrPortfolio?: string;
  socialLinks?: { linkedin?: string; twitter?: string };
  heardAbout?: string;
}

export interface SubmitCommunityStoryResult {
  ok: boolean;
  referenceId: string;
  status: string;
  reporterType: 'community' | 'journalist';
  message?: string;
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

function cleanString(value: unknown): string {
  return String(value || '').trim();
}

function cleanStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => cleanString(item)).filter(Boolean)
    : [];
}

function resolveSubmitErrorMessage(status: number, data: any): string {
  if (status === 400) {
    const message = cleanString(data?.message);
    if (message && !/^submit_failed$/i.test(message)) return message;
    return 'Please check the highlighted details and try submitting again.';
  }

  return "We couldn't submit your story right now. Please try again.";
}

export async function submitCommunityStory(
  payload: SubmitCommunityStoryPayload,
): Promise<SubmitCommunityStoryResult> {
  const requestUrl = `/api/community/submissions`;
  const beats = cleanStringArray(payload.beats?.length ? payload.beats : payload.communityInterests?.length ? payload.communityInterests : payload.beatsProfessional);

  const requestBody = {
    reporterAccountId: cleanString(payload.reporterAccountId) || undefined,
    reporterProfileId: cleanString(payload.reporterProfileId) || undefined,
    reporterType: payload.reporterType,
    reporterName: cleanString(payload.reporterName),
    reporterEmail: cleanString(payload.reporterEmail).toLowerCase(),
    reporterPhone: cleanString(payload.reporterPhone),
    reporterWhatsApp: cleanString(payload.reporterWhatsApp),
    city: cleanString(payload.city),
    district: cleanString(payload.district),
    state: cleanString(payload.state),
    country: cleanString(payload.country),
    ageGroup: cleanString(payload.ageGroup),
    category: cleanString(payload.category),
    coverageScope: cleanString(payload.coverageScope),
    headline: cleanString(payload.headline),
    story: cleanString(payload.story),
    mediaLink: cleanString(payload.mediaLink) || undefined,
    priority: payload.priority || 'normal',
    storyCity: cleanString(payload.storyCity) || undefined,
    storyDistrict: cleanString(payload.storyDistrict) || undefined,
    storyState: cleanString(payload.storyState) || undefined,
    storyCountry: cleanString(payload.storyCountry) || undefined,
    preferredLanguages: cleanStringArray(payload.preferredLanguages),
    consentToContact: Boolean(payload.consentToContact),
    beats,
    communityInterests: payload.reporterType === 'community' ? cleanStringArray(payload.communityInterests || beats) : undefined,
    journalistCharterAccepted: Boolean(payload.journalistCharterAccepted),
    generalEthicsAccepted: Boolean(payload.generalEthicsAccepted),
    organisationName: cleanString(payload.organisationName) || undefined,
    organisationType: payload.organisationType || undefined,
    positionTitle: cleanString(payload.positionTitle) || undefined,
    beatsProfessional: payload.reporterType === 'journalist' ? cleanStringArray(payload.beatsProfessional || beats) : undefined,
    yearsExperience: cleanString(payload.yearsExperience) || undefined,
    professionalJournalistId: cleanString(payload.professionalJournalistId) || undefined,
    journalistIdFileId: cleanString(payload.journalistIdFileId) || undefined,
    heardAbout: cleanString(payload.heardAbout) || undefined,
  };

  if (process.env.NODE_ENV !== 'production') {
    console.info('[community-reporter][submit]', {
      ageGroup: requestBody.ageGroup,
      category: requestBody.category,
      coverageScope: requestBody.coverageScope,
    });
  }

  const res = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(requestBody),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    const ref = data?.referenceId || '';
    const status = data?.status || 'under_review';
    const type = (payload.reporterType as 'community' | 'journalist') || 'community';
    return { ok: false, referenceId: ref, status, reporterType: type, message: resolveSubmitErrorMessage(res.status, data) };
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
    ageGroup: '18_24',
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
