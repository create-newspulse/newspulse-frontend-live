import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';

import { usePublicAdSlot } from '../hooks/usePublicAdSlot';
import { usePublicTicker } from '../hooks/usePublicTicker';
import { useI18n } from '../src/i18n/LanguageProvider';
import { resolveArticleSlug } from '../lib/articleSlugs';
import { buildNewsUrl } from '../lib/newsRoutes';

const BREAKING_ACCENT = '#DC2626';
const LIVE_ACCENT = '#2563EB';

function resolveBroadcastSource(raw: any): string {
  const candidates = [raw?.source, raw?.sourceName, raw?.publisher, raw?.brand, raw?.channel];
  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (text) return text;
  }
  return '';
}

function resolveBroadcastArticleHref(raw: any, lang: 'en' | 'hi' | 'gu'): string | null {
  const articleCandidate = raw?.linkedArticle || raw?.article || raw?.news || raw?.targetArticle || raw?.destinationArticle || null;

  const idCandidates = [
    articleCandidate?._id,
    articleCandidate?.id,
    raw?.linkedArticleId,
    raw?.articleId,
    raw?.newsId,
    raw?.targetArticleId,
    raw?.destinationArticleId,
  ];

  const slugCandidates = [
    articleCandidate?.slug,
    articleCandidate ? resolveArticleSlug(articleCandidate, lang) : '',
    raw?.linkedArticleSlug,
    raw?.articleSlug,
    raw?.newsSlug,
    raw?.targetArticleSlug,
    raw?.destinationArticleSlug,
  ];

  const articleId = idCandidates.map((value) => String(value || '').trim()).find(Boolean) || '';
  const articleSlug = slugCandidates.map((value) => String(value || '').trim()).find(Boolean) || '';

  if (!articleId && !articleSlug) return null;
  return buildNewsUrl({ id: articleId || articleSlug, slug: articleSlug || articleId, lang });
}

function parseBroadcastTimestamp(raw: unknown): number | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

function resolveTimelineTimestampMs(item: { ts?: number | null; raw?: any }): number | null {
  const raw = item?.raw;
  const dateText = String(raw?.date || '').trim();
  const timeText = String(raw?.time || '').trim();
  const candidates: Array<number | null> = [
    parseBroadcastTimestamp(raw?.publishedAt),
    parseBroadcastTimestamp(raw?.createdAt),
    parseBroadcastTimestamp(raw?.updatedAt),
    dateText && timeText ? parseBroadcastTimestamp(`${dateText} ${timeText}`) : null,
    parseBroadcastTimestamp(timeText),
    parseBroadcastTimestamp(dateText),
    typeof item?.ts === 'number' && Number.isFinite(item.ts) ? item.ts : null,
  ];

  for (const candidate of candidates) {
    if (candidate !== null) return candidate;
  }

  return null;
}

function resolveTimelineTimeLabel(item: { timeText?: string; raw?: any }): string {
  if (String(item?.timeText || '').trim()) return String(item?.timeText || '').trim();

  const raw = item?.raw;
  const dateText = String(raw?.date || '').trim();
  const timeText = String(raw?.time || '').trim();

  if (dateText && timeText) return `${dateText} ${timeText}`;
  if (timeText) return timeText;
  if (dateText) return dateText;

  return '';
}

function sortTimelineItems<T extends { ts?: number | null; raw?: any }>(items: T[]): T[] {
  return [...items]
    .map((item, index) => ({ item, index, ts: resolveTimelineTimestampMs(item) }))
    .sort((a, b) => {
      if (a.ts !== null && b.ts !== null && a.ts !== b.ts) return b.ts - a.ts;
      if (a.ts !== null && b.ts === null) return -1;
      if (a.ts === null && b.ts !== null) return 1;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

function normalizeTab(value: unknown): 'breaking' | 'live' | null {
  const s = Array.isArray(value) ? String(value[0] || '') : String(value || '');
  const v = s.toLowerCase().trim();
  if (v === 'breaking') return 'breaking';
  if (v === 'live') return 'live';
  return null;
}

type SectionSponsor = {
  brand: string;
  targetUrl: string;
};

function resolveSponsorName(ad: any): string {
  const normalizeLabel = (value: unknown): string => {
    const text = String(value || '').trim();
    if (!text) return '';
    const upper = text.toUpperCase();
    if (/^(?:[A-Z0-9]+_)+[A-Z0-9]+$/.test(text) && text === upper) return '';
    return text;
  };

  const candidates = [ad?.brandName, ad?.title, ad?.name, ad?.advertiserName];
  for (const candidate of candidates) {
    const value = normalizeLabel(candidate);
    if (value) return value;
  }
  return '';
}

function useSectionSponsor(slot: 'BREAKING_SPONSOR' | 'LIVE_UPDATE_SPONSOR', lang: 'en' | 'hi' | 'gu') {
  const { enabled, ad } = usePublicAdSlot({
    slot,
    language: lang,
    allowWithoutImage: true,
  });

  if (!enabled || !ad) return null;

  const brand = resolveSponsorName(ad);
  const targetUrl = String(ad.targetUrl || ad.clickUrl || ad.url || '').trim();
  if (!brand || !targetUrl) return null;

  return { brand, targetUrl } satisfies SectionSponsor;
}

function SectionSponsorLink({ slot, sponsor }: { slot: 'BREAKING_SPONSOR' | 'LIVE_UPDATE_SPONSOR'; sponsor: SectionSponsor | null }) {
  void slot;
  if (!sponsor) return null;

  return (
    <a
      href={sponsor.targetUrl}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="hidden md:flex text-[11px] opacity-90 text-slate-700 whitespace-nowrap hover:opacity-100"
      title={`Sponsored by ${sponsor.brand}`}
    >
      Sponsored by <span className="font-semibold max-w-[180px] inline-block align-middle truncate">{sponsor.brand}</span>
    </a>
  );
}

export default function BreakingPage() {
  const router = useRouter();
  const { lang, t } = useI18n();

  const tickerLang = lang === 'gu' ? 'gu' : lang === 'hi' ? 'hi' : 'en';
  const breakingSponsor = useSectionSponsor('BREAKING_SPONSOR', tickerLang);
  const liveSponsor = useSectionSponsor('LIVE_UPDATE_SPONSOR', tickerLang);

  const breaking = usePublicTicker({
    kind: 'breaking',
    lang: tickerLang,
    enabled: true,
    todayOnly: true,
  });

  const live = usePublicTicker({
    kind: 'live',
    lang: tickerLang,
    enabled: true,
    todayOnly: true,
  });

  const breakingDisplayItems = React.useMemo(() => sortTimelineItems(breaking.items), [breaking.items]);
  const liveDisplayItems = React.useMemo(() => sortTimelineItems(live.items), [live.items]);

  const didScrollRef = React.useRef<string>('');
  React.useEffect(() => {
    if (!router.isReady) return;
    const tab = normalizeTab(router.query.tab);
    if (!tab) return;

    if (didScrollRef.current === tab) return;
    didScrollRef.current = tab;

    const id = tab === 'breaking' ? 'breaking-today' : 'live-today';
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (!el) return;

    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      (el as any).focus?.({ preventScroll: true });
    } catch {
      // ignore
    }
  }, [router.isReady, router.query.tab]);

  return (
    <div className="min-h-screen bg-white">
      <Head>
        <title>Breaking | News Pulse</title>
        <meta name="description" content="Today’s breaking news and live updates" />
      </Head>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{t('breaking.title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('breaking.subtitle')}</p>
        </div>

        <div className="mt-8 grid gap-10">
          <section id="breaking-today" tabIndex={-1} className="outline-none scroll-mt-24">
            <div className="rounded-[28px] border-l-4 border border-red-200/80 bg-red-50/55 p-4 shadow-[0_18px_44px_-40px_rgba(220,38,38,0.45)] sm:p-5" style={{ borderLeftColor: BREAKING_ACCENT }}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-red-200 bg-white/85 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-red-700">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ background: BREAKING_ACCENT }} />
                    BREAKING
                  </div>
                  <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
                    <span className="inline-flex h-3 w-3 rounded-full shadow-[0_0_0_4px_rgba(220,38,38,0.12)]" style={{ background: BREAKING_ACCENT }} />
                    {t('home.breakingNews')} — Today
                  </h2>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <SectionSponsorLink slot="BREAKING_SPONSOR" sponsor={breakingSponsor} />
                  <button
                    type="button"
                    onClick={() => breaking.refetch('manual')}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-4">
                {breaking.isLoading ? (
                  <div className="rounded-2xl border border-red-200/80 bg-white/80 px-4 py-3 text-sm text-red-900">Loading…</div>
                ) : breaking.error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{breaking.error}</div>
                ) : breakingDisplayItems.length === 0 ? (
                  <div className="rounded-2xl border border-red-100 bg-white/80 px-4 py-3 text-sm text-red-900/85">{t('home.noBreaking')}</div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-red-200/80 bg-white/85 divide-y divide-red-100/80">
                    {breakingDisplayItems.map((it) => {
                      const href = resolveBroadcastArticleHref(it.raw, tickerLang);
                      const sourceLabel = resolveBroadcastSource(it.raw);
                      const displayTimeLabel = resolveTimelineTimeLabel(it);
                      const content = (
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 pt-0.5">
                            <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-red-700">
                              BREAKING
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-700/85">
                              {displayTimeLabel ? <span>{displayTimeLabel}</span> : null}
                              {displayTimeLabel && sourceLabel ? <span aria-hidden="true">•</span> : null}
                              {sourceLabel ? <span className="truncate">{sourceLabel}</span> : null}
                            </div>
                            <div className="mt-1 text-sm font-semibold leading-6 text-slate-900" lang={tickerLang}>{it.text}</div>
                          </div>
                          {href ? <div className="shrink-0 self-center text-[11px] font-bold uppercase tracking-[0.14em] text-red-700/80">Open</div> : null}
                        </div>
                      );

                      if (!href) {
                        return (
                          <div
                            key={it.id}
                            className="border-l-4 bg-white/70 px-3 py-3 sm:px-4"
                            style={{ borderLeftColor: BREAKING_ACCENT }}
                          >
                            {content}
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={it.id}
                          href={href}
                          className="block border-l-4 bg-white/70 px-3 py-3 transition-colors hover:bg-white sm:px-4"
                          style={{ borderLeftColor: BREAKING_ACCENT }}
                        >
                          {content}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section id="live-today" tabIndex={-1} className="outline-none scroll-mt-24">
            <div className="rounded-[28px] border-l-4 border border-blue-200/80 bg-blue-50/55 p-4 shadow-[0_18px_44px_-40px_rgba(37,99,235,0.42)] sm:p-5" style={{ borderLeftColor: LIVE_ACCENT }}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/85 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: LIVE_ACCENT }} />
                    LIVE
                  </div>
                  <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
                    <span className="inline-flex h-3 w-3 rounded-full animate-pulse shadow-[0_0_0_4px_rgba(37,99,235,0.12)]" style={{ background: LIVE_ACCENT }} />
                    {t('home.liveUpdates')} — Today
                  </h2>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <SectionSponsorLink slot="LIVE_UPDATE_SPONSOR" sponsor={liveSponsor} />
                  <button
                    type="button"
                    onClick={() => live.refetch('manual')}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="mt-4">
                {live.isLoading ? (
                  <div className="rounded-2xl border border-blue-200/80 bg-white/80 px-4 py-3 text-sm text-blue-900">Loading…</div>
                ) : live.error ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{live.error}</div>
                ) : liveDisplayItems.length === 0 ? (
                  <div className="rounded-2xl border border-blue-100 bg-white/80 px-4 py-3 text-sm text-blue-900/85">{t('home.noLiveUpdates')}</div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-blue-200/80 bg-white/85 divide-y divide-blue-100/80">
                    {liveDisplayItems.map((it) => {
                      const sourceLabel = resolveBroadcastSource(it.raw);
                      const displayTimeLabel = resolveTimelineTimeLabel(it);
                      return (
                        <div key={it.id} className="border-l-4 bg-white/70 px-3 py-3 sm:px-4" style={{ borderLeftColor: LIVE_ACCENT }}>
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 pt-0.5">
                              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">
                                LIVE
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700/85">
                                {displayTimeLabel ? <span>{displayTimeLabel}</span> : null}
                                {displayTimeLabel && sourceLabel ? <span aria-hidden="true">•</span> : null}
                                {sourceLabel ? <span className="truncate">{sourceLabel}</span> : null}
                              </div>
                              <div className="mt-1 text-sm font-semibold leading-6 text-slate-900" lang={tickerLang}>{it.text}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
