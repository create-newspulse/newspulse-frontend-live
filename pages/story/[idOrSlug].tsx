import type { GetServerSideProps, NextPage } from 'next';

type Props = Record<string, never>;

function buildQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (value === null) continue;

    if (Array.isArray(value)) {
      for (const v of value) {
        if (v === undefined || v === null) continue;
        params.append(key, String(v));
      }
      continue;
    }

    params.set(key, String(value));
  }

  const s = params.toString();
  return s ? `?${s}` : '';
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const slugParam = (ctx.params as any)?.idOrSlug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  if (!slug || typeof slug !== 'string') {
    return { notFound: true };
  }

  // Force Gujarati destination regardless of source locale.
  const localePrefix = '/gu';

  const { idOrSlug: _omit, ...restQuery } = (ctx.query as any) || {};
  const qs = buildQueryString(restQuery);

  const destination = `${localePrefix}/news/${encodeURIComponent(slug)}${qs}`;

  // Force 301 (Next's redirect helper uses 308 for permanent redirects).
  ctx.res.statusCode = 301;
  ctx.res.setHeader('Location', destination);
  ctx.res.end();

  return { props: {} };
};

const StoryDetailPage: NextPage = () => null;

export default StoryDetailPage;
