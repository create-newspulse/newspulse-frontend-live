import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../utils/LanguageContext";
import { useRegionalPulse } from "../src/features/regional/useRegionalPulse";
import { useFeatureFlags } from "../utils/FeatureFlagProvider";
import { useI18n } from '../src/i18n/LanguageProvider';

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

  const speak = (text: string, notSupportedMessage: string) => {
    if (!synthRef.current) return alert(notSupportedMessage);
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

  const toggle = (text: string, notSupportedMessage: string) => {
    if (speaking) stop();
    else speak(text, notSupportedMessage);
  };

  return { speak, stop, toggle, speaking };
}

// ---------- Chips & small UI

type ChipTone = "default" | "success" | "info" | "warning";

function Chip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: ChipTone;
}) {
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

export default function RegionalPage() {
  const { language, setLanguage } = useLanguage();
  const { isEnabled } = useFeatureFlags();
  const { t } = useI18n();
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
    loading,
  } = useRegionalPulse("gujarat", language);
  const voice = useVoiceReader();

  type TabKey = "feed" | "districts" | "cities" | "civic" | "map";
  const [tab, setTab] = useState<TabKey>("feed");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");

  const cityOptions = useMemo(() => {
    const names = filteredCities.map((c) => c.name).filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [filteredCities]);

  const activePlace = (selectedCity || selectedDistrict).trim();

  const visibleNews = useMemo(() => {
    const base = news || [];
    if (!activePlace) return base;
    return base.filter((n) => (n.district || "") === activePlace);
  }, [news, activePlace]);

  const visibleYouth = useMemo(() => {
    const base = youth || [];
    if (!activePlace) return base;
    return base.filter((n) => (n.district || "") === activePlace);
  }, [youth, activePlace]);

  const districtStats = useMemo(() => {
    const all = [...(news || []), ...(youth || [])];
    const score = (iso?: string) => {
      if (!iso) return 0;
      const t = Date.parse(iso);
      return Number.isFinite(t) ? t : 0;
    };

    return districts.map((d) => {
      const items = all
        .filter((n) => (n.district || "") === d.name)
        .sort((a, b) => score(b.publishedAt) - score(a.publishedAt));

      return {
        district: d,
        count: items.length,
        topHeadline: items[0]?.title || "",
      };
    });
  }, [districts, news, youth]);

  const CATEGORY_CHIPS: Array<{ key: FilterKey; label: string }> = [
    { key: "smart", label: "Smart City" },
    { key: "industrial", label: "Industrial" },
    { key: "coastal", label: "Coastal" },
    { key: "tribal", label: "Tribal" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header row: Title/subtitle (left) + Search/Language/Listen (right) */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{t('regionalHub.title')}</h1>
            <p className="text-slate-600 mt-1">{t('regionalHub.subtitle')}</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            <div className="relative w-full sm:w-80">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('regionalHub.searchPlaceholder')}
                className="w-full border rounded-xl px-3 py-2 text-sm"
              />
              <span className="absolute right-3 top-2.5">🔎</span>
            </div>

            <div className="flex items-center gap-2">
              {isEnabled("voice.enabled", true) && (
                <button
                  onClick={() => voice.toggle(`${t('regionalHub.voiceHighlightsIntro')}${highlightsText}`, t('common.voiceNotSupported'))}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  title={voice.speaking ? t('regionalHub.voiceMuteTitle') : t('regionalHub.voiceListenTitle')}
                  aria-pressed={voice.speaking}
                >
                  <span role="img" aria-label={voice.speaking ? "muted" : "speaker"}>
                    {voice.speaking ? "🔇" : "🔊"}
                  </span>
                  {voice.speaking ? t('regionalHub.voiceMute') : t('regionalHub.voiceListen')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky filter bar: District + City + Category chips */}
      <div className="sticky top-0 z-20 bg-white border-y">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:flex md:items-center">
            <label className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">{t('regionalHub.filterDistrict')}</span>
              <select
                className="border rounded-lg px-3 py-2 text-sm w-full"
                value={selectedDistrict}
                onChange={(e) => {
                  setSelectedDistrict(e.target.value);
                  setSelectedCity("");
                }}
              >
                <option value="">{t('regionalHub.filterAllDistricts')}</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">{t('regionalHub.filterCity')}</span>
              <select
                className="border rounded-lg px-3 py-2 text-sm w-full"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                <option value="">{t('regionalHub.filterCityOptional')}</option>
                {cityOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end md:flex-1">
            {CATEGORY_CHIPS.map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter(filter === c.key ? "all" : c.key)}
                className={classNames(
                  "px-3 py-1.5 rounded-full text-sm border",
                  filter === c.key ? "bg-black text-white border-black" : "hover:bg-slate-50"
                )}
              >
                {c.key === 'smart'
                  ? t('regionalHub.chipSmartCity')
                  : c.key === 'industrial'
                    ? t('regionalHub.chipIndustrial')
                    : c.key === 'coastal'
                      ? t('regionalHub.chipCoastal')
                      : c.key === 'tribal'
                        ? t('regionalHub.chipTribal')
                        : c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content: Tabs */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-16">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b">
          {(
            [
              { key: "feed", label: t('regionalHub.tabFeed') },
              { key: "districts", label: t('regionalHub.tabDistricts') },
              { key: "cities", label: t('regionalHub.tabCities') },
              { key: "civic", label: t('regionalHub.tabCivic') },
              { key: "map", label: t('regionalHub.tabMap') },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={classNames(
                "shrink-0 px-3 py-2 rounded-xl text-sm border",
                tab === t.key ? "bg-black text-white border-black" : "hover:bg-slate-50"
              )}
              aria-current={tab === t.key ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div className="mt-6">
          {/* Tab 1: Feed */}
          {tab === "feed" && (
            <section>
              <SectionTitle
                title={activePlace ? t('regionalHub.feedTitleWithPlace', { place: activePlace }) : t('regionalHub.feedTitle')}
                subtitle={t('regionalHub.feedSubtitle')}
              />

              {loading ? (
                <div className="text-sm text-slate-500">{t('regionalHub.loading')}</div>
              ) : visibleNews.length === 0 ? (
                <div className="text-sm text-slate-500">{t('regionalHub.noStoriesForFilters')}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleNews.map((item) => (
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
                          {t('regionalUI.readMore')}
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Tab 2: Districts */}
          {tab === "districts" && (
            <section>
              <SectionTitle title={t('regionalHub.districtsTitle', { count: String(districts.length) })} subtitle={t('regionalHub.districtsSubtitle')} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {districtStats.map((d) => (
                  <div key={d.district.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-lg">{d.district.name}</div>
                        <div className="text-xs text-slate-500">{t('regionalHub.districtMeta')}</div>
                      </div>
                      <Chip>{t('regionalHub.updates', { count: String(d.count) })}</Chip>
                    </div>
                    <div className="mt-3 text-sm text-slate-700">
                      {d.topHeadline ? d.topHeadline : <span className="text-slate-500">{t('regionalHub.noHeadlineYet')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tab 3: Cities */}
          {tab === "cities" && (
            <section>
              <SectionTitle title={t('regionalHub.citiesTitle')} subtitle={t('regionalHub.citiesSubtitle')} />

              <div className="-mx-4 md:-mx-6 px-4 md:px-6 overflow-x-auto pb-2">
                <div className="flex gap-4 min-w-max">
                  {filteredCities.map((city) => (
                    <div key={city.id} className="w-72 shrink-0 rounded-2xl border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🏛️</span>
                          <div>
                            <h3 className="font-semibold text-lg">{city.name}</h3>
                            <p className="text-xs text-slate-500">
                              {t('regionalHub.placeTypeMeta', {
                                type:
                                  city.type === 'City' ? t('regionalHub.typeCity') : city.type === 'District' ? t('regionalHub.typeDistrict') : String(city.type),
                              })}
                            </p>
                          </div>
                        </div>
                        {city.label && (
                          <Chip tone={city.label === "Current" ? "success" : city.label === "New" ? "warning" : "info"}>
                            {city.label === 'Current'
                              ? t('regionalHub.cityLabelCurrent')
                              : city.label === 'New'
                                ? t('regionalHub.cityLabelNew')
                                : city.label === 'Approved'
                                  ? t('regionalHub.cityLabelApproved')
                                  : city.label}
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
              </div>

              <div className="mt-10">
                <SectionTitle
                  title={activePlace ? t('regionalHub.cityFeedTitleWithPlace', { place: activePlace }) : t('regionalHub.cityFeedTitle')}
                  subtitle={t('regionalHub.cityFeedSubtitle')}
                />

                {visibleNews.length === 0 ? (
                  <div className="text-sm text-slate-500">{t('regionalHub.noStoriesForSelection')}</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleNews.slice(0, 6).map((item) => (
                      <article key={item.id} className="rounded-2xl border p-4 hover:shadow-sm">
                        <div className="flex items-center justify-between">
                          <Chip>{item.category}</Chip>
                          <ClientTime iso={item.publishedAt} />
                        </div>
                        <h3 className="mt-2 font-semibold leading-snug">{item.title}</h3>
                        {item.summary && <p className="text-sm text-slate-600 mt-1">{item.summary}</p>}
                        <div className="mt-3 text-sm text-slate-500">{item.district}</div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-10">
                <SectionTitle title={t('regionalHub.voicesTitle')} subtitle={t('regionalHub.voicesSubtitle')} />
                {visibleYouth.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    {t('regionalHub.noYouthStories')} {t('regionalHub.noYouthStoriesHint')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleYouth.map((y) => (
                      <article key={y.id} className="rounded-2xl border p-4 hover:shadow-sm">
                        <Chip tone="info">Youth Pulse</Chip>
                        <h3 className="mt-2 font-semibold leading-snug">{y.title}</h3>
                        {y.summary && <p className="text-sm text-slate-600 mt-1">{y.summary}</p>}
                        <div className="mt-3 text-sm text-slate-500">{y.district}</div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-10">
                <SectionTitle title={t('regionalHub.cityInMotionTitle')} subtitle={t('regionalHub.cityInMotionSubtitle')} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    "https://www.youtube.com/embed/dQw4w9WgXcQ",
                    "https://www.youtube.com/embed/oHg5SJYRHA0",
                  ].map((src, i) => (
                    <div key={i} className="aspect-video rounded-2xl overflow-hidden border">
                      <iframe
                        className="w-full h-full"
                        src={src}
                        title={`video-${i}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Tab 4: Civic */}
          {tab === "civic" && (
            <section>
              <SectionTitle title={t('regionalHub.civicTitle')} subtitle={t('regionalHub.civicSubtitle')} />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label={t('regionalHub.metricRainfallAlerts')} value={metrics?.rainfallAlertDistricts ?? "—"} hint={t('regionalHub.metricHintDistricts')} />
                <MetricCard label={t('regionalHub.metricWaterSupplyOk')} value={metrics?.waterSupplyOK ?? "—"} hint={t('regionalHub.metricHintDistricts')} />
                <MetricCard label={t('regionalHub.metricProjectsTracked')} value={metrics?.projectsTracked ?? "—"} hint={t('regionalHub.metricHintActive')} />
                <MetricCard label={t('regionalHub.metricElectionNotices')} value={metrics?.electionNotices ?? "—"} hint={t('regionalHub.metricHintThisWeek')} />
              </div>

              <div className="mt-10">
                <SectionTitle title={t('regionalHub.developmentProjectsTitle')} subtitle={t('regionalHub.developmentProjectsSubtitle')} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {["Ahmedabad Metro Phase-2", "Dholera SIR Solar Park", "Narmada Canal Modernization"].map((p, i) => (
                    <div key={i} className="rounded-2xl border p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{p}</h3>
                        <Chip tone={i === 0 ? "success" : i === 1 ? "info" : "warning"}>
                          {i === 0 ? t('regionalHub.statusOnTrack') : i === 1 ? t('regionalHub.statusPlanned') : t('regionalHub.statusDelayed')}
                        </Chip>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {t('regionalHub.developmentCardHint')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Tab 5: Map */}
          {tab === "map" && (
            <section>
              <SectionTitle title={t('regionalHub.exploreOnMapTitle')} subtitle={t('regionalHub.exploreOnMapSubtitle')} />
              <div className="rounded-2xl border p-6 h-72 flex items-center justify-center text-slate-500">
                {t('regionalHub.mapPlaceholder')}
              </div>
            </section>
          )}
        </div>
      </main>
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
 
