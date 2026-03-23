import type { NextApiRequest, NextApiResponse } from 'next';

type RevalidateRequest = {
  /** Explicit paths to revalidate, e.g. ["/news/123", "/gu/news/123", "/latest"]. */
  paths?: string[];

  /** Optional helpers so callers (backend) can send IDs/slugs instead of every path. */
  articleId?: string;
  categoryKey?: string;
  state?: string;
};

function asArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
  if (typeof value === 'string') return [value].map((v) => v.trim()).filter(Boolean);
  return [];
}

function normalizePath(p: string): string {
  const raw = String(p || '').trim();
  if (!raw) return '';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  // strip query/hash (revalidate expects pathname)
  return (withSlash.split('#')[0] || '/').split('?')[0] || '/';
}

function prefixes(): Array<'' | '/hi' | '/gu'> {
  return ['', '/hi', '/gu'];
}

function buildDerivedPaths(body: RevalidateRequest): string[] {
  const out: string[] = [];

  const articleId = String(body.articleId || '').trim();
  if (articleId) {
    for (const pre of prefixes()) {
      out.push(`${pre}/news/${encodeURIComponent(articleId)}`);
    }
  }

  const categoryKey = String(body.categoryKey || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (categoryKey) {
    for (const pre of prefixes()) {
      out.push(`${pre}/${categoryKey}`);
    }
  }

  const state = String(body.state || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (state) {
    for (const pre of prefixes()) {
      out.push(`${pre}/regional/${state}`);
    }
  }

  // These pages are high-impact lists; revalidate anyway.
  for (const pre of prefixes()) {
    out.push(`${pre}/latest`);
  }

  // Home
  out.push('/');
  out.push('/hi');
  out.push('/gu');

  return out;
}

function getSecret(req: NextApiRequest): string {
  const q = String(req.query.secret || '').trim();
  if (q) return q;
  const h = String(req.headers['x-revalidate-secret'] || '').trim();
  return h;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const expected = String(process.env.REVALIDATE_SECRET || process.env.NEXT_REVALIDATE_SECRET || '').trim();
  if (!expected) {
    return res.status(500).json({ ok: false, message: 'REVALIDATE_SECRET_NOT_SET' });
  }

  const provided = getSecret(req);
  if (!provided || provided !== expected) {
    return res.status(401).json({ ok: false, message: 'INVALID_SECRET' });
  }

  const body: RevalidateRequest = (req.body && typeof req.body === 'object') ? (req.body as any) : {};

  const explicit = asArray(body.paths).map(normalizePath).filter(Boolean);
  const derived = buildDerivedPaths(body).map(normalizePath).filter(Boolean);
  const requested = [...explicit, ...derived];

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const p of requested) {
    if (!p) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    unique.push(p);
  }

  const revalidated: string[] = [];
  const failed: Array<{ path: string; error: string }> = [];

  for (const path of unique) {
    try {
      // Next.js Pages Router ISR on-demand revalidation
      // eslint-disable-next-line no-await-in-loop
      await res.revalidate(path);
      revalidated.push(path);
    } catch (e: any) {
      failed.push({ path, error: String(e?.message || 'REVALIDATE_FAILED') });
    }
  }

  return res.status(200).json({ ok: failed.length === 0, revalidated, failed });
}
