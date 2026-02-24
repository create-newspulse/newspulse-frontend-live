import type { GetServerSideProps } from 'next';

import { buildNewsUrl } from '../../lib/newsRoutes';
import { unwrapArticle } from '../../lib/publicNewsApi';
import { resolveArticleSlug } from '../../lib/articleSlugs';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://newspulse-backend-real.onrender.com';

function normalizeLang(value: unknown): 'en' | 'hi' | 'gu' {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
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

  const tryFetchById = async (): Promise<any | null> => {
    const qs = new URLSearchParams();
    qs.set('lang', lang);
    qs.set('language', lang);

    const endpoint = `${API_BASE}/api/public/news/${encodeURIComponent(idCandidate)}?${qs.toString()}`;
    const res = await fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => null);
    if (!res.ok) return null;
    return unwrapArticle(data);
  };

  const tryFetchBySlug = async (): Promise<any | null> => {
    const attempt = async (attemptLang: 'en' | 'hi' | 'gu'): Promise<any | null> => {
      const qs = new URLSearchParams();
      qs.set('lang', attemptLang);
      qs.set('language', attemptLang);

      const endpoint = `${API_BASE}/api/public/news/slug/${encodeURIComponent(slugCandidate)}?${qs.toString()}`;
      const res = await fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => null);
      if (!res.ok) return null;
      return unwrapArticle(data);
    };

    const attempts: Array<'en' | 'hi' | 'gu'> = [lang, 'en', 'hi', 'gu'].filter(
      (v, idx, arr) => arr.indexOf(v) === idx
    ) as Array<'en' | 'hi' | 'gu'>;

    for (const attemptLang of attempts) {
      const article = await attempt(attemptLang);
      if (article?._id) return article;
    }

    return null;
  };

  try {
    const article = (await tryFetchById()) || (await tryFetchBySlug());
    if (!article?._id) return { notFound: true };

    const canonicalSlug = resolveArticleSlug(article, lang);
    const destination = buildNewsUrl({ id: String(article._id || '').trim(), slug: canonicalSlug, lang });

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
