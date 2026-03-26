import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';

import { usePublicAdSlot } from '../hooks/usePublicAdSlot';
import { usePublicTicker } from '../hooks/usePublicTicker';
import { useI18n } from '../src/i18n/LanguageProvider';
import { buildNewsUrl } from '../lib/newsRoutes';

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
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-xl font-extrabold text-slate-900">{t('home.breakingNews')} — Today</h2>
              <div className="flex items-center gap-3 shrink-0">
                <SectionSponsorLink slot="BREAKING_SPONSOR" sponsor={breakingSponsor} />
                <button
                  type="button"
                  onClick={() => breaking.refetch('manual')}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-4">
              {breaking.isLoading ? (
                <div className="text-slate-600">Loading…</div>
              ) : breaking.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{breaking.error}</div>
              ) : breaking.items.length === 0 ? (
                <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">{t('home.noBreaking')}</div>
              ) : (
                <div className="space-y-3">
                  {breaking.items.map((it) => {
                    const rawId = String((it.raw as any)?._id || (it.raw as any)?.id || it.id || '').trim();
                    const href = rawId ? buildNewsUrl({ id: rawId, lang: tickerLang }) : '#';
                    return (
                      <Link
                        key={it.id}
                        href={href}
                        className="block rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 text-sm font-extrabold text-red-700">{it.timeText || '--:--'}</div>
                          <div className="min-w-0 text-slate-900" lang={tickerLang}>{it.text}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section id="live-today" tabIndex={-1} className="outline-none scroll-mt-24">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-xl font-extrabold text-slate-900">{t('home.liveUpdates')} — Today</h2>
              <div className="flex items-center gap-3 shrink-0">
                <SectionSponsorLink slot="LIVE_UPDATE_SPONSOR" sponsor={liveSponsor} />
                <button
                  type="button"
                  onClick={() => live.refetch('manual')}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-4">
              {live.isLoading ? (
                <div className="text-slate-600">Loading…</div>
              ) : live.error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{live.error}</div>
              ) : live.items.length === 0 ? (
                <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">{t('home.noLiveUpdates')}</div>
              ) : (
                <div className="space-y-3">
                  {live.items.map((it) => (
                    <div key={it.id} className="rounded-xl border border-slate-200 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 text-sm font-extrabold text-indigo-700">{it.timeText || '--:--'}</div>
                        <div className="min-w-0 text-slate-900" lang={tickerLang}>{it.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
