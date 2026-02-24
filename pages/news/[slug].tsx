import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import React from 'react';
import sanitizeHtml from 'sanitize-html';
import { useRouter } from 'next/router';

import OriginalTag from '../../components/OriginalTag';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle, type UiLang } from '../../lib/contentFallback';
import { unwrapArticle, type Article } from '../../lib/publicNewsApi';
import { localizeArticle } from '../../lib/localizeArticle';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { resolveArticleSlug } from '../../lib/articleSlugs';
import { buildNewsUrl } from '../../lib/newsRoutes';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://newspulse-backend-real.onrender.com';

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
  if (v === 'en' || v === 'english') return 'en';
  return 'en';
}

type Props = {
  messages: any;
  locale: string;
  lang: 'en' | 'hi' | 'gu';
  article: Article | null;
  safeHtml: string;
  error?: string | null;
};

export default function NewsSlugDetailPage({ lang, article, safeHtml, error }: Props) {
  const { t } = useI18n();
  const router = useRouter();

  const uiLang = toUiLang(lang);
  const titleRes = resolveArticleTitle(article || {}, uiLang);
  const summaryRes = resolveArticleSummaryOrExcerpt(article || {}, uiLang);
  const { title: localizedTitle, content: localizedContent } = React.useMemo(() => localizeArticle(article || {}, lang), [article, lang]);
  const title = String(localizedTitle || titleRes.text || article?.title || 'News').trim();
  const summary = String(summaryRes.text || article?.summary || article?.excerpt || '').trim();

  const coverImageUrl =
    String(article?.coverImageUrl || '').trim() ||
    String(article?.imageUrl || '').trim() ||
    String(article?.image || '').trim() ||
    '';

  return (
    <>
      <Head>
        <title>{`${title || 'News'} | News Pulse`}</title>
      </Head>

      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
                {title} {titleRes.isOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
              </h1>
            </div>

            {error ? <div className="text-sm text-red-600">{error}</div> : null}

            {summary ? (
              <p className="text-lg text-slate-700">
                {summary} {summaryRes.isOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
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

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const lang = normalizeLang(ctx.locale);
  const locale = String(ctx.locale || lang);

  const messages = await (async () => {
    try {
      const { getMessages } = await import('../../lib/getMessages');
      return await getMessages(lang);
    } catch {
      return {};
    }
  })();

  const rawSlug = String((ctx.params as any)?.slug || '').trim();
  if (!rawSlug) {
    return {
      props: { messages, locale, lang, article: null, safeHtml: '', error: 'Not found' },
    };
  }

  try {
    const fetchBySlug = async (requestedLang: 'en' | 'hi' | 'gu'): Promise<{ resOk: boolean; article: any | null }> => {
      const params = new URLSearchParams();
      params.set('lang', requestedLang);
      params.set('language', requestedLang);

      const endpoint = `${API_BASE}/api/public/news/slug/${encodeURIComponent(rawSlug)}?${params.toString()}`;
      const res = await fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => null);
      const article = unwrapArticle(data);
      return { resOk: res.ok, article };
    };

    // First try the requested locale; if backend doesn't recognize the slug for that lang,
    // try other langs to support redirects from historical wrong-language slugs.
    const attempts: Array<'en' | 'hi' | 'gu'> = [lang, 'en', 'hi', 'gu'].filter(
      (v, idx, arr) => arr.indexOf(v) === idx
    ) as Array<'en' | 'hi' | 'gu'>;

    let article: any | null = null;
    for (const attemptLang of attempts) {
      const out = await fetchBySlug(attemptLang);
      if (out.resOk && out.article?._id) {
        article = out.article;
        break;
      }
    }

    if (!article?._id) {
      return {
        props: { messages, locale, lang, article: null, safeHtml: '', error: 'Not found' },
      };
    }

    // Canonicalize slug per language
    const canonicalSlug = resolveArticleSlug(article, lang);
    if (canonicalSlug && canonicalSlug !== rawSlug) {
      const destination = buildNewsUrl({ id: String(article._id || '').trim(), slug: canonicalSlug, lang });
      return { redirect: { destination, permanent: true } };
    }

    const { content } = localizeArticle(article, lang);
    const html =
      (typeof content === 'string' && content) ||
      (typeof (article as any).content === 'string' && (article as any).content) ||
      ((article as any).html as string) ||
      ((article as any).body as string) ||
      '';

    return {
      props: {
        messages,
        locale,
        lang,
        article,
        safeHtml: sanitizeContent(html),
        error: null,
      },
    };
  } catch {
    return {
      props: { messages, locale, lang, article: null, safeHtml: '', error: 'Fetch failed' },
    };
  }
};
