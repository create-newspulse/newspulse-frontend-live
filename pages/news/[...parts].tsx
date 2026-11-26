import type { GetServerSideProps } from 'next';
import ErrorPage from 'next/error';
import { withPublicReadDeadline } from '../../lib/publicReadDeadline';
import { anonymousArticleGet } from '../../lib/publicArticleRequest';
import { getArticleReaderOrigin } from '../../lib/articleSeo.server';

import { buildNewsUrl } from '../../lib/newsRoutes';
import { isLegacyMissingArticle, parsePublicNewsArticle, type Article } from '../../lib/publicNewsApi';
import { getLocalizedArticleFields, normalizeRouteLocale, type RouteLocale } from '../../lib/localizedArticleFields';

function normalizeLang(value: unknown): 'en' | 'hi' | 'gu' {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

export default function LegacyNewsRedirectPage({ unavailable = false }: { unavailable?: boolean }) {
  return unavailable ? <ErrorPage statusCode={503} /> : null;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const lang = normalizeLang(ctx.locale);
  const partsRaw = ctx.params?.parts;
  const parts = Array.isArray(partsRaw) ? partsRaw.map((p) => String(p || '').trim()).filter(Boolean) : [];

  // Only handle legacy multi-segment URLs like /news/:id/:slug
  if (parts.length < 2) {
    return { notFound: true };
  }

  const idCandidate = parts[0];
  const slugCandidate = parts[parts.length - 1];

  const attempts: RouteLocale[] = [lang, 'en', 'hi', 'gu'].filter((v, idx, arr) => arr.indexOf(v) === idx) as RouteLocale[];

  try {
    const origin = getArticleReaderOrigin(ctx.req);
    return await withPublicReadDeadline(4000, async (signal) => {
      let pending = false;
      for (const path of [encodeURIComponent(idCandidate), `slug/${encodeURIComponent(slugCandidate)}`]) {
        for (const attemptLang of attempts) {
          const qs = new URLSearchParams({ lang: attemptLang, language: attemptLang });
          const res = await fetch(`${origin}/api/public/news/${path}?${qs}`, anonymousArticleGet(signal));
          if (res.status === 404 || res.status === 410) continue;
          if (!res.ok) throw new Error('Article upstream unavailable');
          const data: unknown = await res.json();
          signal.throwIfAborted();
          if (isLegacyMissingArticle(data)) continue;
          // Only the local slug reader can emit these legacy envelopes.
          if (path.startsWith('slug/') && data && typeof data === 'object') {
            if ('article' in data && data.article === null && Object.keys(data).length === 1) continue;
            if ('status' in data && (data.status === 'pending' || data.status === 'translating') &&
                Object.keys(data).every(key => key === 'status' || key === 'sourceLang')) {
              pending = true;
              continue;
            }
          }
          const article: Article | null = parsePublicNewsArticle(data);
          if (!article) throw new Error('Invalid article response');
          const localized = getLocalizedArticleFields(article, attemptLang);
          if (!localized.isVisible) return { notFound: true };
          const destination = buildNewsUrl({ id: article._id, slug: localized.slug || article._id, lang: normalizeRouteLocale(attemptLang) });
          return { redirect: { destination, permanent: true } };
        }
      }
      if (pending) throw new Error('Public edition pending');
      return { notFound: true };
    });
  } catch {
    ctx.res.statusCode = 503;
    ctx.res.setHeader('Cache-Control', 'no-store');
    ctx.res.setHeader('Retry-After', '30');
    return { props: { unavailable: true } };
  }
};
