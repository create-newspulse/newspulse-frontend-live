import type { GetStaticPaths, GetStaticProps } from 'next';

import { fetchArticleBySlugOrId } from '../../lib/publicNewsApi';
import { buildNewsUrl } from '../../lib/newsRoutes';

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function LegacyNewsSlugPage() {
  // Legacy route: this page always redirects in getStaticProps.
  return null;
}

export const getStaticPaths: GetStaticPaths = async () => {
  return { paths: [], fallback: 'blocking' };
};

export const getStaticProps: GetStaticProps = async (ctx) => {
  const raw = String((ctx.params as any)?.slug || '').trim();
  if (!raw) return { notFound: true as const, revalidate: 60 };

  const slugOrId = safeDecodeURIComponent(raw).trim();
  if (!slugOrId) return { notFound: true as const, revalidate: 60 };

  const locale = String(ctx.locale || 'en').toLowerCase().trim();

  const { article } = await fetchArticleBySlugOrId({ slugOrId, language: locale });
  if (!article?._id) return { notFound: true as const, revalidate: 60 };

  const destination = buildNewsUrl({ id: article._id, slug: article.slug || article._id, lang: locale });

  return {
    redirect: {
      destination,
      permanent: false,
    },
    revalidate: 60,
  };
};
