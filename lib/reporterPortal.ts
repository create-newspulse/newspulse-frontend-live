import type { CommunityStorySummary, CommunitySubmissionCounts } from '../types/community-reporter';

export type ReporterPortalSession = {
  email: string;
  fullName?: string;
  expiresAt?: string;
};

export type ReporterPortalProfile = {
  fullName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
};

const REPORTER_PROFILE_KEY = 'np_cr_profile_v1';
const REPORTER_EMAIL_KEY = 'np_cr_email';
const REPORTER_SESSION_TOKEN_KEY = 'np_reporter_portal_session_token';

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function removeStorage(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

export function normalizeReporterEmail(email: string | null | undefined): string {
  return String(email || '').trim().toLowerCase();
}

export function loadReporterPortalSessionToken(): string | null {
  const raw = readStorage(REPORTER_SESSION_TOKEN_KEY);
  const token = String(raw || '').trim();
  return token || null;
}

export function saveReporterPortalSessionToken(token: string | null | undefined) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    removeStorage(REPORTER_SESSION_TOKEN_KEY);
    return;
  }
  writeStorage(REPORTER_SESSION_TOKEN_KEY, normalizedToken);
}

export function clearReporterPortalSessionToken() {
  removeStorage(REPORTER_SESSION_TOKEN_KEY);
}

export function getReporterPortalAuthHeaders(): Record<string, string> {
  const token = loadReporterPortalSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getStoryIdentity(story: CommunityStorySummary | null | undefined): string {
  return String(story?.id || story?.referenceId || '').trim();
}

export function getStoryStatusKey(status: string | null | undefined): string {
  return String(status || '').trim().toLowerCase().replace(/-/g, '_');
}

export function getStoryBody(story: CommunityStorySummary | null | undefined): string {
  if (!story) return '';
  const raw =
    story.body ||
    story.text ||
    story.story ||
    story.content ||
    story.details ||
    story.description ||
    story.bodyText ||
    story.fullText ||
    '';
  return String(raw || '').trim();
}

export function getStoryNotes(story: CommunityStorySummary | null | undefined): string[] {
  if (!story) return [];
  const values = [
    story.notes,
    story.note,
    story.editorNotes,
    story.editorNote,
    story.reviewNotes,
    story.reviewNote,
    story.feedback,
    story.rejectionReason,
    story.internalComment,
    story.comment,
  ];

  const flat = values.flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    return [value];
  });

  return flat
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index);
}

export function getStorySubmittedAt(story: CommunityStorySummary | null | undefined): string {
  return String(story?.submittedAt || story?.createdAt || '').trim();
}

export function getStoryLocation(story: CommunityStorySummary | null | undefined): string {
  if (!story) return 'Not provided';
  return [story.city, story.district, story.state, story.country]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ') || 'Not provided';
}

export function getSubmissionCounts(stories: CommunityStorySummary[]): CommunitySubmissionCounts {
  return stories.reduce<CommunitySubmissionCounts>((acc, story) => {
    acc.total += 1;
    const status = getStoryStatusKey(story.status);

    if (status === 'pending' || status === 'under_review') acc.pending += 1;
    else if (status === 'approved') acc.approved += 1;
    else if (status === 'published') acc.published += 1;
    else if (status === 'rejected') acc.rejected += 1;
    else if (status === 'withdrawn') acc.withdrawn += 1;

    return acc;
  }, {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    published: 0,
    withdrawn: 0,
  });
}

export function canWithdrawStory(story: CommunityStorySummary | null | undefined): boolean {
  const status = getStoryStatusKey(story?.status);
  return status === 'pending' || status === 'under_review';
}

export function canEditStory(story: CommunityStorySummary | null | undefined): boolean {
  return getStoryStatusKey(story?.status) === 'draft';
}

export function loadReporterPortalProfile(): ReporterPortalProfile | null {
  const raw = readStorage(REPORTER_PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : (typeof parsed.name === 'string' ? parsed.name : undefined),
      email: typeof parsed.email === 'string' ? normalizeReporterEmail(parsed.email) : undefined,
      phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      whatsapp: typeof parsed.whatsapp === 'string' ? parsed.whatsapp : (typeof parsed.reporterWhatsApp === 'string' ? parsed.reporterWhatsApp : undefined),
      city: typeof parsed.city === 'string' ? parsed.city : undefined,
      district: typeof parsed.district === 'string' ? parsed.district : undefined,
      state: typeof parsed.state === 'string' ? parsed.state : undefined,
      country: typeof parsed.country === 'string' ? parsed.country : undefined,
    };
  } catch {
    return null;
  }
}

export function saveReporterPortalProfile(profile: ReporterPortalProfile) {
  const normalizedEmail = normalizeReporterEmail(profile.email);
  const payload = {
    fullName: String(profile.fullName || '').trim(),
    email: normalizedEmail,
    phone: String(profile.phone || '').trim(),
    whatsapp: String(profile.whatsapp || '').trim(),
    city: String(profile.city || '').trim(),
    district: String(profile.district || '').trim(),
    state: String(profile.state || '').trim(),
    country: String(profile.country || '').trim() || 'India',
  };
  writeStorage(REPORTER_PROFILE_KEY, JSON.stringify(payload));
  if (normalizedEmail) {
    writeStorage(REPORTER_EMAIL_KEY, normalizedEmail);
  }
}

export function formatSubmissionDate(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return 'Not provided';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function getRecentStories(stories: CommunityStorySummary[], limit = 5): CommunityStorySummary[] {
  return [...stories]
    .sort((left, right) => {
      const leftTime = new Date(getStorySubmittedAt(left) || 0).getTime();
      const rightTime = new Date(getStorySubmittedAt(right) || 0).getTime();
      return rightTime - leftTime;
    })
    .slice(0, limit);
}