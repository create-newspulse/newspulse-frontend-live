import React, { useMemo, useRef, useState } from "react";
import Link from 'next/link';
import type { GetStaticProps } from 'next';

import { fetchPublicNews, type Article } from '../lib/publicNewsApi';
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle, type UiLang } from '../lib/contentFallback';
import OriginalTag from '../components/OriginalTag';
import { useLanguage } from '../utils/LanguageContext';
import { useI18n } from '../src/i18n/LanguageProvider';

// Preview-only component you can paste into:
// - Next.js App Router: /app/search/page.tsx (export default)
// - Next.js Pages Router: /pages/search.tsx (export default)
//
// Integrate with your real API by replacing `mockSearch()` with your existing search fetch.

type SearchItem = {
  id: string;
  title: string;
  titleIsOriginal?: boolean;
  summary?: string;
  summaryIsOriginal?: boolean;
  category?: string;
  publishedAt?: string;
};

const SUGGESTIONS = [
  "budget",
  "cricket",
  "Delhi",
  "Gujarat",
  "gold rates",
  "fuel prices",
  "weather",
  "markets",
  "Tech & AI",
];

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function formatDateLikeUI(d?: string) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    return dt.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function toSearchItem(a: Article, requestedLang: UiLang): SearchItem | null {
  const titleRes = resolveArticleTitle(a as any, requestedLang);
  const title = String(titleRes.text || '').trim();
  if (!title) return null;

  const id = String(a?._id || a?.slug || '').trim();
  if (!id) return null;

  const summaryRes = resolveArticleSummaryOrExcerpt(a as any, requestedLang);
  const summary = String(summaryRes.text || '').trim() || undefined;
  const category = String((a as any)?.category || '').trim() || undefined;
  const publishedAt =
    String((a as any)?.publishedAt || (a as any)?.createdAt || '').trim() || undefined;

  return {
    id,
    title,
    titleIsOriginal: titleRes.isOriginal,
    summary,
    summaryIsOriginal: summaryRes.isOriginal,
    category,
    publishedAt,
  };
}

function SearchInput({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useI18n();

  React.useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Cmd/Ctrl + K to focus (nice UX)
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if (isK && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        onClear();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClear]);

  return (
    <div className="w-full">
      <div className="relative">
        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="opacity-60"
          >
            <path
              d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M16.5 16.5 21 21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          placeholder={placeholder ?? t('searchPage.placeholder')}
          className={cx(
            "w-full rounded-2xl border border-black/10 bg-white px-12 py-4",
            "text-base shadow-sm outline-none",
            "focus:border-black/20 focus:shadow-md",
            "transition"
          )}
        />

        {/* Clear button */}
        {value.trim().length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-[108px] top-1/2 -translate-y-1/2 rounded-xl px-2 py-2 hover:bg-black/5"
            aria-label={t('searchPage.clearSearch')}
            title={t('searchPage.clearEsc')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="opacity-70"
            >
              <path
                d="M6 6 18 18M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {/* Search CTA */}
        <button
          type="button"
          onClick={onSubmit}
          className={cx(
            "absolute right-2 top-1/2 -translate-y-1/2",
            "rounded-xl px-4 py-2 text-sm font-semibold",
            "bg-black text-white shadow-sm",
            "hover:opacity-90 active:opacity-80",
            "transition"
          )}
        >
          {t('common.search')}
        </button>

        {/* Shortcut hint */}
        <div className="pointer-events-none absolute right-2 -bottom-7 flex items-center gap-2 text-xs text-black/50">
          <span className="hidden sm:inline">{t('searchPage.tip')}</span>
          <span className="hidden sm:inline-flex rounded-md border border-black/10 bg-white px-2 py-0.5">
            Ctrl
          </span>
          <span className="hidden sm:inline">+</span>
          <span className="hidden sm:inline-flex rounded-md border border-black/10 bg-white px-2 py-0.5">
            K
          </span>
          <span className="hidden sm:inline">{t('searchPage.tipToFocus')}</span>
        </div>
      </div>
    </div>
  );
}

function SuggestionChips({
  onPick,
  items,
}: {
  onPick: (v: string) => void;
  items: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className={cx(
            "rounded-full border border-black/10 bg-white px-3 py-1.5",
            "text-sm text-black/75 hover:bg-black/5",
            "transition"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function ResultCard({ item }: { item: SearchItem }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-base font-semibold leading-snug">
            <span>{item.title}</span>
            {item.titleIsOriginal ? <OriginalTag /> : null}
          </div>
          {item.summary && (
            <div className="mt-1 text-sm text-black/70">
              <span>{item.summary}</span>
              {item.summaryIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {item.category && (
            <span className="rounded-full border border-black/10 bg-black/5 px-2.5 py-1 text-xs font-medium">
              {item.category}
            </span>
          )}
          {item.publishedAt && (
            <span className="text-xs text-black/50">{formatDateLikeUI(item.publishedAt)}</span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/news/${encodeURIComponent(item.id)}`}
          className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
        >
          {t('common.read')}
        </Link>
        <button className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:bg-black/5 transition">{t('common.listen')}</button>
        <button className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:bg-black/5 transition">{t('common.share')}</button>
      </div>
    </div>
  );
}

export default function SearchPagePreview() {
  const { language } = useLanguage();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchItem[]>([]);

  const canSearch = query.trim().length >= 2;

  const hint = useMemo(() => {
    if (!query.trim()) return t('searchPage.hintEmpty');
    if (query.trim().length === 1) return t('searchPage.hintOneMore');
    return t('searchPage.hintReady');
  }, [query, t]);

  const runSearch = async (signal?: AbortSignal) => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchPublicNews({ q, language, limit: 20, signal });
      if (signal?.aborted) return;
      if (resp.error) {
        setError(resp.error || t('searchPage.searchFailed'));
        setResults([]);
        return;
      }

      const mapped = (resp.items || []).map((a) => toSearchItem(a, language)).filter(Boolean) as SearchItem[];
      setResults(mapped);
    } catch (e: any) {
      if (signal?.aborted) return;
      setError(e?.message || t('searchPage.searchFailed'));
      setResults([]);
    } finally {
      if (signal?.aborted) return;
      setLoading(false);
    }
  };

  // Debounced search (feels modern, but doesn’t spam)
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      runSearch(controller.signal);
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, language]);

  return (
    <div className="min-h-[calc(100vh-60px)] bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Header */}
        <div className="text-center">
          <div className="text-3xl font-extrabold tracking-tight">{t('searchPage.title')}</div>
          <div className="mt-2 text-sm text-black/60">
            {t('searchPage.subtitle')}
          </div>
        </div>

        {/* Search box */}
        <div className="mx-auto mt-8 max-w-3xl">
          <SearchInput
            value={query}
            onChange={setQuery}
            onSubmit={runSearch}
            onClear={() => {
              setQuery("");
              setResults([]);
              setError(null);
            }}
            autoFocus
          />

          <div className="mt-10 rounded-3xl border border-black/10 bg-white/70 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-black/60">{hint}</div>
              <div className="text-xs text-black/45">
                {t('searchPage.showing')} <span className="font-semibold text-black/70">{results.length}</span> {t('searchPage.results')}
              </div>
            </div>

            {/* Suggestions (only when empty) */}
            {!query.trim() && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold text-black/50">{t('searchPage.quickSuggestions')}</div>
                <SuggestionChips
                  items={SUGGESTIONS}
                  onPick={(v) => {
                    setQuery(v);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="mx-auto mt-8 max-w-3xl">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[118px] rounded-2xl border border-black/10 bg-white animate-pulse"
                />
              ))}
            </div>
          )}

          {!loading && canSearch && results.length === 0 && !error && (
            <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/60">
              {t('searchPage.noResults')}{' '}
              <span className="font-semibold text-black/80">“{query.trim()}”</span>.
              <div className="mt-3">{t('searchPage.tryDifferent')}</div>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-3">
              {results.map((r) => (
                <ResultCard key={r.id} item={r} />
              ))}
            </div>
          )}

          {!loading && !query.trim() && (
            <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/60">
              {t('searchPage.startTyping')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import('../lib/getMessages');
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};
