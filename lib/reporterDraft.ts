import { intakeCategory, receiptIdsAgree, scopes, storyLanguage, validContactNumber, type StoryLanguage } from './communityReporterIntake';
import { projectStory, record, type ReporterStory } from './reporterStories';

export const validDraftKey = (v: unknown): v is string =>
  typeof v === 'string' && /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v);

type DraftFields = {
  action: 'draft' | 'submit'; headline?: string; story?: string; category?: string; originalLanguage?: StoryLanguage;
  generalEthicsAccepted?: true; city?: string; district?: string; state?: string; country?: string;
  phone?: string; whatsapp?: string; beat?: string; coverageScope?: string;
};

// Omitting a category preserves it on PATCH. An explicitly empty category is
// not an instruction the Backend supports. Never copy owner or staff fields.
export function draftFields(input: unknown, create: boolean): DraftFields | null {
  if (!record(input) || (input.action !== 'draft' && input.action !== 'submit') || (create && input.action !== 'draft')) return null;
  const body: DraftFields = { action: input.action };
  for (const field of ['headline', 'story'] as const) {
    const value = input[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.trim().length > (field === 'headline' ? 200 : 50_000)) return null;
    const text = value.trim();
    // Blank text can clear an existing field. On a first save, omit it.
    if (!create || text) body[field] = text;
  }
  if (input.category !== undefined) {
    const category = intakeCategory(input.category);
    if (!category) return null;
    body.category = category.label;
  }
  if (input.originalLanguage !== undefined) {
    if (!storyLanguage(input.originalLanguage)) return null;
    body.originalLanguage = input.originalLanguage;
  }
  if (body.action === 'submit') {
    if (!body.headline || !body.story || !body.category || input.generalEthicsAccepted !== true) return null;
    body.generalEthicsAccepted = input.generalEthicsAccepted;
  }
  if (create) {
    if (!body.headline && !body.story) return null;
    for (const field of ['city', 'district', 'state', 'country', 'phone', 'whatsapp', 'beat', 'coverageScope'] as const) {
      const value = input[field];
      if (value === undefined) continue;
      if (typeof value !== 'string') return null;
      const text = value.trim();
      if (!text) continue;
      if ((field === 'phone' || field === 'whatsapp') && !validContactNumber(text)) return null;
      if (field === 'coverageScope' && !scopes.some(s => s === text)) return null;
      body[field] = text;
    }
  }
  return body;
}

export function draftReceipt(data: unknown, status: number, body: DraftFields, id?: string): ReporterStory {
  if (!record(data) || data.ok !== true || (data.success !== undefined && data.success !== true) || !record(data.item)
    || (id ? status !== 200 : !((status === 201 && data.created === true) || (status === 200 && data.created === false)))) {
    throw new Error('DRAFT_RECEIPT_UNCONFIRMED');
  }
  const item = projectStory(data.item, id);
  const draft = body.action === 'draft';
  if (!receiptIdsAgree(data, item.id) || !receiptIdsAgree(data.item, item.id)
    || !(data.item.category === null || typeof data.item.category === 'string')
    || !(data.item.originalLanguage === null || storyLanguage(data.item.originalLanguage))
    || item.publicationStatus !== 'not_published' || data.item.canEdit !== draft
    || (draft ? !(item.reviewStatus === 'DRAFT' || (id && item.reviewStatus === 'NEEDS_REVISION')) : item.reviewStatus !== 'SUBMITTED')
    || ((!id || body.headline !== undefined) && item.headline !== (body.headline ?? ''))
    || ((!id || body.story !== undefined) && item.story !== (body.story ?? ''))
    || ((!id || body.category !== undefined) && data.item.category !== (body.category ?? null))
    || ((!id || body.originalLanguage !== undefined) && data.item.originalLanguage !== (body.originalLanguage ?? null))) {
    throw new Error('DRAFT_RECEIPT_UNCONFIRMED');
  }
  return item;
}
