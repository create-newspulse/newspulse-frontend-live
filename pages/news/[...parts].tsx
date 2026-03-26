import type { GetServerSideProps } from 'next';

import { buildNewsUrl } from '../../lib/newsRoutes';
import { unwrapArticle } from '../../lib/publicNewsApi';
import { getLocalizedArticleFields, normalizeRouteLocale, type RouteLocale } from '../../lib/localizedArticleFields';

function normalizeLang(value: unknown): 'en' | 'hi' | 'gu' {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

function getRequestOrigin(ctx: any): string {
  const req = ctx.req;
  const protoHeader = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = protoHeader || 'http';
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim();
  if (!host) return '';
  return `${proto}://${host}`;
}

export default function LegacyNewsRedirectPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const lang = normalizeLang(ctx.locale);
  const partsRaw = (ctx.params as any)?.parts;
  const parts = Array.isArray(partsRaw) ? partsRaw.map((p) => String(p || '').trim()).filter(Boolean) : [];

  // Only handle legacy multi-segment URLs like /news/:id/:slug
  if (parts.length < 2) {
    return { notFound: true };
  }

  const idCandidate = parts[0];
  const slugCandidate = parts[parts.length - 1];

  const origin = getRequestOrigin(ctx);
  if (!origin) return { notFound: true };

  const attempts: RouteLocale[] = [lang, 'en', 'hi', 'gu'].filter((v, idx, arr) => arr.indexOf(v) === idx) as RouteLocale[];

  const fetchById = async (attemptLang: RouteLocale): Promise<any | null> => {
    const qs = new URLSearchParams();
    qs.set('lang', attemptLang);
    qs.set('language', attemptLang);
    const endpoint = `${origin}/api/public/news/${encodeURIComponent(idCandidate)}?${qs.toString()}`;
    const res = await fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return unwrapArticle(data);
  };

  const fetchBySlug = async (attemptLang: RouteLocale): Promise<any | null> => {
    const qs = new URLSearchParams();
    qs.set('lang', attemptLang);
    qs.set('language', attemptLang);
    const endpoint = `${origin}/api/public/news/slug/${encodeURIComponent(slugCandidate)}?${qs.toString()}`;
    const res = await fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
    const data = await res.json().catch(() => null);
    return unwrapArticle(data);
  };

  try {
    let found: any | null = null;
    let foundLang: RouteLocale | null = null;

    for (const attemptLang of attempts) {
      const article = await fetchById(attemptLang);
      if (article?._id) {
        found = article;
        foundLang = attemptLang;
        break;
      }
    }

    if (!found) {
      for (const attemptLang of attempts) {
        const article = await fetchBySlug(attemptLang);
        if (article?._id) {
          found = article;
          foundLang = attemptLang;
          break;
        }
      }
    }

    if (!found?._id || !foundLang) return { notFound: true };

    const localized = getLocalizedArticleFields(found, foundLang);
    if (!localized.isVisible) return { notFound: true };

    const id = String(found._id || '').trim();
    const destination = buildNewsUrl({ id, slug: localized.slug || id, lang: normalizeRouteLocale(foundLang) });

    return {
      redirect: {
        destination,
        permanent: true,
      },
    };
  } catch {
    return { notFound: true };
  }
};
