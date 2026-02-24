import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import React from 'react';
import sanitizeHtml from 'sanitize-html';
import { useRouter } from 'next/router';

import OriginalTag from '../../../components/OriginalTag';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle, type UiLang } from '../../../lib/contentFallback';
import { localizeArticle } from '../../../lib/localizeArticle';
import { unwrapArticle, type Article } from '../../../lib/publicNewsApi';
import { useI18n } from '../../../src/i18n/LanguageProvider';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://newspulse-backend-real.onrender.com';

type Props = {
  lang: 'en' | 'hi' | 'gu';
  article: Article | null;
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
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

function normalizeLang(value: unknown): 'en' | 'hi' | 'gu' {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function NewsDetailPage({
  lang,
  article,
  safeHtml,
  publishedAtLabel,
  resolvedTitle,
  resolvedSummary,
  titleIsOriginal,
  summaryIsOriginal,
}: Props) {
  const { t } = useI18n();
  const langForText = toUiLang(lang);

  const { title: localizedTitle, content: localizedContent } = React.useMemo(
    () => localizeArticle(article || {}, lang),
    [article, lang]
  );

  const titleRes = React.useMemo(() => resolveArticleTitle(article || {}, langForText), [article, langForText]);
  const summaryRes = React.useMemo(() => resolveArticleSummaryOrExcerpt(article || {}, langForText), [article, langForText]);

  const title =
    String(localizedTitle || '').trim() ||
    String(resolvedTitle || '').trim() ||
    String(titleRes.text || '').trim() ||
    String(article?.title || '').trim() ||
    'News';

  const summary =
    String(resolvedSummary || '').trim() ||
    String(summaryRes.text || '').trim() ||
    String(article?.summary || '').trim() ||
    String(article?.excerpt || '').trim() ||
    '';

  const effectiveTitleIsOriginal = titleIsOriginal || titleRes.isOriginal;
  const effectiveSummaryIsOriginal = summaryIsOriginal || summaryRes.isOriginal;

  const publishedAt = publishedAtLabel || formatPublishedAtLabel(String(article?.publishedAt || article?.createdAt || '').trim());

  const coverImageUrl =
    String(article?.coverImageUrl || '').trim() ||
    String(article?.imageUrl || '').trim() ||
    String(article?.image || '').trim() ||
    '';

  const languageLabel = React.useMemo(() => {
    if (lang === 'gu') return 'Gujarati';
    if (lang === 'hi') return 'Hindi';
    return 'English';
  }, [lang]);

  return (
    <>
      <Head>
        <title>{`${title} | News Pulse`}</title>
      </Head>

      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-10">
          {!article ? (
            <div className="text-sm text-slate-600">Not found</div>
          ) : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
                {title} {effectiveTitleIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
              </h1>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>
                <span className="font-semibold">{t('newsDetail.languageLabel')}</span> {languageLabel}
              </span>
              {publishedAt ? (
                <span>
                  <span className="font-semibold">{t('newsDetail.publishedLabel')}</span> {publishedAt}
                </span>
              ) : null}
            </div>

            {summary ? (
              <p className="text-lg text-slate-700">
                {summary} {effectiveSummaryIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
              </p>
            ) : null}

            {coverImageUrl ? (
              <div className="relative mt-4 h-64 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <Image
                  src={coverImageUrl}
                  alt={title}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                />
              </div>
            ) : null}
          </div>

          <hr className="my-8" />

          <article className="prose prose-slate max-w-none">
            <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
          </article>
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps<Props> = async (ctx) => {
  // IMPORTANT: This route is /news/:id/:slug, but the first param name must match
  // the sibling /news/[slug].tsx to satisfy Next.js routing rules.
  // Treat `params.slug` as the article id.
  const rawId = String((ctx.params as any)?.slug || '').trim();
  if (!rawId) return { notFound: true as const, revalidate: 10 };

  const id = safeDecodeURIComponent(rawId).trim();
  if (!id) return { notFound: true as const, revalidate: 10 };

  const locale = (ctx.locale || 'en') as string;
  const lang = normalizeLang(locale);

  const messages = await (async () => {
    try {
      const { getMessages } = await import('../../../lib/getMessages');
      return await getMessages(lang);
    } catch {
      return {};
    }
  })();

  try {
    const params = new URLSearchParams();
    params.set('lang', lang);
    params.set('language', lang);

    const endpoint = `${API_BASE}/api/public/news/${encodeURIComponent(id)}?${params.toString()}`;
    const res = await fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => null);
    const article = unwrapArticle(data);

    if (!res.ok || !article?._id) {
      return {
        props: {
          lang,
          article: null,
          safeHtml: '',
          publishedAtLabel: '',
          resolvedTitle: '',
          resolvedSummary: '',
          titleIsOriginal: false,
          summaryIsOriginal: false,
          messages,
          locale,
        },
        revalidate: 10,
      };
    }

    const requestedLang = toUiLang(lang);
    const titleRes = resolveArticleTitle(article, requestedLang);
    const summaryRes = resolveArticleSummaryOrExcerpt(article, requestedLang);

    const { content } = localizeArticle(article, lang);
    const html =
      (typeof content === 'string' && content) ||
      (typeof article.content === 'string' && article.content) ||
      ((article as any).html as string) ||
      ((article as any).body as string) ||
      '';

    const safeHtml = sanitizeContent(html);
    const publishedAtLabel = formatPublishedAtLabel(String(article.publishedAt || article.createdAt || '').trim());

    return {
      props: {
        lang,
        article,
        safeHtml,
        publishedAtLabel,
        resolvedTitle: titleRes.text,
        resolvedSummary: summaryRes.text,
        titleIsOriginal: titleRes.isOriginal,
        summaryIsOriginal: summaryRes.isOriginal,
        messages,
        locale,
      },
      revalidate: 10,
    };
  } catch {
    return {
      props: {
        lang,
        article: null,
        safeHtml: '',
        publishedAtLabel: '',
        resolvedTitle: '',
        resolvedSummary: '',
        titleIsOriginal: false,
        summaryIsOriginal: false,
        messages,
        locale,
      },
      revalidate: 10,
    };
  }
};
