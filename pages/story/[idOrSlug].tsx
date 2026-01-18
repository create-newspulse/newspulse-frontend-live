import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import sanitizeHtml from 'sanitize-html';

import OriginalTag from '../../components/OriginalTag';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle, type UiLang } from '../../lib/contentFallback';

import {
  fetchPublicStoryByIdOrSlug,
  getApiBaseUrl,
  getStoryCategoryLabel,
  getStoryDateIso,
  type PublicStory,
} from '../../lib/publicStories';
import { useI18n } from '../../src/i18n/LanguageProvider';

type Props = {
  story: PublicStory;
  baseUrl: string;
  safeHtml: string;
  publishedAtLabel: string;
  resolvedTitle: string;
  resolvedSummary: string;
  titleIsOriginal: boolean;
  summaryIsOriginal: boolean;
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

function toUiLang(value: unknown): UiLang {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

export default function StoryDetailPage({ story, safeHtml, publishedAtLabel, resolvedTitle, resolvedSummary, titleIsOriginal, summaryIsOriginal }: Props) {
  const { t } = useI18n();
  const title = resolvedTitle || story.title || 'Story';
  const summary = resolvedSummary || story.summary || '';
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
            <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
              {title} {titleIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
            </h1>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              {category ? (
                <span>
                  <span className="font-semibold">{t('newsDetail.categoryLabel')}</span> {category}
                </span>
              ) : null}
              {language ? (
                <span>
                  <span className="font-semibold">{t('newsDetail.languageLabel')}</span> {language}
                </span>
              ) : null}
              {publishedAt ? (
                <span>
                  <span className="font-semibold">{t('newsDetail.publishedLabel')}</span> {publishedAt}
                </span>
              ) : null}
            </div>

            {summary ? (
              <p className="text-lg text-slate-700">
                {summary} {summaryIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
              </p>
            ) : null}
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
  const requestedLang = toUiLang(ctx.req.cookies?.np_lang || ctx.query?.lang || locale);
  const story = await fetchPublicStoryByIdOrSlug(idOrSlug, baseUrl, { language: requestedLang });
  if (!story) return { notFound: true };

  const titleRes = resolveArticleTitle(story, requestedLang);
  const summaryRes = resolveArticleSummaryOrExcerpt(story, requestedLang);

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
      resolvedTitle: titleRes.text,
      resolvedSummary: summaryRes.text,
      titleIsOriginal: titleRes.isOriginal,
      summaryIsOriginal: summaryRes.isOriginal,
      messages,
      locale,
    },
  };
};
