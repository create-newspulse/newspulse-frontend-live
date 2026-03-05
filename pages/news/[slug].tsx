import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import React from 'react';
import sanitizeHtml from 'sanitize-html';
import { useRouter } from 'next/router';

import OriginalTag from '../../components/OriginalTag';
import AdSlot from '../../components/ads/AdSlot';
import CategoryHeader from '../../src/components/category/CategoryHeader';
import { resolveArticleSummaryOrExcerpt, type UiLang } from '../../lib/contentFallback';
import { unwrapArticle, type Article } from '../../lib/publicNewsApi';
import { localizeArticle } from '../../lib/localizeArticle';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { tHeading, toLanguageKey } from '../../utils/localizedNames';
import { resolveArticleSlug } from '../../lib/articleSlugs';
import { buildNewsUrl } from '../../lib/newsRoutes';
import { COVER_PLACEHOLDER_SRC, resolveCoverImageUrl } from '../../lib/coverImages';

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

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function stripQueryHash(path: string): string {
  const raw = String(path || '/');
  const noHash = raw.split('#')[0] || '/';
  const noQuery = noHash.split('?')[0] || '/';
  return noQuery || '/';
}

function localePrefix(lang: 'en' | 'hi' | 'gu'): '' | '/hi' | '/gu' {
  return lang === 'en' ? '' : (lang === 'hi' ? '/hi' : '/gu');
}

function tagList(tags: any): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t || '').toLowerCase().trim()).filter(Boolean);
  if (typeof tags === 'string') {
    return tags
      .split(/[;,|]/g)
      .map((t) => String(t || '').toLowerCase().trim())
      .filter(Boolean);
  }
  return [];
}

function slugifyTopic(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function resolveCategoryKey(article: Article | null): string {
  const raw = String((article as any)?.category || '').trim().toLowerCase();
  if (!raw) return '';
  // Keep only safe path segments.
  if (!/^[a-z0-9-]+$/.test(raw)) return '';
  return raw;
}

function categoryLabelFromKey(key: string): string {
  if (!key) return 'News';
  return key
    .split('-')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
}

type Props = {
  messages: any;
  locale: string;
  lang: 'en' | 'hi' | 'gu';
  article: Article | null;
  safeHtml: string;
  topStories: Article[];
  relatedStories: Article[];
  error?: string | null;
};

export default function NewsSlugDetailPage({ lang, article, safeHtml, topStories, relatedStories, error }: Props) {
  const { t } = useI18n();
  const router = useRouter();

  const tx = React.useCallback(
    (key: string, fallback: string) => {
      try {
        const v = t(key);
        if (!v) return fallback;
        if (v === key) return fallback;
        return v;
      } catch {
        return fallback;
      }
    },
    [t]
  );

  const uiLang = toUiLang(lang);
  const summaryRes = resolveArticleSummaryOrExcerpt(article || {}, uiLang);
  const rawTitle = cleanText((article as any)?.title);
  const cleanedTitle = rawTitle || 'News';
  const summary = String(summaryRes.text || (article as any)?.summary || (article as any)?.excerpt || '').trim();

  const displayTitle = cleanedTitle.length > 180 ? `${cleanedTitle.slice(0, 177).trimEnd()}…` : cleanedTitle;
  const displaySummary = cleanText(summary);

  const heroSrc = resolveCoverImageUrl(article) || COVER_PLACEHOLDER_SRC;

  const prefix = React.useMemo(() => localePrefix(lang), [lang]);
  const categoryKey = React.useMemo(() => resolveCategoryKey(article), [article]);
  const categoryLabel = React.useMemo(() => categoryLabelFromKey(categoryKey), [categoryKey]);

  const homeHref = React.useMemo(() => (prefix ? prefix : '/'), [prefix]);
  const categoryHref = React.useMemo(() => (categoryKey ? `${prefix}/${categoryKey}`.replace(/\/\//g, '/') : ''), [categoryKey, prefix]);

  const categoryHeaderTitle = React.useMemo(() => {
    const langKey = toLanguageKey(lang);
    if (!categoryKey) return categoryLabel;
    try {
      const out = tHeading(langKey as any, categoryKey as any);
      const text = String(out || '').trim();
      return text || categoryLabel;
    } catch {
      return categoryLabel;
    }
  }, [categoryKey, categoryLabel]);

  const categoryHeaderSubtitle = React.useMemo(() => {
    // Keep it compact; use i18n if present, else plain English.
    if (categoryKey === 'national') return tx('nationalPage.newsFeed', 'News Feed');
    return 'News Feed';
  }, [categoryKey, tx]);

  const categorySearchPlaceholder = React.useMemo(() => {
    if (categoryKey === 'national') return tx('nationalPage.searchPlaceholder', 'Search National news…');
    if (categoryKey) return `Search ${categoryHeaderTitle}…`;
    return 'Search news…';
  }, [categoryHeaderTitle, categoryKey, tx]);

  const canonicalUrl = React.useMemo(() => {
    if (!article?._id) return '';
    const canonicalSlug = resolveArticleSlug(article, lang);
    const path = buildNewsUrl({ id: String(article._id || '').trim(), slug: canonicalSlug, lang });
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return base ? `${base}${path}` : path;
  }, [article, lang]);

  const shareThis = async () => {
    const url = canonicalUrl || (typeof window !== 'undefined' ? stripQueryHash(window.location.href) : '');
    const shareTitle = String(displayTitle || 'News Pulse').trim();
    if (!url) return;

    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
        if (typeof nav.share === 'function') {
          await nav.share({ title: shareTitle, url });
          return;
        }
      }
    } catch {
      // ignore
    }

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  };

  const trendingTopics = React.useMemo(() => {
    const counts = new Map<string, number>();
    const pushTags = (tags: any) => {
      for (const tag of tagList(tags)) {
        if (!tag || tag.length < 3) continue;
        if (tag === 'breaking') continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    };

    pushTags((article as any)?.tags);
    for (const s of topStories || []) pushTags((s as any)?.tags);
    for (const s of relatedStories || []) pushTags((s as any)?.tags);

    const out: Array<[string, number]> = [];
    counts.forEach((v, k) => out.push([k, v]));
    return out
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);
  }, [article, relatedStories, topStories]);

  return (
    <>
      <Head>
        <title>{`${displayTitle || 'News'} | News Pulse`}</title>
      </Head>

      <main className="min-h-screen bg-white">
        <CategoryHeader
          categorySlug={categoryKey || 'news'}
          title={categoryHeaderTitle}
          subtitle={categoryHeaderSubtitle}
          langPrefix={prefix as '' | '/hi' | '/gu' | '/en'}
          variant="compact"
          showBrowseStates={categoryKey === 'national'}
          browseStatesLabel={tx('nationalPage.browseStates', 'Browse states →')}
          showSearch
          searchPlaceholder={categorySearchPlaceholder}
        />

        <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main */}
            <section className="lg:col-span-8">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="px-4 md:px-6 pt-4 md:pt-5 pb-4">
                  {/* Breadcrumbs */}
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                    <a href={homeHref} className="hover:underline">{tx('common.home', 'Home')}</a>
                    <span className="text-slate-300">›</span>
                    {categoryKey ? (
                      <a href={categoryHref} className="hover:underline">{categoryLabel}</a>
                    ) : (
                      <span>{categoryLabel}</span>
                    )}
                    {(() => {
                      const state = String((article as any)?.state || (article as any)?.region || '').trim();
                      const district = String((article as any)?.district || '').trim();
                      if (!state && !district) return null;
                      return (
                        <>
                          <span className="text-slate-300">›</span>
                          <span className="truncate max-w-[55vw]">{[state, district].filter(Boolean).join(' • ')}</span>
                        </>
                      );
                    })()}
                  </div>

                  <div className="mt-2 flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 leading-tight">
                      {displayTitle}
                    </h1>

                    {error ? <div className="text-sm text-red-600">{error}</div> : null}

                    {displaySummary ? (
                      <p className="text-base md:text-lg text-slate-700">
                        {displaySummary} {summaryRes.isOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={shareThis}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        {tx('common.share', 'Share')}
                      </button>
                      {Array.isArray((article as any)?.tags) && (article as any)?.tags?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {tagList((article as any)?.tags)
                            .slice(0, 6)
                            .map((tag) => (
                              <a
                                key={tag}
                                href={`${prefix}/topic/${encodeURIComponent(slugifyTopic(tag))}?q=${encodeURIComponent(tag)}`.replace(/\/\//g, '/')}
                                className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                              >
                                #{tag}
                              </a>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="px-4 md:px-6 pb-5">
                  <div className="relative h-56 md:h-72 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={heroSrc}
                      alt={displayTitle}
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.onerror = null;
                        img.src = COVER_PLACEHOLDER_SRC;
                      }}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="eager"
                    />
                  </div>
                </div>

                <div className="px-4 md:px-6 pb-6">
                  <article className="prose prose-slate max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
                  </article>
                </div>
              </div>

              {/* Below-article: Related */}
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold text-slate-900">{tx('common.relatedStories', 'Related Stories')}</div>
                </div>

                {relatedStories && relatedStories.length ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {relatedStories.slice(0, 6).map((s, idx) => {
                      const id = String(s?._id || '').trim();
                      const slug = resolveArticleSlug(s, lang);
                      const href = id ? buildNewsUrl({ id, slug, lang }) : '#';
                      const img = resolveCoverImageUrl(s) || COVER_PLACEHOLDER_SRC;
                      const titleText = cleanText((s as any)?.title) || String(t('common.untitled') || 'Untitled').trim();
                      const excerptRes = resolveArticleSummaryOrExcerpt(s || {}, uiLang);
                      const excerpt = String(excerptRes.text || (s as any)?.summary || (s as any)?.excerpt || '').trim();
                      return (
                        <a
                          key={id || String((s as any)?.slug || idx)}
                          href={href}
                          className="group rounded-2xl border border-slate-200 bg-white shadow-sm hover:bg-slate-50 overflow-hidden"
                        >
                          <div className="flex gap-3 p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img}
                              alt=""
                              loading="lazy"
                              onError={(e) => {
                                const imgEl = e.currentTarget;
                                imgEl.onerror = null;
                                imgEl.src = COVER_PLACEHOLDER_SRC;
                              }}
                              className="h-20 w-28 rounded-xl border border-slate-200 bg-slate-100 object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="line-clamp-2 text-sm font-bold text-slate-900 group-hover:underline">{titleText}</div>
                              {excerpt ? <div className="mt-1 line-clamp-2 text-xs text-slate-600">{excerpt}</div> : null}
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{tx('common.noResults', 'No related stories yet.')}</div>
                )}
              </div>
            </section>

            {/* Sidebar */}
            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-4 space-y-4">
                {/* Top Stories */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-200">
                    <div className="text-sm font-extrabold text-slate-900">{tx('common.topStories', 'Top Stories')}</div>
                  </div>
                  <div className="p-2">
                    {topStories && topStories.length ? (
                      topStories.slice(0, 8).map((s, i) => {
                        const id = String(s?._id || '').trim();
                        const slug = resolveArticleSlug(s, lang);
                        const href = id ? buildNewsUrl({ id, slug, lang }) : '#';
                        const titleText = cleanText((s as any)?.title) || String(t('common.untitled') || 'Untitled').trim();
                        return (
                          <a
                            key={id || String((s as any)?.slug || i)}
                            href={href}
                            className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"
                          >
                            <div className="shrink-0 text-xs font-black text-slate-500 w-5 text-right">{i + 1}</div>
                            <div className="min-w-0">
                              <div className="line-clamp-2 text-sm font-semibold text-slate-900">{titleText}</div>
                            </div>
                          </a>
                        );
                      })
                    ) : (
                      <div className="p-3 text-sm text-slate-600">{tx('common.loading', 'Loading…')}</div>
                    )}
                  </div>
                </div>

                {/* Trending Topics */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-200">
                    <div className="text-sm font-extrabold text-slate-900">{tx('common.trending', 'Trending Topics')}</div>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2">
                    {trendingTopics.length ? (
                      trendingTopics.map((topic) => (
                        <a
                          key={topic}
                          href={`${prefix}/topic/${encodeURIComponent(slugifyTopic(topic))}?q=${encodeURIComponent(topic)}`.replace(/\/\//g, '/')}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          #{topic}
                        </a>
                      ))
                    ) : (
                      <div className="text-sm text-slate-600">{tx('common.noResults', 'No topics yet.')}</div>
                    )}
                  </div>
                </div>

                {/* Live Updates (mini) */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-200">
                    <div className="text-sm font-extrabold text-slate-900">{tx('common.liveUpdates', 'Live Updates')}</div>
                  </div>
                  <div className="p-4 space-y-2 text-sm">
                    <a href={`${prefix}/breaking`.replace(/\/\//g, '/')} className="block text-slate-800 hover:underline">{tx('common.breaking', 'Breaking')}</a>
                    <a href={`${prefix}/live-updates`.replace(/\/\//g, '/')} className="block text-slate-800 hover:underline">{tx('common.liveUpdates', 'Live Updates')}</a>
                    {categoryKey ? (
                      <a href={`${prefix}/${categoryKey}`.replace(/\/\//g, '/')} className="block text-slate-800 hover:underline">{categoryLabel}</a>
                    ) : null}
                  </div>
                </div>

                {/* Ad */}
                <AdSlot slot="HOME_RIGHT_300x250" />

                {/* Related list */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="px-4 py-3 border-b border-slate-200">
                    <div className="text-sm font-extrabold text-slate-900">{tx('common.relatedStories', 'Related Stories')}</div>
                  </div>
                  <div className="p-2">
                    {relatedStories && relatedStories.length ? (
                      relatedStories.slice(0, 6).map((s, i) => {
                        const id = String(s?._id || '').trim();
                        const slug = resolveArticleSlug(s, lang);
                        const href = id ? buildNewsUrl({ id, slug, lang }) : '#';
                        const titleText = cleanText((s as any)?.title) || String(t('common.untitled') || 'Untitled').trim();
                        return (
                          <a
                            key={id || String((s as any)?.slug || i)}
                            href={href}
                            className="block rounded-xl px-2 py-2 hover:bg-slate-50"
                          >
                            <div className="line-clamp-2 text-sm font-semibold text-slate-900">{titleText}</div>
                          </a>
                        );
                      })
                    ) : (
                      <div className="p-3 text-sm text-slate-600">{tx('common.noResults', 'No related stories yet.')}</div>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
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
      props: { messages, locale, lang, article: null, safeHtml: '', topStories: [], relatedStories: [], error: 'Not found' },
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
        props: { messages, locale, lang, article: null, safeHtml: '', topStories: [], relatedStories: [], error: 'Not found' },
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

    const extra = await (async () => {
      try {
        const categoryKey = resolveCategoryKey(article);
        const limit = 24;
        const params = new URLSearchParams();
        if (categoryKey) params.set('category', categoryKey);
        params.set('lang', lang);
        params.set('language', lang);
        params.set('limit', String(limit));

        const endpoint = `${API_BASE}/api/public/news?${params.toString()}`;
        const res = await fetch(endpoint, { method: 'GET', headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => null);
        const itemsRaw =
          Array.isArray(data) ? data :
          Array.isArray(data?.items) ? data.items :
          Array.isArray(data?.articles) ? data.articles :
          Array.isArray(data?.data) ? data.data :
          [];

        const items: Article[] = Array.isArray(itemsRaw) ? (itemsRaw as Article[]) : [];
        const currentId = String((article as any)?._id || '').trim();

        const filtered = items.filter((x) => String((x as any)?._id || '').trim() && String((x as any)?._id || '').trim() !== currentId);

        const top = [...filtered];
        top.sort((a, b) => (Number((b as any)?.reads || 0) || 0) - (Number((a as any)?.reads || 0) || 0));

        const related = filtered.slice(0, 12);

        return {
          topStories: top.slice(0, 10),
          relatedStories: related,
        };
      } catch {
        return { topStories: [], relatedStories: [] };
      }
    })();

    return {
      props: {
        messages,
        locale,
        lang,
        article,
        safeHtml: sanitizeContent(html),
        topStories: extra.topStories,
        relatedStories: extra.relatedStories,
        error: null,
      },
    };
  } catch {
    return {
      props: { messages, locale, lang, article: null, safeHtml: '', topStories: [], relatedStories: [], error: 'Fetch failed' },
    };
  }
};
