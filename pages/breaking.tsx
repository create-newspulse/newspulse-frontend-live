import React from "react";
import { useLanguage } from "../utils/LanguageContext";
import { fetchPublicNews, type Article } from "../lib/publicNewsApi";
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle } from "../lib/contentFallback";
import OriginalTag from "../components/OriginalTag";
import { useI18n } from "../src/i18n/LanguageProvider";
import { buildNewsUrl } from "../lib/newsRoutes";
import { resolveArticleSlug } from "../lib/articleSlugs";

type BreakingItem = {
  id: string;
  title: string;
  titleIsOriginal?: boolean;
  summary?: string;
  summaryIsOriginal?: boolean;
  source?: string;
  desk?: string;
  publishedAt?: string;
  url?: string;
};

type LiveUpdate = {
  id: string;
  minutesAgo: number;
  text: string;
};

const classNames = (...s: (string | false | null | undefined)[]) =>
  s.filter(Boolean).join(" ");

// ---- fallback (so page never looks empty)
const FALLBACK_HERO: BreakingItem = {
  id: "hero-1",
  title: "Global Climate Summit Reaches Historic Agreement",
  summary:
    "World leaders unite on unprecedented environmental policies after intense negotiations in Geneva.",
  source: "Reuters",
  desk: "Environmental Desk",
  publishedAt: "2025-11-01T10:00:00.000Z",
};

const FALLBACK_TRENDING: BreakingItem[] = [
  { id: "t1", title: "Revolutionary Medical Breakthrough Announced" },
  { id: "t2", title: "Space Mission Reaches New Milestone" },
  { id: "t3", title: "Economic Indicators Show Positive Trends" },
  { id: "t4", title: "Cultural Exchange Program Expands Globally" },
  { id: "t5", title: "Innovation in Renewable Energy Sector" },
];

const FALLBACK_LIVE: LiveUpdate[] = [
  { id: "l1", minutesAgo: 2, text: "Market closes with significant gains" },
  { id: "l2", minutesAgo: 5, text: "Press conference concludes successfully" },
  { id: "l3", minutesAgo: 12, text: "International summit begins in Geneva" },
  { id: "l4", minutesAgo: 18, text: "New research findings published" },
  { id: "l5", minutesAgo: 25, text: "Technology expo attracts record attendance" },
];

// ---- replace these later with your real endpoints
function articleToBreakingItem(raw: Article, requestedLang: 'en' | 'hi' | 'gu'): BreakingItem | null {
  const titleRes = resolveArticleTitle(raw as any, requestedLang);
  const title = String(titleRes.text || '').trim();
  if (!title) return null;

  const id = String((raw as any)?._id || (raw as any)?.id || '').trim();
  const slug = resolveArticleSlug(raw, requestedLang);
  if (!id) return null;

  const summaryRes = resolveArticleSummaryOrExcerpt(raw as any, requestedLang);
  const summary = String(summaryRes.text || '').trim() || undefined;
  const publishedAt = String((raw as any)?.publishedAt || (raw as any)?.createdAt || '').trim() || undefined;
  const source = String((raw as any)?.source?.name || (raw as any)?.source || '').trim() || undefined;
  const desk = String((raw as any)?.desk || '').trim() || undefined;
  const url = buildNewsUrl({ id, slug, lang: requestedLang });

  return {
    id,
    title,
    titleIsOriginal: titleRes.isOriginal,
    summary,
    summaryIsOriginal: summaryRes.isOriginal,
    source,
    desk,
    publishedAt,
    url,
  };
}
async function fetchLiveUpdates(): Promise<LiveUpdate[]> {
  try {
    // const res = await fetch("/api/news/live");
    // return await res.json();
    await new Promise((r) => setTimeout(r, 250));
    return FALLBACK_LIVE;
  } catch {
    return FALLBACK_LIVE;
  }
}

// ---- voice (same idea as regional)
function useVoiceReader() {
  const synthRef = React.useRef<SpeechSynthesis | null>(null);
  const [speaking, setSpeaking] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = (text: string, onUnsupported?: () => void) => {
    if (!synthRef.current) {
      if (typeof onUnsupported === "function") onUnsupported();
      return;
    }
    try {
      synthRef.current.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      u.pitch = 1.0;
      u.onend = () => setSpeaking(false);
      setSpeaking(true);
      synthRef.current.speak(u);
    } catch {}
  };

  const stop = () => {
    try {
      synthRef.current?.cancel();
    } finally {
      setSpeaking(false);
    }
  };

  const toggle = (text: string, onUnsupported?: () => void) => (speaking ? stop() : speak(text, onUnsupported));

  return { toggle, speaking };
}

function ClientTime({ iso }: { iso?: string }) {
  const [text, setText] = React.useState("");
  React.useEffect(() => {
    if (!iso) return;
    try {
      const d = new Date(iso);
      setText(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {}
  }, [iso]);
  return (
    <span suppressHydrationWarning className="text-xs text-slate-500">
      {text || "—"}
    </span>
  );
}

export default function BreakingPage() {
  const { language } = useLanguage();
  const { t } = useI18n();
  const voice = useVoiceReader();

  const [hero, setHero] = React.useState<BreakingItem>(FALLBACK_HERO);
  const [trending, setTrending] = React.useState<BreakingItem[]>(FALLBACK_TRENDING);
  const [live, setLive] = React.useState<LiveUpdate[]>(FALLBACK_LIVE);

  React.useEffect(() => {
    const controller = new AbortController();
    (async () => {
      // Breaking feed (language-filtered)
      const resp = await fetchPublicNews({ category: 'breaking', language, limit: 12, signal: controller.signal });
      if (controller.signal.aborted) return;

      const mapped = (resp.items || []).map((a) => articleToBreakingItem(a, language)).filter(Boolean) as BreakingItem[];
      if (mapped.length) {
        setHero(mapped[0] || FALLBACK_HERO);
        setTrending(mapped.slice(1, 6).length ? mapped.slice(1, 6) : FALLBACK_TRENDING);
      } else {
        setHero(FALLBACK_HERO);
        setTrending(FALLBACK_TRENDING);
      }

      // Live updates remain fallback for now.
      const liveItems = await fetchLiveUpdates();
      if (controller.signal.aborted) return;
      setLive(liveItems);
    })().catch(() => {
      if (controller.signal.aborted) return;
      setHero(FALLBACK_HERO);
      setTrending(FALLBACK_TRENDING);
      fetchLiveUpdates().then(setLive);
    });

    return () => controller.abort();
  }, [language]);

  const voiceText = React.useMemo(() => {
    const top = [hero.title, hero.summary].filter(Boolean).join(". ");
    const t = trending.slice(0, 5).map((x) => x.title).join(". ");
    return `Breaking News. ${top}. Trending now: ${t}.`;
  }, [hero, trending]);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-3 w-3 rounded-full bg-red-500" />
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                {t('breakingPage.title')}
              </h1>
            </div>
              <p className="text-slate-600 mt-1">
                {t('breakingPage.subtitle')}
              </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                voice.toggle(voiceText, () => {
                  alert(t('common.voiceNotSupported'));
                })
              }
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
              aria-pressed={voice.speaking}
              title={voice.speaking ? t('common.mute') : t('common.listen')}
            >
              <span>{voice.speaking ? "🔇" : "🔊"}</span>
              {voice.speaking ? t('common.mute') : t('common.listen')}
            </button>
          </div>
        </div>

        {/* Main layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hero */}
          <div className="lg:col-span-2 rounded-3xl border bg-rose-50/60 p-6 shadow-sm">
            <h2 className="text-2xl md:text-3xl font-extrabold leading-tight">
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>{hero.title}</span>
                {hero.titleIsOriginal ? <OriginalTag /> : null}
              </span>
            </h2>
            {hero.summary && (
              <p className="text-slate-700 mt-3 text-lg leading-relaxed">
                <span>{hero.summary}</span>
                {hero.summaryIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                📍 <span>{hero.source || t('brand.name')}</span>
              </span>
              <span className="inline-flex items-center gap-2">
                ⏰ <ClientTime iso={hero.publishedAt} />
              </span>
              <span className="inline-flex items-center gap-2">
                👤 <span>{hero.desk || t('breakingPage.defaultDesk')}</span>
              </span>
            </div>

            <div className="mt-6">
              <a
                href={hero.url || "#"}
                className="inline-flex items-center justify-center rounded-full bg-red-700 px-7 py-3 text-white font-semibold hover:bg-red-800"
              >
                {t('breakingPage.readMore')}
              </a>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Trending */}
            <div className="rounded-3xl border bg-violet-50/60 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl">🔥</span>
                <h3 className="text-xl font-extrabold">{t('breakingPage.trendingNow')}</h3>
              </div>
              <ol className="space-y-3">
                {trending.slice(0, 5).map((t, idx) => (
                  <li key={t.id} className="flex gap-3">
                    <span className="w-6 text-purple-700 font-bold">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-slate-800">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span>{t.title}</span>
                        {t.titleIsOriginal ? <OriginalTag /> : null}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Live Updates */}
            <div className="rounded-3xl border bg-emerald-50/60 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl">🟢</span>
                <h3 className="text-xl font-extrabold">{t('breakingPage.liveUpdates')}</h3>
              </div>
              <div className="space-y-3">
                {live.map((u) => (
                  <div key={u.id} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex items-center rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                      {u.minutesAgo} {t('common.minutesShort')}
                    </span>
                    <p className="text-slate-800">{u.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Optional: later you can add “More Breaking Stories” grid under this */}
      </div>
    </div>
  );
}
