import { receiptIdsAgree, type AgeGroup, type Scope, type StoryLanguage } from '../../lib/communityReporterIntake';
import { projectStory, record, reporterObjectId, type ReporterStory } from '../../lib/reporterStories';
import { draftFields, draftReceipt, validDraftKey } from '../../lib/reporterDraft';

export type CommunityReporterAgeGroup = AgeGroup;
export type SubmissionActor = { kind: 'guest' } | { kind: 'account'; accountId: string };

export interface SubmitCommunityStoryPayload {
  reporterName?: string;
  reporterEmail: string;
  reporterPhone?: string;
  reporterWhatsApp?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  ageGroup?: CommunityReporterAgeGroup;
  category: string;
  coverageScope?: Scope;
  originalLanguage?: StoryLanguage;
  headline: string;
  story: string;
  consentToContact?: boolean;
  communityInterests?: string[];
  generalEthicsAccepted: boolean;
}

export type IntakeFailure = 'validation' | 'session' | 'unavailable' | 'notEditable' | 'draftConflict' | 'uncertain';
export type IntakeError = { ok: false; reason: IntakeFailure };
export type SubmitCommunityStoryResult = IntakeError | { ok: true; referenceId: string };
export type DraftResult = IntakeError | { ok: true; item: ReporterStory };

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

const failed = (reason: IntakeFailure): IntakeError => ({ ok: false, reason });
function failure(status: number, data: unknown): IntakeError {
  const code = record(data) && data.ok === false ? data.code : null;
  if (status === 401 || status === 403 || (status === 409 && (code === 'REPORTER_ACCOUNT_CHANGED' || code === 'LOGOUT_UNCONFIRMED'))) return failed('session');
  if (status === 400 && (code === 'VALIDATION_ERROR' || code === 'VALIDATION_FAILED')) return failed('validation');
  if (status === 409 && code === 'DRAFT_KEY_CONFLICT') return failed('draftConflict');
  if ((status === 404 && code === 'SUBMISSION_NOT_FOUND') || (status === 409 && code === 'SUBMISSION_NOT_EDITABLE')) return failed('notEditable');
  if (status === 503 && (code === 'SUBMISSIONS_PAUSED' || code === 'REPORTER_CONTRACT_UNAVAILABLE' || code === 'INTAKE_UNAVAILABLE')) return failed('unavailable');
  return failed('uncertain');
}

const requestHeaders = (account: string) => ({
  Accept: 'application/json', 'Content-Type': 'application/json', 'X-Reporter-Account': account,
});
async function intakeFetch(url: string, init: RequestInit) {
  // Never replay writes, including across redirects. An abort isn't proof that a write didn't persist.
  const controller = new AbortController();
  const abort = () => controller.abort();
  const deadline = setTimeout(abort, 15_000);
  if (init.signal?.aborted) abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, {
      ...init, signal: controller.signal, cache: 'no-store', credentials: 'same-origin', redirect: 'error',
    });
    const data: unknown = await response.json().catch(() => null);
    return { response, data };
  } finally {
    clearTimeout(deadline);
    init.signal?.removeEventListener('abort', abort);
  }
}

export async function submitCommunityStory(
  payload: SubmitCommunityStoryPayload,
  actor: SubmissionActor,
): Promise<SubmitCommunityStoryResult> {
  if (actor.kind !== 'guest' && !reporterObjectId(actor.accountId)) return failed('session');
  if (payload.generalEthicsAccepted !== true) return failed('validation');
  try {
    const { response, data } = await intakeFetch('/api/community/submissions', {
      method: 'POST', headers: requestHeaders(actor.kind === 'guest' ? 'guest' : actor.accountId),
      body: JSON.stringify(payload),
    });
    if (!response.ok) return failure(response.status, data);
    if (response.status === 201 && record(data) && data.ok === true && (data.success === undefined || data.success === true)
      && data.actor === actor.kind && reporterObjectId(data.referenceId) && receiptIdsAgree(data, data.referenceId)) return { ok: true, referenceId: data.referenceId };
  } catch { /* Unknown delivery. */ }
  return failed('uncertain');
}

export async function openReporterDraft(id: string, accountId: string, signal: AbortSignal): Promise<DraftResult> {
  if (!reporterObjectId(id) || !reporterObjectId(accountId)) return failed('notEditable');
  try {
    const { response, data } = await intakeFetch(`/api/reporter-portal/submissions/${id}`, {
      method: 'GET', headers: requestHeaders(accountId), signal,
    });
    if (!response.ok) return failure(response.status, data);
    if (response.status !== 200 || !record(data) || data.ok !== true || (data.success !== undefined && data.success !== true)
      || !receiptIdsAgree(data, id)) return failed('unavailable');
    const item = projectStory(data.item, id);
    return item.canEdit ? { ok: true, item } : failed('notEditable');
  } catch {
    return failed('unavailable');
  }
}

export type ArticleEdit = {
  headline: string; story: string; category?: string; originalLanguage?: StoryLanguage; action: 'draft' | 'submit'; generalEthicsAccepted?: boolean;
};
type DraftPayload = NonNullable<ReturnType<typeof draftFields>>;
export type FirstDraftAttempt = { accountId: string; key: string; json: string; body: DraftPayload };

export function prepareFirstDraft(accountId: string, input: ArticleEdit & Partial<Record<'city'|'district'|'state'|'country'|'phone'|'whatsapp'|'beat'|'coverageScope', string>>,
  previous: FirstDraftAttempt | null): FirstDraftAttempt | IntakeError {
  if (!reporterObjectId(accountId)) return failed('session');
  const body = draftFields(input, true);
  if (!body) return failed('validation');
  const json = JSON.stringify(body);
  if (previous?.accountId === accountId && previous.json === json) return previous;
  const key = globalThis.crypto?.randomUUID?.();
  if (!validDraftKey(key)) return failed('unavailable');
  return { accountId, key, json, body };
}

export async function createReporterDraft(accountId: string, attempt: FirstDraftAttempt): Promise<DraftResult> {
  if (!reporterObjectId(accountId) || attempt.accountId !== accountId) return failed('session');
  try {
    const { response, data } = await intakeFetch('/api/reporter-portal/submissions', {
      method: 'POST', headers: { ...requestHeaders(accountId), 'Idempotency-Key': attempt.key }, body: attempt.json,
    });
    if (!response.ok) return failure(response.status, data);
    return { ok: true, item: draftReceipt(data, response.status, attempt.body) };
  } catch { return failed('uncertain'); }
}

export async function patchReporterDraft(existing: ReporterStory, accountId: string, edit: ArticleEdit): Promise<DraftResult> {
  if (!reporterObjectId(accountId) || !reporterObjectId(existing.id) || !existing.canEdit || existing.isPublished
    || existing.publicationStatus !== 'not_published' || !['DRAFT', 'NEEDS_REVISION'].includes(existing.reviewStatus)) return failed('notEditable');
  const payload = draftFields(edit, false);
  if (!payload || (!payload.headline && !payload.story)
    || (existing.reviewStatus === 'NEEDS_REVISION' && (!payload.headline || !payload.story))) return failed('validation');
  try {
    const { response, data } = await intakeFetch(`/api/reporter-portal/submissions/${existing.id}`, {
      method: 'PATCH', headers: requestHeaders(accountId), body: JSON.stringify(payload),
    });
    if (!response.ok) return failure(response.status, data);
    const item = draftReceipt(data, response.status, payload, existing.id);
    if (item.category !== (payload.category ?? existing.category) || item.originalLanguage !== (edit.originalLanguage ?? existing.originalLanguage)
      || item.reviewStatus !== (edit.action === 'draft' ? existing.reviewStatus : 'SUBMITTED')) return failed('uncertain');
    return { ok: true, item };
  } catch { return failed('uncertain'); }
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
      });
    }
    return { ok: false, referenceId, status, message };
  }

  return { ok: true, referenceId, status, message };
}
