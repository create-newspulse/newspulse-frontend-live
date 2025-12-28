import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import sanitizeHtml from 'sanitize-html';

import {
  fetchPublicStoryByIdOrSlug,
  getApiBaseUrl,
  getStoryCategoryLabel,
  getStoryDateIso,
  type PublicStory,
} from '../../lib/publicStories';

type Props = {
  story: PublicStory;
  baseUrl: string;
  safeHtml: string;
  publishedAtLabel: string;
  messages: any;
  locale: string;
};

function formatPublishedAtLabel(iso?: string) {
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
    // Fallback to ISO (deterministic) if Intl options unsupported
    return d.toISOString();
  }
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

export default function StoryDetailPage({ story, safeHtml, publishedAtLabel }: Props) {
  const title = story.title || 'Story';
  const summary = story.summary || '';
  const category = getStoryCategoryLabel(story.category);
  const language = story.language || '';
  const publishedAt = publishedAtLabel;

  return (
    <>
      <Head>
        <title>{`${title} | News Pulse`}</title>
      </Head>

      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">{title}</h1>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {category ? (
                <span>
                  <span className="font-semibold">Category:</span> {category}
                </span>
              ) : null}
              {language ? (
                <span>
                  <span className="font-semibold">Language:</span> {language}
                </span>
              ) : null}
              {publishedAt ? (
                <span>
                  <span className="font-semibold">Published:</span> {publishedAt}
                </span>
              ) : null}
            </div>

            {summary ? <p className="text-lg text-slate-700">{summary}</p> : null}
          </div>

          <hr className="my-8" />

          <article className="prose prose-slate max-w-none">
            {/* Content is HTML from backend; sanitized to disallow scripts */}
            <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
          </article>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const idOrSlug = String(ctx.params?.idOrSlug || '').trim();
  if (!idOrSlug) return { notFound: true };

  const locale = (ctx.locale || 'en') as string;
  const { getMessages } = await import('../../lib/getMessages');
  const messages = await getMessages(locale);

  const baseUrl = getApiBaseUrl();
  const story = await fetchPublicStoryByIdOrSlug(idOrSlug, baseUrl);
  if (!story) return { notFound: true };

  const html =
    (typeof story.content === 'string' && story.content) ||
    ((story as any).html as string) ||
    ((story as any).body as string) ||
    '';

  const safeHtml = sanitizeContent(html);
  const publishedAtLabel = formatPublishedAtLabel(getStoryDateIso(story));

  return {
    props: {
      story,
      baseUrl,
      safeHtml,
      publishedAtLabel,
      messages,
      locale,
    },
  };
};
