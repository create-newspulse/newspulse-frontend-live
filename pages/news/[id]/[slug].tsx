import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import React from 'react';
import sanitizeHtml from 'sanitize-html';
import { useRouter } from 'next/router';

import OriginalTag from '../../../components/OriginalTag';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle, type UiLang } from '../../../lib/contentFallback';
import { fetchPublicNewsById, fetchPublicNewsTranslation, type Article } from '../../../lib/publicNewsApi';
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
  const [activeSafeHtml, setActiveSafeHtml] = React.useState<string>(safeHtml);
  const [activePublishedAtLabel, setActivePublishedAtLabel] = React.useState<string>(publishedAtLabel);
  const [activeResolvedTitle, setActiveResolvedTitle] = React.useState<string>(resolvedTitle);
  const [activeResolvedSummary, setActiveResolvedSummary] = React.useState<string>(resolvedSummary);
  const [activeTitleIsOriginal, setActiveTitleIsOriginal] = React.useState<boolean>(titleIsOriginal);
  const [activeSummaryIsOriginal, setActiveSummaryIsOriginal] = React.useState<boolean>(summaryIsOriginal);

  React.useEffect(() => {
    setActiveArticle(article);
    setActiveSafeHtml(safeHtml);
    setActivePublishedAtLabel(publishedAtLabel);
    setActiveResolvedTitle(resolvedTitle);
    setActiveResolvedSummary(resolvedSummary);
    setActiveTitleIsOriginal(titleIsOriginal);
    setActiveSummaryIsOriginal(summaryIsOriginal);
  }, [article, publishedAtLabel, resolvedSummary, resolvedTitle, safeHtml, summaryIsOriginal, titleIsOriginal]);

  const title = activeResolvedTitle || activeArticle.title || 'News';
  const summary = activeResolvedSummary || activeArticle.summary || activeArticle.excerpt || '';
  const publishedAt = activePublishedAtLabel;

  const coverImageUrl =
    String(activeArticle.coverImageUrl || '').trim() ||
    String(activeArticle.imageUrl || '').trim() ||
    String(activeArticle.image || '').trim() ||
    '';

  const translationKey = String(activeArticle.translationKey || activeArticle.translationGroupId || '').trim();

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

    if (!translationKey) return;

    try {
      const { article: translated } = await fetchPublicNewsTranslation({ translationKey, language: nextLang });
      if (!translated?._id) return;

      // Update URL to match the translated article (still shallow).
      try {
        const destination = buildNewsUrl({
          id: String(translated._id || '').trim(),
          slug: String(translated.slug || translated._id || '').trim(),
          lang: nextLang,
        });
        await router.replace(destination, destination, { locale: nextLang, shallow: true, scroll: false });
      } catch {
        // ignore
      }

      const langForText = toUiLang(nextLang);
      const titleRes = resolveArticleTitle(translated, langForText);
      const summaryRes = resolveArticleSummaryOrExcerpt(translated, langForText);

      const html =
        (typeof translated.content === 'string' && translated.content) ||
        ((translated as any).html as string) ||
        ((translated as any).body as string) ||
        '';

      setActiveArticle(translated);
      setActiveResolvedTitle(titleRes.text);
      setActiveResolvedSummary(summaryRes.text);
      setActiveTitleIsOriginal(titleRes.isOriginal);
      setActiveSummaryIsOriginal(summaryRes.isOriginal);
      setActiveSafeHtml(sanitizeContent(html));
      setActivePublishedAtLabel(formatPublishedAtLabel(String(translated.publishedAt || translated.createdAt || '').trim()));
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
                {title} {titleIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
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
              {String(activeArticle.language || '').trim() ? (
                <span>
                  <span className="font-semibold">{t('newsDetail.languageLabel')}</span> {String(activeArticle.language || '').trim()}
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
