import type { GetStaticProps } from 'next';
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

function normalizeLang(value: unknown): 'en' | 'hi' | 'gu' {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'hi' || v === 'gu' || v === 'en') return v as any;
  return 'en';
}

type Props = {
  messages: any;
  locale: string;
};

export default function NewsSlugDetailPage() {
  const { t } = useI18n();
  const router = useRouter();

  const slug = React.useMemo(() => {
    const raw = router.query.slug;
    if (Array.isArray(raw)) return String(raw[0] || '').trim();
    return String(raw || '').trim();
  }, [router.query.slug]);

  const lang = React.useMemo(() => normalizeLang(router.query.lang), [router.query.lang]);

  const [loading, setLoading] = React.useState(false);
  const [article, setArticle] = React.useState<Article | null>(null);
  const [safeHtml, setSafeHtml] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!router.isReady) return;
    if (!slug) return;

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = `/api/public/news/slug/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`;
        const res = await fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' } });
        const json = await res.json().catch(() => null);
        const next = unwrapArticle(json);
        if (cancelled) return;
        if (!next?._id) {
          setArticle(null);
          setSafeHtml('');
          setError('Not found');
          return;
        }

        const html =
          (typeof next.content === 'string' && next.content) ||
          ((next as any).html as string) ||
          ((next as any).body as string) ||
          '';

        setArticle(next);
        setSafeHtml(sanitizeContent(html));
      } catch {
        if (!cancelled) {
          setError('Fetch failed');
          setArticle(null);
          setSafeHtml('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, slug, lang]);

  const onSwitchLanguage = async (nextLang: 'en' | 'hi' | 'gu') => {
    if (!slug) return;
    const nextQuery = { ...router.query, lang: nextLang };
    await router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true, scroll: false });
  };

  const uiLang = toUiLang(lang);
  const titleRes = resolveArticleTitle(article || {}, uiLang);
  const summaryRes = resolveArticleSummaryOrExcerpt(article || {}, uiLang);
  const localized = React.useMemo(() => localizeArticle(article || {}, lang), [article, lang]);
  const title = String(localized.title || titleRes.text || article?.title || 'News').trim();
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

              <div className="shrink-0">
                <select
                  value={lang}
                  onChange={(e) => onSwitchLanguage(normalizeLang(e.target.value) as any)}
                  aria-label={t('common.language')}
                  className="border rounded-lg px-3 py-2 font-medium bg-white shadow text-gray-800"
                >
                  <option value="gu">📰 ગુજરાતી</option>
                  <option value="hi">🇮🇳 हिन्दी</option>
                  <option value="en">🌐 English</option>
                </select>
              </div>
            </div>

            {loading ? <div className="text-sm text-slate-500">Loading…</div> : null}
            {error && !loading ? <div className="text-sm text-red-600">{error}</div> : null}

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

export const getStaticProps: GetStaticProps<Props> = async ({ locale }) => {
  const { getMessages } = await import('../../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
      locale: String(locale || 'en'),
    },
  };
};
