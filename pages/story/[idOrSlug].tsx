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

export default function StoryDetailPage() {
  // Legacy route: this page always redirects in getStaticProps.
  return null;
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps = async (ctx) => {
  const raw = String((ctx.params as any)?.idOrSlug || '').trim();
  if (!raw) return { notFound: true, revalidate: 10 };

  const idOrSlug = safeDecodeURIComponent(raw).trim();
  if (!idOrSlug) return { notFound: true, revalidate: 10 };

  const locale = (ctx.locale || 'en') as string;
  const requestedLang = String(locale || 'en').toLowerCase().trim();

  const { article } = await fetchArticleBySlugOrId({ slugOrId: idOrSlug, language: requestedLang });
  if (!article?._id) return { notFound: true, revalidate: 10 };

  const destination = buildNewsUrl({ id: article._id, slug: article.slug || article._id, lang: requestedLang });
  return {
    redirect: {
      destination,
      permanent: false,
    },
    revalidate: 60,
  };
};
