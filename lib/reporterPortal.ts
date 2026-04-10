import type { CommunityStorySummary, CommunitySubmissionCounts } from '../types/community-reporter';

export type ReporterPortalSession = {
  email: string;
  fullName?: string;
  name?: string;
  firstName?: string;
  expiresAt?: string;
};

export type ReporterPortalProfile = {
  fullName?: string;
  name?: string;
  firstName?: string;
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

type ReporterDisplayNameSource = {
  fullName?: string | null;
  name?: string | null;
  firstName?: string | null;
  email?: string | null;
};

function normalizeReporterNamePart(value: string | null | undefined): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function getReporterDisplayName(source: ReporterDisplayNameSource | null | undefined, fallback = 'Community Reporter'): string {
  const fullName = normalizeReporterNamePart(source?.fullName);
  if (fullName) return fullName;

  const name = normalizeReporterNamePart(source?.name);
  if (name) return name;

  const firstName = normalizeReporterNamePart(source?.firstName);
  if (firstName) return firstName;

  const emailPrefix = normalizeReporterEmail(source?.email).split('@')[0]?.trim() || '';
  return emailPrefix || fallback;
}

export function extractReporterIdentityFields(source: any, fallbackEmail?: string | null): Partial<ReporterPortalProfile> {
  const fullName = normalizeReporterNamePart(
    source?.fullName ||
    source?.name ||
    source?.reporterName ||
    source?.reporter?.fullName ||
    source?.reporter?.reporterName ||
    source?.reporterProfile?.fullName ||
    source?.reporterProfile?.reporterName ||
    source?.session?.fullName ||
    source?.user?.fullName
  );
  const name = normalizeReporterNamePart(
    source?.name ||
    source?.reporter?.name ||
    source?.reporterProfile?.name ||
    source?.session?.name ||
    source?.user?.name ||
    fullName
  );
  const firstName = normalizeReporterNamePart(
    source?.firstName ||
    source?.reporter?.firstName ||
    source?.reporterProfile?.firstName ||
    source?.session?.firstName ||
    source?.user?.firstName ||
    fullName.split(/\s+/)[0] ||
    name.split(/\s+/)[0]
  );
  const email = normalizeReporterEmail(
    source?.email ||
    source?.reporterEmail ||
    source?.reporter?.email ||
    source?.reporterProfile?.email ||
    source?.session?.email ||
    source?.user?.email ||
    fallbackEmail
  );

  return {
    ...(fullName ? { fullName } : {}),
    ...(name ? { name } : {}),
    ...(firstName ? { firstName } : {}),
    ...(email ? { email } : {}),
  };
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
      ...extractReporterIdentityFields(parsed),
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
  const identity = extractReporterIdentityFields(profile);
  const normalizedEmail = normalizeReporterEmail(identity.email || profile.email);
  const fullName = normalizeReporterNamePart(identity.fullName || profile.fullName);
  const name = normalizeReporterNamePart(identity.name || profile.name || fullName);
  const firstName = normalizeReporterNamePart(identity.firstName || profile.firstName || fullName.split(/\s+/)[0] || name.split(/\s+/)[0]);
  const payload = {
    fullName,
    name,
    firstName,
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