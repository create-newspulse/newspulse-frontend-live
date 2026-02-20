import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import sanitizeHtml from 'sanitize-html';

import { resolveArticleSummaryOrExcerpt, resolveArticleTitle, type UiLang } from '../../lib/contentFallback';
import OriginalTag from '../../components/OriginalTag';
import { useI18n } from '../../src/i18n/LanguageProvider';

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
  resolvedTitle?: string;
  resolvedSummary?: string;
  titleIsOriginal?: boolean;
  summaryIsOriginal?: boolean;
  messages: any;
  locale: string;
};

function getApiOrigin() {
  const origin = process.env.NEXT_PUBLIC_API_BASE || '';
  return String(origin).trim().replace(/\/+$/, '');
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getRequestOrigin(req: any): string {
  const proto = String(req?.headers?.['x-forwarded-proto'] || 'http')
    .split(',')[0]
    .trim();
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').trim();
  if (!host) return '';
  return `${proto}://${host}`;
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

function toUiLang(value: unknown): UiLang {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const rawSlug = String(ctx.params?.slug || '').trim();
  if (!rawSlug) return { notFound: true };

  // Next.js gives decoded params in many cases, but be defensive.
  const decodedSlug = safeDecodeURIComponent(rawSlug).trim();
  if (!decodedSlug) return { notFound: true };

  const locale = (ctx.locale || 'en') as string;
  const { getMessages } = await import('../../lib/getMessages');
  const messages = await getMessages(locale);

  // Route prefix is the source of truth (en/hi/gu).
  const requestedLang = toUiLang(locale);

  try {
    const origin = getRequestOrigin(ctx.req);
    const langParam = `?lang=${encodeURIComponent(requestedLang)}`;
    const encodedSlug = encodeURIComponent(decodedSlug);

    const endpoint = origin
      ? `${origin}/api/public/news/slug/${encodedSlug}${langParam}`
      : `${getApiOrigin()}/api/public/news/slug/${encodedSlug}${langParam}`;

    const upstream = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const payload = await upstream.json().catch(() => null);
    const article = unwrapArticle(payload);

    if (!article?._id) {
      return {
        props: {
          error: upstream.status === 404 ? 'newsDetail.articleNotFound' : 'newsDetail.unableToLoadTitle',
          messages,
          locale,
        },
      };
    }

    const titleRes = resolveArticleTitle(article, requestedLang);
    const summaryRes = resolveArticleSummaryOrExcerpt(article, requestedLang);

    const html =
      (typeof article.content === 'string' && article.content) ||
      ((article as any).html as string) ||
      ((article as any).body as string) ||
      '';

    const safeHtml = sanitizeContent(html);

    return {
      props: {
        article,
        safeHtml,
        resolvedTitle: titleRes.text,
        resolvedSummary: summaryRes.text,
        titleIsOriginal: titleRes.isOriginal,
        summaryIsOriginal: summaryRes.isOriginal,
        messages,
        locale,
      },
    };
  } catch {
    return { props: { error: 'newsDetail.fetchFailed', messages, locale } };
  }
};

export default function NewsDetailPage({ article, safeHtml, error, resolvedTitle, resolvedSummary, titleIsOriginal, summaryIsOriginal }: Props) {
  const { t } = useI18n();
  const title = resolvedTitle || article?.title || 'News';
  const summary = resolvedSummary || article?.summary || article?.excerpt || '';
  const when = formatWhenLabel(article?.publishedAt || article?.createdAt);
  const image = article?.imageUrl || article?.image || '';

  const errorLabel = error && error.startsWith('newsDetail.') ? t(error) : error;

  return (
    <>
      <Head>
        <title>{title} | News Pulse</title>
      </Head>

      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="mb-6">
            <Link href="/" className="text-sm text-slate-600 hover:underline">
              {t('newsDetail.back')}
            </Link>
          </div>

          {error ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
              <div className="font-semibold">{t('newsDetail.unableToLoadTitle')}</div>
              <div className="mt-1">{errorLabel}</div>
              <div className="mt-2 text-sm text-slate-600">
                {t('newsDetail.ensureBackendRunning')}
              </div>
            </div>
          ) : null}

          {article ? (
            <>
              <header className="space-y-3">
                <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
                  {title} {titleIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
                </h1>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  {article.category ? (
                    <span>
                      <span className="font-semibold">{t('newsDetail.categoryLabel')}</span> {article.category}
                    </span>
                  ) : null}
                  {article.language ? (
                    <span>
                      <span className="font-semibold">{t('newsDetail.languageLabel')}</span> {article.language}
                    </span>
                  ) : null}
                  {when ? (
                    <span>
                      <span className="font-semibold">{t('newsDetail.publishedLabel')}</span> {when}
                    </span>
                  ) : null}
                </div>

                {summary ? (
                  <p className="text-lg text-slate-700">
                    {summary} {summaryIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
                  </p>
                ) : null}

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
