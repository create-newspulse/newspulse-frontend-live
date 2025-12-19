import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../utils/LanguageContext";
import { useRegionalPulse } from "../src/features/regional/useRegionalPulse";
import AIAnchor from "../components/AIAnchor";
import { useFeatureFlags } from "../utils/FeatureFlagProvider";

/**
 * Regional – Gujarat (News Pulse)
 * -------------------------------------------------------
 * Drop-in page for Next.js (Pages Router).
 * - TailwindCSS based, no external UI libs required
 * - Placeholder endpoints used; includes graceful fallback data
 * - Sections:
 *   1) Header + Controls (search, filters, language)
 *   2) Top Mahanagarpalika grid
 *   3) District News Feed (AI summary ready)
 *   4) Civic Tracker mini-dashboard
 *   5) Youth Voices (pulls from /api/news/youth)
 *   6) Development Projects in Focus
 *   7) City in Motion (video embeds)
 *   8) Interactive Map placeholder (Leaflet hook-in)
 *   9) Voice Reader (Web Speech API placeholder)
 */

// ---------- Types

type City = {
  id: string;
  name: string;
  label?: "Current" | "Approved" | "New";
  type: "City" | "District";
  district?: string;
  badges?: string[]; // e.g., ["Smart City", "Industrial Hub"]
};

type District = {
  id: string;
  name: string;
  region?: string; // Coastal, Industrial, Tribal Belt, etc.
};

type NewsItem = {
  id: string;
  title: string;
  source: string;
  url?: string;
  category:
    | "Development"
    | "Education"
    | "Civic"
    | "Culture"
    | "Crime"
    | "Health"
    | "Environment";
  district?: string;
  summary?: string;
  publishedAt?: string;
};

// ---------- Utilities

const classNames = (...s: (string | false | null | undefined)[]) => s.filter(Boolean).join(" ");

const FILTERS = [
  { key: "all", label: "All" },
  { key: "smart", label: "Smart City" },
  { key: "industrial", label: "Industrial" },
  { key: "coastal", label: "Coastal" },
  { key: "tribal", label: "Tribal Belt" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

// ---------- Mock/Fallback Data (used until APIs return)

const FALLBACK_TOP_CITIES: City[] = [
  { id: "ahm", name: "Ahmedabad", type: "District", label: "Current", badges: ["Smart City"] },
  { id: "sur", name: "Surat", type: "District", label: "Current", badges: ["Diamond Hub"] },
  { id: "vad", name: "Vadodara", type: "District", label: "Current", badges: ["Education"] },
  { id: "raj", name: "Rajkot", type: "District", label: "Current", badges: ["Industrial"] },
  { id: "bvn", name: "Bhavnagar", type: "District", label: "Current", badges: ["Coastal"] },
  { id: "jmn", name: "Jamnagar", type: "District", label: "Current", badges: ["Refinery"] },
  { id: "jnd", name: "Junagadh", type: "District", label: "Current", badges: ["Tourism"] },
  { id: "gnd", name: "Gandhinagar", type: "District", label: "Current", badges: ["Capital"] },
  { id: "nvs", name: "Navsari", type: "District", label: "New", badges: ["Agri"] },
  { id: "gdh", name: "Gandhidham", type: "City", label: "Approved", badges: ["Port"] },
  { id: "mrb", name: "Morbi", type: "District", label: "Approved", badges: ["Ceramics"] },
  { id: "vpi", name: "Vapi", type: "City", label: "New", badges: ["Industrial"] },
];

const FALLBACK_DISTRICTS: District[] = [
  "Ahmedabad",
  "Amreli",
  "Anand",
  "Aravalli",
  "Banaskantha",
  "Bharuch",
  "Bhavnagar",
  "Botad",
  "Chhota Udaipur",
  "Dahod",
  "Dang",
  "Devbhoomi Dwarka",
  "Gandhinagar",
  "Gir Somnath",
  "Jamnagar",
  "Junagadh",
  "Kheda",
  "Kutch",
  "Mahisagar",
  "Mehsana",
  "Morbi",
  "Narmada",
  "Navsari",
  "Panchmahal",
  "Patan",
  "Porbandar",
  "Rajkot",
  "Sabarkantha",
  "Surat",
  "Surendranagar",
  "Tapi",
  "Vadodara",
  "Valsad",
].map((n, i) => ({ id: `dist-${i}`, name: n }));

const FALLBACK_NEWS: NewsItem[] = [
  {
    id: "1",
    title: "Ahmedabad Metro Phase-2 completes key bridge work",
    source: "NewsPulse",
    category: "Development",
    district: "Ahmedabad",
    summary: "Construction crosses Sabarmati; trial runs planned next month.",
    // Use a fixed timestamp to avoid SSR/CSR mismatch
    publishedAt: "2025-11-01T10:00:00.000Z",
  },
  {
    id: "2",
    title: "Surat reports strong monsoon preparedness",
    source: "Civic",
    category: "Civic",
    district: "Surat",
    summary: "Stormwater drains cleaned across 7 zones; control rooms active.",
    publishedAt: "2025-11-01T08:30:00.000Z",
  },
  {
    id: "3",
    title: "Junagadh tourism push for Gir safari off-season",
    source: "Tourism",
    category: "Culture",
    district: "Junagadh",
    summary: "Eco-trails and heritage walks to drive local economy.",
    publishedAt: "2025-11-01T07:15:00.000Z",
  },
];

// ---------- API hooks (swap with real endpoints)

async function fetchRegionalNews(state: string): Promise<NewsItem[]> {
  try {
    // TODO: replace with real endpoint, e.g.,
    // const res = await fetch(`/api/news/regional?state=${state}`);
    // return await res.json();
    await new Promise((r) => setTimeout(r, 400));
    return FALLBACK_NEWS;
  } catch (e) {
    return FALLBACK_NEWS;
  }
}

async function fetchYouthVoices(state: string): Promise<NewsItem[]> {
  try {
    // TODO: replace with: /api/news/youth?state=gujarat
    await new Promise((r) => setTimeout(r, 300));
    return [
      {
        id: "yv1",
        title: "Campus Innovators: Solar carts by GTU students",
        source: "Youth Pulse",
        category: "Education",
        district: "Ahmedabad",
        summary: "Pilot to run inside campus clusters.",
        publishedAt: new Date().toISOString(),
      },
    ];
  } catch (e) {
    return [];
  }
}

async function fetchCivicMetrics(state: string) {
  try {
    // TODO: replace with: /api/regional/metrics?state=gujarat
    await new Promise((r) => setTimeout(r, 250));
    return {
      rainfallAlertDistricts: 3,
      waterSupplyOK: 28,
      projectsTracked: 57,
      electionNotices: 2,
    };
  } catch (e) {
    return { rainfallAlertDistricts: 0, waterSupplyOK: 0, projectsTracked: 0, electionNotices: 0 };
  }
}

// ---------- Voice Reader (Web Speech placeholder)

function useVoiceReader() {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
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
      utterRef.current = u;
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

  const toggle = (text: string) => {
    if (speaking) stop();
    else speak(text);
  };

  return { speak, stop, toggle, speaking };
}

// ---------- Chips & small UI

function Chip({ children, tone = "default" as "default" | "success" | "info" | "warning" }) {
  const toneMap: Record<string, string> = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    info: "bg-blue-100 text-blue-700",
    warning: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={classNames("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", toneMap[tone])}>
      {children}
    </span>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

// Client-only time renderer to avoid hydration mismatches
function ClientTime({ iso }: { iso?: string }) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    if (!iso) return;
    try {
      const d = new Date(iso);
      // Show hours:minutes in user's locale
      const s = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setText(s);
    } catch {}
  }, [iso]);
  return (
    <span suppressHydrationWarning className="text-xs text-slate-400">{text || "—"}</span>
  );
}

// ---------- Main Page Component

export default function RegionalGujaratPage() {
  const { language, setLanguage } = useLanguage();
  const { isEnabled } = useFeatureFlags();
  const {
    FILTERS: R_FILTERS,
    filter,
    setFilter,
    query,
    setQuery,
    filteredCities,
    districts,
    news,
    youth,
    metrics,
    highlightsText,
  } = useRegionalPulse("gujarat");
  const voice = useVoiceReader();

  const askAnchorHeadlines = useMemo(() => {
    const list = (news || []).slice(0, 6);
    return list.map((n) => ({ text: n.title }));
  }, [news]);


  

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Regional Pulse – Gujarat</h1>
            <p className="text-slate-600 mt-1">Your real-time civic, district, and city news pulse of Gujarat.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Switcher (wired to LanguageContext) */}
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="english">English</option>
              <option value="gujarati">ગુજરાતી</option>
              <option value="hindi">हिन्दी</option>
            </select>
            {isEnabled('voice.enabled', true) && (
              <button
                onClick={() => voice.toggle(`Here are top regional highlights. ${highlightsText}`)}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                title={voice.speaking ? "Mute" : "Listen to local highlights"}
                aria-pressed={voice.speaking}
              >
                <span role="img" aria-label={voice.speaking ? "muted" : "speaker"}>
                  {voice.speaking ? "🔇" : "🔊"}
                </span>
                {voice.speaking ? "Mute" : "Listen"}
              </button>
            )}
          </div>
        </div>

        {isEnabled('askAnchor.enabled', true) && askAnchorHeadlines.length > 0 && (
          <div className="mt-4">
            <AIAnchor language={language} headlines={askAnchorHeadlines} />
          </div>
        )}

        {/* Controls */}
        <div className="mt-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {R_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={classNames(
                  "px-3 py-1.5 rounded-full text-sm border",
                  filter === f.key ? "bg-black text-white border-black" : "hover:bg-slate-50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search district or city..."
              className="w-full border rounded-xl px-3 py-2 text-sm"
            />
            <span className="absolute right-3 top-2.5">🔎</span>
          </div>
        </div>
      </div>

      {/* Top Cities (Mahanagarpalika) */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-2">
  <SectionTitle title="Top Cities (Mahanagarpalika)" subtitle="Current + Newly Approved" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCities.map((city) => (
            <div key={city.id} className="rounded-2xl border p-4 hover:shadow-sm transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏛️</span>
                  <div>
                    <h3 className="font-semibold text-lg">{city.name}</h3>
                    <p className="text-xs text-slate-500">{city.type} · Gujarat</p>
                  </div>
                </div>
                {city.label && (
                  <Chip tone={city.label === "Current" ? "success" : city.label === "New" ? "warning" : "info"}>
                    {city.label}
                  </Chip>
                )}
              </div>
              {city.badges && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {city.badges.map((b, i) => (
                    <Chip key={i}>{b}</Chip>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Districts (quick index) */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-10">
        <SectionTitle title={`Gujarat — ${districts.length} Districts`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {districts.map((d) => (
            <button key={d.id} className="rounded-2xl border p-4 text-left hover:shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🗺️</span>
                <div>
                  <div className="font-semibold text-lg">{d.name}</div>
                  <div className="text-xs text-slate-500">District · Gujarat</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Civic Tracker */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-10">
  <SectionTitle title="Civic Tracker" subtitle="Live status across districts" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Rainfall Alerts" value={metrics?.rainfallAlertDistricts ?? "—"} hint="districts" />
          <MetricCard label="Water Supply OK" value={metrics?.waterSupplyOK ?? "—"} hint="districts" />
          <MetricCard label="Projects Tracked" value={metrics?.projectsTracked ?? "—"} hint="active" />
          <MetricCard label="Election Notices" value={metrics?.electionNotices ?? "—"} hint="this week" />
        </div>
      </section>

      {/* District News Feed */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-10">
  <SectionTitle title="District News Feed" subtitle="Auto-summarized highlights from verified sources" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {news.map((item) => (
            <article key={item.id} className="rounded-2xl border p-4 hover:shadow-sm">
              <div className="flex items-center justify-between">
                <Chip>{item.category}</Chip>
                <ClientTime iso={item.publishedAt} />
              </div>
              <h3 className="mt-2 font-semibold leading-snug">{item.title}</h3>
              {item.summary && <p className="text-sm text-slate-600 mt-1">{item.summary}</p>}
              <div className="mt-3 flex items-center justify-between text-sm">
                <div className="text-slate-500">{item.district}</div>
                <a href={item.url || "#"} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
                  Read more →
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Youth Voices */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-10">
  <SectionTitle title="Voices from Your City" subtitle="Youth Pulse – opinions, campus, careers" />
        {youth.length === 0 ? (
          <div className="text-sm text-slate-500">No youth stories right now. (Hook to /api/news/youth)</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {youth.map((y) => (
              <article key={y.id} className="rounded-2xl border p-4 hover:shadow-sm">
                <Chip tone="info">Youth Pulse</Chip>
                <h3 className="mt-2 font-semibold leading-snug">{y.title}</h3>
                {y.summary && <p className="text-sm text-slate-600 mt-1">{y.summary}</p>}
                <div className="mt-3 text-sm text-slate-500">{y.district}</div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Development Projects */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-10">
        <SectionTitle title="Development Projects in Focus" subtitle="Tracked by KiranOS – status & milestones" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {["Ahmedabad Metro Phase-2", "Dholera SIR Solar Park", "Narmada Canal Modernization"].map((p, i) => (
            <div key={i} className="rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{p}</h3>
                <Chip tone={i === 0 ? "success" : i === 1 ? "info" : "warning"}>
                  {i === 0 ? "On Track" : i === 1 ? "Planned" : "Delayed"}
                </Chip>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Auto-updated notes and milestones will appear here. Connect to /api/projects/regional.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* City in Motion (Videos) */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-10">
        <SectionTitle title="City in Motion" subtitle="Local clips & explainers" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {["https://www.youtube.com/embed/dQw4w9WgXcQ", "https://www.youtube.com/embed/oHg5SJYRHA0"].map(
            (src, i) => (
              <div key={i} className="aspect-video rounded-2xl overflow-hidden border">
                <iframe
                  className="w-full h-full"
                  src={src}
                  title={`video-${i}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )
          )}
        </div>
      </section>

      {/* Map Placeholder */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 mt-10 mb-16">
  <SectionTitle title="Explore on Map" subtitle="Interactive Gujarat map – click a district to filter news" />
        <div className="rounded-2xl border p-6 h-72 flex items-center justify-center text-slate-500">
          Leaflet/Mapbox map goes here. Hook into district filter when implemented.
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}
 
