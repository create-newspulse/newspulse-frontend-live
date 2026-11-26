import type { NextApiRequest, NextApiResponse } from 'next';
import { reporterBackendFetch, reporterIngressAvailable } from './reporterBackend.server';
import { requireReporterSession } from './reporterPortalAuth';
import { communityReporterWriteGate } from './communityReporterWriteGate.server';
import { projectList, projectStory, projectSummary, record, reporterObjectId } from './reporterStories';
import { draftFields, draftReceipt, validDraftKey } from './reporterDraft';

type Operation = 'list' | 'collection' | 'detail' | 'summary' | 'withdraw';
const base = '/api/reporter-portal';
const reject = (res: NextApiResponse, status: number, code: string) => res.status(status).json({ ok: false, code });
const queryNumber = (value: unknown, fallback: number) => value === undefined ? fallback
  : typeof value === 'string' && /^[1-9]\d{0,6}$/.test(value) ? Number(value) : 0;

export function reporterRecordHandler(operation: Operation) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Vary', 'Cookie, X-Reporter-Account');
    const allow = operation === 'detail' ? ['GET', 'PATCH'] : operation === 'collection' ? ['GET', 'POST'] : operation === 'withdraw' ? ['POST'] : ['GET'];
    const method = req.method || '';
    if (!allow.includes(method)) {
      res.setHeader('Allow', allow.join(', '));
      return reject(res, 405, 'METHOD_NOT_ALLOWED');
    }
    if (!reporterIngressAvailable(req)) return reject(res, 503, 'REPORTER_CONTRACT_UNAVAILABLE');
    const id = req.query.id;
    if ((operation === 'detail' || operation === 'withdraw') && !reporterObjectId(id)) return reject(res, 400, 'INVALID_SUBMISSION_ID');
    const page = queryNumber(req.query.page, 1), limit = queryNumber(req.query.limit, 20);
    const collection = operation === 'collection' || operation === 'list';
    if (collection && method === 'GET' && (!page || !limit || limit > 100)) return reject(res, 400, 'INVALID_PAGE');
    const write = method !== 'GET';
    const owner = req.headers['x-reporter-account'];
    // This header is a stale-screen precondition, never a source of ownership.
    if (write && (!reporterObjectId(owner) || req.headers['sec-fetch-site'] === 'cross-site'
      || !/^application\/json\b/i.test(req.headers['content-type'] || ''))) return reject(res, 403, 'REPORTER_ACCOUNT_REQUIRED');
    const create = operation === 'collection' && method === 'POST';
    const key = req.headers['idempotency-key'];
    if (create && !validDraftKey(key)) return reject(res, 400, 'VALIDATION_FAILED');
    if (!create && key !== undefined) return reject(res, 409, 'DRAFT_KEY_CONFLICT');
    const body = method === 'PATCH' || create ? draftFields(req.body, create) : null;
    if ((method === 'PATCH' || create) && !body) return reject(res, 400, 'VALIDATION_FAILED');
    try {
      const auth = await requireReporterSession(req);
      if (!auth.ok) return reject(res, auth.status, auth.code);
      if (owner !== undefined && owner !== auth.reporter.accountId) return reject(res, 409, 'REPORTER_ACCOUNT_CHANGED');
      if (body) {
        const gate = await communityReporterWriteGate(true, req);
        if (gate !== 'open') return reject(res, 503, gate === 'paused' ? 'SUBMISSIONS_PAUSED' : 'INTAKE_UNAVAILABLE');
      }
      const path = operation === 'withdraw' ? `/api/public/community-reporter/${id}/withdraw`
        : operation === 'summary' ? `${base}/dashboard/summary`
        : create ? `${base}/submissions` : collection ? `${base}/submissions?page=${page}&limit=${limit}` : `${base}/submissions/${id}`;
      const response = await reporterBackendFetch(req, path, { method, ...(write ? { body: body || {} } : {}),
        ...(create && validDraftKey(key) ? { draftKey: key } : {}) });
      if (!response.ok) {
        if (create && response.status === 409) return reject(res, 409, 'DRAFT_KEY_CONFLICT');
        if (body && response.status === 400) {
          const error: unknown = await response.json();
          return record(error) && error.ok === false && error.code === 'VALIDATION_FAILED'
            ? reject(res, 400, 'VALIDATION_FAILED') : reject(res, 502, 'INVALID_REPORTER_RESPONSE');
        }
        const code = ({ 400: 'VALIDATION_FAILED', 401: 'REPORTER_SESSION_MISSING', 403: 'REPORTER_ACCESS_DENIED', 404: 'SUBMISSION_NOT_FOUND', 409: 'SUBMISSION_NOT_EDITABLE' } as Record<number, string>)[response.status];
        return reject(res, code ? response.status : response.status >= 500 ? response.status : 502, code || 'REPORTER_UPSTREAM_FAILED');
      }
      const data: unknown = await response.json();
      if (!record(data) || data.ok !== true) return reject(res, 502, 'INVALID_REPORTER_RESPONSE');
      if (body) {
        const item = draftReceipt(data, response.status, body, create ? undefined : String(id));
        return res.status(response.status).json({ ok: true, ...(create ? { created: data.created } : {}), item });
      }
      if (operation === 'withdraw') return res.status(200).json({ ok: true });
      if (operation === 'summary') return res.status(200).json({ ok: true, summary: projectSummary(data.summary) });
      if (operation === 'detail') return res.status(200).json({ ok: true, item: projectStory(data.item, String(id)) });
      const { items, total, page: p, limit: l } = projectList(data, page, limit);
      return res.status(200).json({ ok: true, items, total, meta: { page: p, limit: l, total } });
    } catch {
      // Upstream error bodies, sessions and private rows must never be echoed to the browser or logs.
      return reject(res, 502, 'REPORTER_UPSTREAM_UNAVAILABLE');
    }
  };
}
