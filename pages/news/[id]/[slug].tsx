import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import React from 'react';
import sanitizeHtml from 'sanitize-html';
import { useRouter } from 'next/router';

import OriginalTag from '../../../components/OriginalTag';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle, type UiLang } from '../../../lib/contentFallback';
import { fetchPublicNewsById, type Article } from '../../../lib/publicNewsApi';
import { localizeArticle } from '../../../lib/localizeArticle';
import { useI18n } from '../../../src/i18n/LanguageProvider';
import { useLanguage } from '../../../utils/LanguageContext';
import { buildNewsUrl } from '../../../lib/newsRoutes';

type Props = {
  article: Article;
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
  if (v === 'hi' || v === 'hindi') return 'hi';
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

export default function NewsDetailPage({ article, safeHtml, publishedAtLabel, resolvedTitle, resolvedSummary, titleIsOriginal, summaryIsOriginal }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const { language } = useLanguage();

  const [activeLang, setActiveLang] = React.useState<'en' | 'hi' | 'gu'>(() => {
    const v = String(language || '').toLowerCase().trim();
    if (v === 'hi' || v === 'gu' || v === 'en') return v as any;
    return 'en';
  });
  const [activeArticle, setActiveArticle] = React.useState<Article>(article);

  const translation = React.useMemo(() => {
    const translations = (activeArticle as any)?.translations as Record<string, any> | undefined;
    const t = translations?.[activeLang];
    return t && typeof t === 'object' ? t : null;
  }, [activeArticle, activeLang]);

  const localized = React.useMemo(() => localizeArticle(activeArticle, activeLang), [activeArticle, activeLang]);

  const title =
    String(localized.title || '').trim() ||
    String(translation?.title || '').trim() ||
    String(resolvedTitle || '').trim() ||
    String(activeArticle.title || '').trim() ||
    'News';

  const summary =
    String(translation?.summary || '').trim() ||
    String(translation?.excerpt || '').trim() ||
    String(resolvedSummary || '').trim() ||
    String(activeArticle.summary || '').trim() ||
    String(activeArticle.excerpt || '').trim() ||
    '';

  const rawHtml =
    (typeof translation?.content === 'string' && translation.content) ||
    (typeof translation?.html === 'string' && translation.html) ||
    (typeof translation?.body === 'string' && translation.body) ||
    (typeof activeArticle.content === 'string' && activeArticle.content) ||
    ((activeArticle as any).html as string) ||
    ((activeArticle as any).body as string) ||
    '';

  const activeSafeHtml = React.useMemo(() => {
    if (!rawHtml) return safeHtml;
    return sanitizeContent(rawHtml);
  }, [rawHtml, safeHtml]);

  const activePublishedAtLabel = React.useMemo(() => {
    return publishedAtLabel || formatPublishedAtLabel(String(activeArticle.publishedAt || activeArticle.createdAt || '').trim());
  }, [activeArticle.createdAt, activeArticle.publishedAt, publishedAtLabel]);

  const langForText = toUiLang(activeLang);
  const titleRes = React.useMemo(() => resolveArticleTitle(activeArticle, langForText), [activeArticle, langForText]);
  const summaryRes = React.useMemo(() => resolveArticleSummaryOrExcerpt(activeArticle, langForText), [activeArticle, langForText]);

  const effectiveTitleIsOriginal = titleIsOriginal || titleRes.isOriginal;
  const effectiveSummaryIsOriginal = summaryIsOriginal || summaryRes.isOriginal;

  React.useEffect(() => {
    setActiveArticle(article);
  }, [article, publishedAtLabel, resolvedSummary, resolvedTitle, safeHtml, summaryIsOriginal, titleIsOriginal]);

  const publishedAt = activePublishedAtLabel;

  const coverImageUrl =
    String(translation?.coverImageUrl || '').trim() ||
    String(translation?.imageUrl || '').trim() ||
    String(translation?.image || '').trim() ||
    String(activeArticle.coverImageUrl || '').trim() ||
    String(activeArticle.imageUrl || '').trim() ||
    String(activeArticle.image || '').trim() ||
    '';

  const languageLabel = React.useMemo(() => {
    if (activeLang === 'gu') return 'Gujarati';
    if (activeLang === 'hi') return 'Hindi';
    return 'English';
  }, [activeLang]);

  const onSwitchLanguage = async (nextLang: 'en' | 'hi' | 'gu') => {
    setActiveLang(nextLang);

    // Keep URL locale in sync for UI strings/SEO, but do it shallowly so we don't refetch SSR props.
    // Default behavior: stay on the same article id/slug.
    try {
      const destination = buildNewsUrl({
        id: String(activeArticle._id || '').trim(),
        slug: String(activeArticle.slug || activeArticle._id || '').trim(),
        lang: nextLang,
      });
      await router.replace(destination, destination, { locale: nextLang, shallow: true, scroll: false });
    } catch {
      // ignore
    }

    const id = String(activeArticle._id || '').trim();
    if (!id) return;

    try {
      const res = await fetch(`/api/public/news/${encodeURIComponent(id)}/translate`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lang: nextLang }),
      });

      const json = await res.json().catch(() => null);
      const nextArticle = json && typeof json === 'object' ? (json as any).data : null;
      if (!nextArticle || typeof nextArticle !== 'object') return;

      setActiveArticle(nextArticle as Article);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <Head>
        <title>{`${title} | News Pulse`}</title>
      </Head>

      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
                {title} {effectiveTitleIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
              </h1>

              <div className="shrink-0">
                <select
                  value={activeLang}
                  onChange={(e) => onSwitchLanguage(e.target.value as any)}
                  aria-label={t('common.language')}
                  className="border rounded-lg px-3 py-2 font-medium bg-white shadow text-gray-800"
                >
                  <option value="gu">📰 ગુજરાતી</option>
                  <option value="hi">🇮🇳 हिन्दी</option>
                  <option value="en">🌐 English</option>
                </select>
              </div>
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
            <div dangerouslySetInnerHTML={{ __html: activeSafeHtml }} />
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
  const rawId = String((ctx.params as any)?.id || '').trim();
  if (!rawId) return { notFound: true as const, revalidate: 10 };

  const id = safeDecodeURIComponent(rawId).trim();
  if (!id) return { notFound: true as const, revalidate: 10 };

  const locale = (ctx.locale || 'en') as string;
  const { getMessages } = await import('../../../lib/getMessages');
  const messages = await getMessages(locale);

  const requestedLang = toUiLang(locale);

  const { article } = await fetchPublicNewsById({ id, language: requestedLang });
  if (!article) return { notFound: true as const, revalidate: 10 };

  const titleRes = resolveArticleTitle(article, requestedLang);
  const summaryRes = resolveArticleSummaryOrExcerpt(article, requestedLang);

  const html =
    (typeof article.content === 'string' && article.content) ||
    ((article as any).html as string) ||
    ((article as any).body as string) ||
    '';

  const safeHtml = sanitizeContent(html);
  const publishedAtLabel = formatPublishedAtLabel(String(article.publishedAt || article.createdAt || '').trim());

  return {
    props: {
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
};
