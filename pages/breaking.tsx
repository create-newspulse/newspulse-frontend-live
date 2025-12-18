import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../utils/LanguageContext";

type BreakingItem = {
  id: string;
  title: string;
  summary?: string;
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
async function fetchBreakingHero(): Promise<BreakingItem> {
  try {
    // const res = await fetch("/api/news/breaking/hero");
    // return await res.json();
    await new Promise((r) => setTimeout(r, 250));
    return FALLBACK_HERO;
  } catch {
    return FALLBACK_HERO;
  }
}
async function fetchTrending(): Promise<BreakingItem[]> {
  try {
    // const res = await fetch("/api/news/trending");
    // return await res.json();
    await new Promise((r) => setTimeout(r, 250));
    return FALLBACK_TRENDING;
  } catch {
    return FALLBACK_TRENDING;
  }
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
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  const speak = (text: string) => {
    if (!synthRef.current) return alert("Voice not supported on this device.");
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

  const toggle = (text: string) => (speaking ? stop() : speak(text));

  return { toggle, speaking };
}

function ClientTime({ iso }: { iso?: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
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
  const { language, setLanguage } = useLanguage();
  const voice = useVoiceReader();

  const [hero, setHero] = useState<BreakingItem>(FALLBACK_HERO);
  const [trending, setTrending] = useState<BreakingItem[]>(FALLBACK_TRENDING);
  const [live, setLive] = useState<LiveUpdate[]>(FALLBACK_LIVE);

  useEffect(() => {
    fetchBreakingHero().then(setHero);
    fetchTrending().then(setTrending);
    fetchLiveUpdates().then(setLive);
  }, []);

  const voiceText = useMemo(() => {
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
                Breaking News
              </h1>
            </div>
            <p className="text-slate-600 mt-1">
              Live headlines, verified updates, and what matters most — fast.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="english">English</option>
              <option value="gujarati">ગુજરાતી</option>
              <option value="hindi">हिन्दी</option>
            </select>

            <button
              onClick={() => voice.toggle(voiceText)}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
              aria-pressed={voice.speaking}
              title={voice.speaking ? "Mute" : "Listen"}
            >
              <span>{voice.speaking ? "🔇" : "🔊"}</span>
              {voice.speaking ? "Mute" : "Listen"}
            </button>
          </div>
        </div>

        {/* Main layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hero */}
          <div className="lg:col-span-2 rounded-3xl border bg-rose-50/60 p-6 shadow-sm">
            <h2 className="text-2xl md:text-3xl font-extrabold leading-tight">
              {hero.title}
            </h2>
            {hero.summary && (
              <p className="text-slate-700 mt-3 text-lg leading-relaxed">
                {hero.summary}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                📍 <span>{hero.source || "News Pulse"}</span>
              </span>
              <span className="inline-flex items-center gap-2">
                ⏰ <ClientTime iso={hero.publishedAt} />
              </span>
              <span className="inline-flex items-center gap-2">
                👤 <span>{hero.desk || "World Desk"}</span>
              </span>
            </div>

            <div className="mt-6">
              <a
                href={hero.url || "#"}
                className="inline-flex items-center justify-center rounded-full bg-red-700 px-7 py-3 text-white font-semibold hover:bg-red-800"
              >
                Read More
              </a>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Trending */}
            <div className="rounded-3xl border bg-violet-50/60 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl">🔥</span>
                <h3 className="text-xl font-extrabold">Trending Now</h3>
              </div>
              <ol className="space-y-3">
                {trending.slice(0, 5).map((t, idx) => (
                  <li key={t.id} className="flex gap-3">
                    <span className="w-6 text-purple-700 font-bold">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-slate-800">{t.title}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Live Updates */}
            <div className="rounded-3xl border bg-emerald-50/60 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xl">🟢</span>
                <h3 className="text-xl font-extrabold">Live Updates</h3>
              </div>
              <div className="space-y-3">
                {live.map((u) => (
                  <div key={u.id} className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex items-center rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                      {u.minutesAgo} min
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
