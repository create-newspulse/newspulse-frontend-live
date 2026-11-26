import type { NextApiRequest, NextApiResponse } from 'next';
import { ageGroups, intakeCategory, receiptIdsAgree, scopes, storyLanguage, validContactNumber, validEmail, type AgeGroup, type Scope } from '../../../lib/communityReporterIntake';
import { communityReporterWriteGate } from '../../../lib/communityReporterWriteGate.server';
import { hasReporterCredential, publicReporterBackendFetch, reporterBackendFetch, reporterIngressAvailable, reporterLock } from '../../../lib/reporterBackend.server';
import { requireReporterSession } from '../../../lib/reporterPortalAuth';
import { projectStory, record, reporterObjectId } from '../../../lib/reporterStories';

const fail = (res: NextApiResponse, status: number, code: string) => res.status(status).json({ ok: false, code });
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function articleBody(input: Record<string, unknown>) {
  const headline = text(input.headline), story = text(input.story), category = intakeCategory(input.category)?.label;
  const language = input.originalLanguage;
  if (!headline || headline.length > 150 || story.length < 50 || story.length > 10_000 || !category
    || (language !== undefined && !storyLanguage(language))) return null;
  return { headline, story, category, ...(storyLanguage(language) ? { originalLanguage: language } : {}) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Cookie, X-Reporter-Account');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'METHOD_NOT_ALLOWED');
  }
  const actor = req.headers['x-reporter-account'];
  // No default. In particular, dropping an expired session must never select anonymous intake.
  if ((actor !== 'guest' && !reporterObjectId(actor)) || req.headers['sec-fetch-site'] === 'cross-site'
    || !/^application\/json\b/i.test(req.headers['content-type'] || '')) return fail(res, 403, 'REPORTER_ACCOUNT_REQUIRED');
  const guest = actor === 'guest';
  if (guest) {
    try {
      if (req.headers.authorization || hasReporterCredential(req) || reporterLock(req) === 'pending' || req.cookies?.np_reporter_portal_session)
        return fail(res, 409, 'REPORTER_ACCOUNT_CHANGED');
    } catch { return fail(res, 409, 'REPORTER_ACCOUNT_CHANGED'); }
  }
  if (!reporterIngressAvailable(req)) return fail(res, 503, 'REPORTER_CONTRACT_UNAVAILABLE');
  if (req.headers['idempotency-key'] !== undefined) return fail(res, 409, 'DRAFT_KEY_CONFLICT');
  if (!record(req.body)) return fail(res, 400, 'VALIDATION_FAILED');
  const input = req.body;
  const article = articleBody(input);
  const ageGroup = text(input.ageGroup);
  const email = text(input.reporterEmail).toLowerCase(), name = text(input.reporterName);
  const phone = text(input.reporterPhone), whatsapp = text(input.reporterWhatsApp);
  if (!article || (guest ? !Object.prototype.hasOwnProperty.call(ageGroups, ageGroup) : !scopes.includes(text(input.coverageScope) as Scope))
    || input.generalEthicsAccepted !== true || !validContactNumber(phone) || !validContactNumber(whatsapp)
    || !validEmail(email) || (guest && !name)) return fail(res, 400, 'VALIDATION_FAILED');

  try {
    if (!guest) {
      const auth = await requireReporterSession(req);
      if (!auth.ok) return fail(res, auth.status, auth.status === 503 ? 'INTAKE_UNAVAILABLE' : auth.code);
      if (auth.reporter.accountId !== actor || auth.reporter.email.toLowerCase() !== email) return fail(res, 409, 'REPORTER_ACCOUNT_CHANGED');
    }
    const gate = await communityReporterWriteGate(!guest, req);
    if (gate !== 'open') return fail(res, 503, gate === 'paused' ? 'SUBMISSIONS_PAUSED' : 'INTAKE_UNAVAILABLE');

    const location = { city: text(input.city), district: text(input.district), state: text(input.state), country: text(input.country) };
    // These are two different Backend writers. Public intake never receives a
    // credential; account intake never receives a client-supplied owner or falls back.
    const upstream = guest
      ? await publicReporterBackendFetch(req, '/api/community/submissions', {
            ...article, ...location, reporterName: name, email, ageGroup: ageGroups[ageGroup as AgeGroup],
            contact: { phone, canContactForThisStory: input.consentToContact === true, canContactForFutureStories: false },
            confirmTruthful: true, confirmEditorialReviewAllowed: true,
        })
      : await reporterBackendFetch(req, '/api/reporter-portal/submissions', {
          method: 'POST',
          body: { action: 'submit', ...article, ...location, phone, whatsapp, coverageScope: input.coverageScope, generalEthicsAccepted: input.generalEthicsAccepted,
            ...(Array.isArray(input.communityInterests) && input.communityInterests.length
              ? { beat: input.communityInterests.filter((v: unknown) => typeof v === 'string').join(', ') } : {}) },
        });

    const data: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      if (upstream.status === 400 && record(data) && data.ok === false
        && (data.code === 'VALIDATION_ERROR' || data.code === 'VALIDATION_FAILED')) return fail(res, 400, 'VALIDATION_FAILED');
      if (!guest && (upstream.status === 401 || upstream.status === 403)) return fail(res, upstream.status, 'REPORTER_SESSION_MISSING');
      if (upstream.status === 503 && record(data) && data.ok === false && data.code === 'REPORTER_PORTAL_CLOSED') return fail(res, 503, 'SUBMISSIONS_PAUSED');
      return fail(res, 502, 'RECEIPT_UNCONFIRMED');
    }
    if (upstream.status !== 201 || !record(data) || data.ok !== true || (data.success !== undefined && data.success !== true) || !record(data.item)
      || !reporterObjectId(data.item.id) || !receiptIdsAgree(data, data.item.id) || !receiptIdsAgree(data.item, data.item.id)
      || data.item.headline !== article.headline || data.item.category !== article.category) {
      return fail(res, 502, 'RECEIPT_UNCONFIRMED');
    }
    if (guest) {
      if (data.success !== true || data.item.status !== 'PENDING_FOUNDER') return fail(res, 502, 'RECEIPT_UNCONFIRMED');
    } else {
      const item = projectStory(data.item);
      if (item.reviewStatus !== 'SUBMITTED' || item.publicationStatus !== 'not_published' || data.item.canEdit !== false || item.story !== article.story
        || data.item.originalLanguage !== (article.originalLanguage ?? null)) return fail(res, 502, 'RECEIPT_UNCONFIRMED');
    }
    return res.status(201).json({ ok: true, referenceId: data.item.id, actor: guest ? 'guest' : 'account' });
  } catch {
    return fail(res, 502, 'RECEIPT_UNCONFIRMED');
  }
}
