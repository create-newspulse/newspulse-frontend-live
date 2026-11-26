import { buildNewsShareUrl, type NewsLang } from './newsRoutes';

const reviews = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_REVISION', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'ARCHIVED', 'DELETED', 'UNKNOWN'] as const;
const publications = ['not_published', 'draft', 'scheduled', 'published', 'unpublished', 'deleted', 'unverified'] as const;
type Review = typeof reviews[number];
type Publication = typeof publications[number];
export type ReporterEdition = { language: NewsLang; publicUrl: string };
export type ReporterStory = {
  id: string; headline: string; story: string; category: string | null; originalLanguage: NewsLang | null;
  location: { city: string | null; state: string | null; country: string | null } | null;
  createdAt: string | null; updatedAt: string | null; reporterFeedback: string | null;
  reviewStatus: Review; publicationStatus: Publication; isPublished: boolean; publicUrl: string | null;
  editions: ReporterEdition[]; canEdit: boolean; canWithdraw: boolean;
};
export type StorySummary = { totalSubmissions: number; received: number; pending: number; approved: number; rejected: number; published: number };
export type StoryList = { items: ReporterStory[]; total: number; page: number; limit: number };

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function reporterObjectId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}
function enumeration<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.some(v => v === value);
}
function optionalText(v: unknown): string | null { return typeof v === 'string' ? v : null; }
function count(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
const languages = ['en', 'hi', 'gu'] as const;

// The Backend v5B publication resolver issues reader paths for individual, visible
// editions. Only that edition ID (never a submission/CMS ID) may enter a Smart Share URL.
export function editionHref(edition: ReporterEdition): string | null {
  const match = /^\/api\/public\/news\/([a-f0-9]{24})\?lang=(en|hi|gu)$/i.exec(edition.publicUrl);
  if (!match || match[2] !== edition.language) return null;
  return buildNewsShareUrl({ id: match[1], lang: edition.language });
}

export function projectStory(value: unknown, expectedId?: string): ReporterStory {
  if (!record(value) || !reporterObjectId(value.id) || (expectedId && expectedId !== value.id)
    || typeof value.headline !== 'string' || typeof value.story !== 'string'
    || !enumeration(value.reviewStatus, reviews) || !enumeration(value.publicationStatus, publications)
    || typeof value.canEdit !== 'boolean' || typeof value.isPublished !== 'boolean'
    || !Array.isArray(value.editions) || !(value.publicUrl === null || typeof value.publicUrl === 'string')
    || !(value.reporterFeedback === null || typeof value.reporterFeedback === 'string')) {
    throw new Error('INVALID_REPORTER_STORY');
  }
  const editions = value.editions.map((e): ReporterEdition => {
    if (!record(e) || !enumeration(e.language, languages) || typeof e.publicUrl !== 'string') throw new Error('INVALID_PUBLIC_EDITION');
    const edition = { language: e.language, publicUrl: e.publicUrl };
    if (!editionHref(edition)) throw new Error('INVALID_PUBLIC_EDITION');
    return edition;
  });
  const published = value.publicationStatus === 'published';
  if ((value.reviewStatus === 'DRAFT' && value.publicationStatus !== 'not_published')
    || published !== value.isPublished || (published ? !editions.some(e => e.publicUrl === value.publicUrl) : (editions.length || value.publicUrl !== null))
    || new Set(editions.map(e => e.language)).size !== editions.length) throw new Error('INVALID_PUBLICATION_EVIDENCE');
  const loc = record(value.location) ? value.location : null;
  return {
    id: value.id, headline: value.headline, story: value.story, category: optionalText(value.category),
    originalLanguage: enumeration(value.originalLanguage, languages) ? value.originalLanguage : null,
    location: loc ? { city: optionalText(loc.city), state: optionalText(loc.state), country: optionalText(loc.country) } : null,
    createdAt: optionalText(value.createdAt), updatedAt: optionalText(value.updatedAt), reporterFeedback: value.reporterFeedback,
    reviewStatus: value.reviewStatus, publicationStatus: value.publicationStatus, isPublished: published,
    publicUrl: value.publicUrl, editions,
    canEdit: value.canEdit && value.publicationStatus === 'not_published' && ['DRAFT', 'NEEDS_REVISION'].includes(value.reviewStatus),
    canWithdraw: value.reviewStatus === 'UNDER_REVIEW' && value.publicationStatus === 'not_published'
      && typeof value.rawStatus === 'string' && ['under_review', 'pending', 'new', 'pending_founder'].includes(value.rawStatus.toLowerCase()),
  };
}

export function projectSummary(value: unknown): StorySummary {
  if (!record(value)) throw new Error('INVALID_REPORTER_SUMMARY');
  const { totalSubmissions, received, pending, approved, rejected, published } = value;
  if (!count(totalSubmissions) || !count(received) || !count(pending) || !count(approved) || !count(rejected) || !count(published)
    || published > received || Math.max(received, pending, approved, rejected, published) > totalSubmissions) throw new Error('INVALID_REPORTER_SUMMARY');
  return { totalSubmissions, received, pending, approved, rejected, published };
}
export function projectList(value: Record<string, unknown>, page: number, limit: number): StoryList {
  if (!Array.isArray(value.items) || !count(value.total) || !record(value.meta)
    || value.meta.total !== value.total || value.meta.page !== page || value.meta.limit !== limit
    || value.items.length !== Math.min(limit, Math.max(0, value.total - (page - 1) * limit))) throw new Error('INVALID_REPORTER_LIST');
  const items = value.items.map(v => projectStory(v));
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('DUPLICATE_REPORTER_STORY');
  return { items, total: value.total, page, limit };
}
