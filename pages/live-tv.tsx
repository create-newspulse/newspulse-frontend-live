import Head from 'next/head';
import Link from 'next/link';
import { ChevronLeft, Play, Radio } from 'lucide-react';

import { usePublicSettings } from '../src/context/PublicSettingsContext';
import { DEFAULT_NORMALIZED_PUBLIC_SETTINGS } from '../src/lib/publicSettings';
import { resolveLiveTvPresentation } from '../src/lib/liveTv';

function getLiveTvStatusBadge(mode: string): string {
  if (mode === 'offline-replay' || mode === 'aira-bulletin') return 'REPLAY';
  if (mode === 'scheduled-show') return 'SCHEDULED';
  if (mode === 'maintenance-coming-soon') return 'COMING SOON';
  return 'LIVE';
}

export default function LiveTvPage() {
  const { settings } = usePublicSettings();
  const liveTv = settings?.liveTv ?? DEFAULT_NORMALIZED_PUBLIC_SETTINGS.liveTv;
  const presentation = resolveLiveTvPresentation(liveTv);
  const statusBadge = getLiveTvStatusBadge(presentation.mode);
  const detailLine = presentation.title && presentation.title !== 'News Pulse Live TV'
    ? presentation.title
    : presentation.modeLabel;

  return (
    <>
      <Head>
        <title>Live TV | News Pulse</title>
        <meta name="description" content="Watch News Pulse Live TV and scheduled public live programming." />
      </Head>

      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(191,219,254,0.32),transparent_36%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-950">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-start">
            <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:text-slate-950">
              <ChevronLeft className="h-4 w-4" /> Back to home
            </Link>
          </div>

          <section className="mt-8 overflow-hidden rounded-[32px] border border-slate-200 bg-white/92 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.28)] backdrop-blur">
            <div className={presentation.highlightBreaking ? 'border-b border-red-200 bg-[linear-gradient(135deg,rgba(220,38,38,0.16),rgba(249,115,22,0.12),rgba(255,255,255,0.92))] px-6 py-6' : 'border-b border-slate-200 bg-[linear-gradient(135deg,rgba(220,38,38,0.10),rgba(59,130,246,0.08),rgba(255,255,255,0.92))] px-6 py-6'}>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col items-start gap-4 rounded-full bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:gap-[22px] sm:px-[34px] sm:py-5">
                  <div className="flex min-w-0 items-center gap-4 sm:gap-[22px]">
                    <div className="flex w-[92px] flex-shrink-0 items-center justify-center bg-transparent sm:w-[120px] lg:w-[150px]">
                      <img
                        src="/brand/news-pulse-final-mark.png"
                        alt="News Pulse logo"
                        className="block h-auto w-full bg-transparent object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[1.65rem] font-black tracking-tight text-slate-950 sm:text-[2rem]">News Pulse</div>
                      <p className="mt-1 text-sm font-medium text-slate-600 sm:text-base">Your pulse on what matters most.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Live TV</div>
                  <div className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">News Pulse Live</h1>
                    <div className={presentation.highlightBreaking ? 'inline-flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-xs font-extrabold tracking-[0.18em] text-white shadow-[0_18px_40px_-24px_rgba(185,28,28,0.9)]' : 'inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-extrabold tracking-[0.18em] text-white'}>
                      <Radio className="h-4 w-4" /> {statusBadge}
                    </div>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-700 sm:text-base">{detailLine}</p>
                  {presentation.subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">{presentation.subtitle}</p> : null}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_24px_64px_-34px_rgba(15,23,42,0.12)] sm:p-4">
                <div className="relative w-full min-h-[220px] overflow-hidden rounded-[22px] border border-[rgba(148,163,184,0.28)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-2 shadow-[0_20px_50px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] sm:rounded-[26px] sm:p-3 md:min-h-[360px] lg:rounded-[30px] lg:p-[14px]" style={{ aspectRatio: '16 / 9' }}>
                  <div className="pointer-events-none absolute left-[12%] right-[12%] top-0 h-[3px] bg-[linear-gradient(90deg,transparent,#ef233c,transparent)] opacity-65" />
                  <div className="relative h-full w-full overflow-hidden rounded-[16px] border border-[rgba(203,213,225,0.75)] bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.08),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)] sm:rounded-[18px] lg:rounded-[22px]">
                    {liveTv.enabled && presentation.playerKind === 'iframe' ? (
                      <iframe
                        title={presentation.title}
                        src={presentation.playerUrl}
                        className="absolute inset-0 h-full w-full rounded-[16px] border-0 bg-transparent sm:rounded-[18px] lg:rounded-[22px]"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                    ) : liveTv.enabled && presentation.playerKind === 'video' ? (
                      <video
                        className="absolute inset-0 h-full w-full rounded-[16px] bg-transparent object-cover sm:rounded-[18px] lg:rounded-[22px]"
                        controls
                        playsInline
                        preload="metadata"
                        src={presentation.playerUrl}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center px-5 py-6 text-center sm:px-8 sm:py-8 lg:px-10 lg:py-10">
                        <div className="max-w-2xl">
                          <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-500">{presentation.modeLabel}</div>
                          {presentation.showScheduleCard ? (
                            <>
                              <div className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{presentation.title}</div>
                              {presentation.subtitle ? <div className="mt-2 text-sm text-slate-600 sm:text-base">{presentation.subtitle}</div> : null}
                            </>
                          ) : null}
                          <div className="mt-4 text-sm font-semibold text-slate-700 sm:text-base">{presentation.message}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                  <Play className="h-4 w-4" /> {presentation.modeLabel}
                </div>
                {!liveTv.enabled ? <div className="text-sm text-slate-600">{presentation.message}</div> : null}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}