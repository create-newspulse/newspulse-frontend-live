import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import sanitizeHtml from 'sanitize-html';

import { fetchArticleBySlugOrId } from '../../lib/publicNewsApi';

type Article = {
  _id: string;
  title?: string;
  slug?: string;
  summary?: string;
  excerpt?: string;
  content?: string;
  html?: string;
  body?: string;
  image?: string;
  imageUrl?: string;
  createdAt?: string;
  publishedAt?: string;
  category?: string;
  language?: string;
};

type Props = {
  article?: Article;
  safeHtml?: string;
  error?: string;
  messages: any;
  locale: string;
};

function getApiOrigin() {
  const origin =
    process.env.NEXT_PUBLIC_API_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:5000';

  return String(origin).replace(/\/+$/, '');
}

function unwrapArticle(payload: any): Article | null {
  if (!payload) return null;
  if (payload.article && typeof payload.article === 'object') return payload.article as Article;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data as Article;
  if (typeof payload === 'object' && !Array.isArray(payload) && payload._id) return payload as Article;
  return null;
}

function sanitizeContent(html: string) {
  return sanitizeHtml(html || '', {
    disallowedTagsMode: 'discard',
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'b',
      'i',
      'u',
      's',
      'blockquote',
      'code',
      'pre',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'a',
      'span',
      'div',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      '*': ['class', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  });
}

function formatWhenLabel(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const slug = String(ctx.params?.slug || '').trim();
  if (!slug) return { notFound: true };

  const locale = (ctx.locale || 'en') as string;
  const { getMessages } = await import('../../lib/getMessages');
  const messages = await getMessages(locale);

  try {
    const { article, error, status } = await fetchArticleBySlugOrId({ slugOrId: slug });
    if (!article?._id) {
      return { props: { error: error || (status === 404 ? 'Article not found' : 'Unable to load article'), messages, locale } };
    }

    const html =
      (typeof article.content === 'string' && article.content) ||
      ((article as any).html as string) ||
      ((article as any).body as string) ||
      '';

    const safeHtml = sanitizeContent(html);

    return { props: { article, safeHtml, messages, locale } };
  } catch {
    return { props: { error: 'Fetch failed', messages, locale } };
  }
};

export default function NewsDetailPage({ article, safeHtml, error }: Props) {
  const title = article?.title || 'News';
  const summary = article?.summary || article?.excerpt || '';
  const when = formatWhenLabel(article?.publishedAt || article?.createdAt);
  const image = article?.imageUrl || article?.image || '';

  return (
    <>
      <Head>
        <title>{title} | News Pulse</title>
      </Head>

      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="mb-6">
            <Link href="/" className="text-sm text-slate-600 hover:underline">
              ← Back
            </Link>
          </div>

          {error ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
              <div className="font-semibold">Unable to load article</div>
              <div className="mt-1">{error}</div>
              <div className="mt-2 text-sm text-slate-600">
                Ensure the backend is running and NEXT_PUBLIC_API_ORIGIN points to it.
              </div>
            </div>
          ) : null}

          {article ? (
            <>
              <header className="space-y-3">
                <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">{title}</h1>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  {article.category ? (
                    <span>
                      <span className="font-semibold">Category:</span> {article.category}
                    </span>
                  ) : null}
                  {article.language ? (
                    <span>
                      <span className="font-semibold">Language:</span> {article.language}
                    </span>
                  ) : null}
                  {when ? (
                    <span>
                      <span className="font-semibold">Published:</span> {when}
                    </span>
                  ) : null}
                </div>

                {summary ? <p className="text-lg text-slate-700">{summary}</p> : null}

                {image ? (
                  <div className="mt-4 aspect-[16/9] overflow-hidden rounded-xl bg-slate-100">
                    <img src={image} alt={title} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ) : null}
              </header>

              <hr className="my-8" />

              <article className="prose prose-slate max-w-none">
                <div dangerouslySetInnerHTML={{ __html: safeHtml || '' }} />
              </article>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}
