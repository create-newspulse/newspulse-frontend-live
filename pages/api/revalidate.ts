import type { NextApiRequest, NextApiResponse } from 'next';
import { getCategoryRouteKey } from '../../lib/categoryKeys';
import { PublicReadTimeoutError, withPublicReadDeadline } from '../../lib/publicReadDeadline';

type RevalidateRequest = {
  /** Explicit paths to revalidate, e.g. ["/news/123", "/gu/news/123", "/latest"]. */
  paths?: string[];
  tags?: string[];

  /** Optional helpers so callers (backend) can send IDs/slugs instead of every path. */
  articleId?: string;
  articleSlug?: string;
  articleSlugs?: string[] | Partial<Record<'en' | 'hi' | 'gu', string>>;
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

function normalizeLocaleKey(value: string): 'en' | 'hi' | 'gu' | null {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'hi' || raw === 'hindi' || raw === 'in') return 'hi';
  if (raw === 'gu' || raw === 'gujarati') return 'gu';
  if (raw === 'en' || raw === 'english') return 'en';
  return null;
}

function buildNewsPath(prefix: '' | '/hi' | '/gu', slug: string): string {
  return `${prefix}/news/${encodeURIComponent(slug)}`;
}

function deriveArticleSlugPaths(body: RevalidateRequest): string[] {
  const out: string[] = [];
  const singleSlug = String(body.articleSlug || '').trim();
  if (singleSlug) {
    for (const pre of prefixes()) {
      out.push(buildNewsPath(pre, singleSlug));
    }
  }

  const multi = body.articleSlugs;
  if (Array.isArray(multi)) {
    for (const slug of multi.map((item) => String(item || '').trim()).filter(Boolean)) {
      for (const pre of prefixes()) {
        out.push(buildNewsPath(pre, slug));
      }
    }
    return out;
  }

  if (multi && typeof multi === 'object') {
    for (const [key, value] of Object.entries(multi)) {
      const locale = normalizeLocaleKey(key);
      const slug = String(value || '').trim();
      if (!locale || !slug) continue;
      out.push(buildNewsPath(locale === 'en' ? '' : `/${locale}`, slug));
    }
  }

  return out;
}

function buildDerivedPaths(body: RevalidateRequest): string[] {
  const out: string[] = [];

  const articleId = String(body.articleId || '').trim();
  if (articleId) {
    for (const pre of prefixes()) {
      out.push(`${pre}/news/${encodeURIComponent(articleId)}`);
    }
  }

  out.push(...deriveArticleSlugPaths(body));

  const categoryKey = getCategoryRouteKey(
    String(body.categoryKey || '').trim().replace(/^\/+/, '').replace(/\/+$/, ''),
  );
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

function pagePath(path: string): string {
  return path.replace(/^\/(?:en|hi|gu)(?=\/|$)/, '').replace(/\/+$/, '') || '/';
}

function hasNoArticleIsr(page: string): boolean {
  // Home, article details, topic archives, Youth and the Regional redirect are SSR.
  // Latest and Search fetch articles in the browser; their HTML contains no article data.
  return page === '/' || page === '/latest' || page === '/search' || page === '/regional'
    || page === '/youth-pulse' || page.startsWith('/news/') || /^\/topic\/[^/]+$/.test(page);
}

// The Backend waits five seconds for delivery; the Vercel function limit is ten.
const DELIVERY_BUDGET_MS = 4000;
const MAX_CONCURRENT_REVALIDATIONS = 2;

async function regenerate(paths: string[], revalidate: (path: string) => Promise<void>, deadline: number) {
  const results = new Map<string, 'ok' | 'REVALIDATE_FAILED' | 'REVALIDATE_TIMEOUT'>();
  let next = 0;
  const worker = async () => {
    while (next < paths.length) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return;
      const path = paths[next++];
      try {
        // Next has no cancellation API. Bound the wait, not the regeneration itself.
        await withPublicReadDeadline(remaining, () => revalidate(path));
        results.set(path, Date.now() < deadline ? 'ok' : 'REVALIDATE_TIMEOUT');
      } catch (error) {
        if (error instanceof PublicReadTimeoutError || Date.now() >= deadline) {
          results.set(path, 'REVALIDATE_TIMEOUT');
          return;
        }
        results.set(path, 'REVALIDATE_FAILED');
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_REVALIDATIONS, paths.length) }, worker));

  const revalidated: string[] = [];
  const failed: Array<{ path: string; error: string }> = [];
  for (const path of paths) {
    const result = results.get(path);
    if (result === 'ok') revalidated.push(path);
    else failed.push({ path, error: result ?? 'REVALIDATE_NOT_STARTED' });
  }
  return { revalidated, failed };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now();
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

  const body: RevalidateRequest = (req.body && typeof req.body === 'object') ? req.body : {};

  const explicit = asArray(body.paths).map(normalizePath).filter(Boolean);
  const derived = buildDerivedPaths(body).map(normalizePath).filter(Boolean);
  const unique = [...new Set([...explicit, ...derived])];

  const articleChange = (Array.isArray(body.tags) && body.tags.includes('articles'))
    || unique.some(path => pagePath(path).startsWith('/news/'));
  const skipped: string[] = [];
  const targets = new Set<string>();
  for (const path of unique) {
    const page = pagePath(path);
    if (articleChange && hasNoArticleIsr(page)) {
      skipped.push(path);
      // Match the actual locale-preserving redirect, including older categoryKey-only targets.
      if (page === '/regional') targets.add(`${path.replace(/\/+$/, '')}/gujarat`);
    } else targets.add(path);
  }

  const { revalidated, failed } = await regenerate([...targets], path => res.revalidate(path), startedAt + DELIVERY_BUDGET_MS);
  const ok = failed.length === 0;
  const incomplete = failed.filter(row => row.error !== 'REVALIDATE_FAILED').length;
  if (!ok) {
    res.setHeader('Retry-After', '5');
    console.warn('[revalidate] Incomplete regeneration', {
      durationMs: Date.now() - startedAt, revalidated: revalidated.length, failed: failed.length, incomplete,
    });
  }
  return res.status(ok ? 200 : incomplete ? 504 : 503).json({
    ok, revalidated, failed, ...(skipped.length ? { skipped } : {}),
  });
}
