"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useRegionalPulse } from "../src/features/regional/useRegionalPulse";
import { useYouthPulse } from "../features/youthPulse/useYouthPulse";
import { usePublicMode } from "../utils/PublicModeProvider";
import { usePublicSettings } from "../src/context/PublicSettingsContext";
import { DEFAULT_TRENDING_TOPICS, type TrendingTopic } from "../src/config/trendingTopics";
import { getTrendingTopics } from "../lib/getTrendingTopics";
import { fetchPublicNews, type Article } from "../lib/publicNewsApi";
import { toTickerTexts } from "../lib/publicBroadcast";
import { usePublicBroadcastTicker } from "../hooks/usePublicBroadcastTicker";
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle } from "../lib/contentFallback";
import OriginalTag from "../components/OriginalTag";
import { DEFAULT_NORMALIZED_PUBLIC_SETTINGS, sanitizeEmbedUrl } from "../src/lib/publicSettings";
import AdSlot from "../components/ads/AdSlot";
import type { GetStaticProps } from "next";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "../src/i18n/LanguageProvider";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  Cpu,
  Flame,
  Flag,
  Globe,
  GraduationCap,
  Home,
  Leaf,
  Menu,
  PenLine,
  Play,
  Radio,
  Search,
  Settings,
  Sparkles,
  Trophy,
  Users,
  Video,
  X,
  MapPin,
} from "lucide-react";

/**
 * News Pulse – Frontend UI V14.5.3 (Preview-Safe)
 * - Space between LIVE UPDATES (blue) and BREAKING NEWS (red)
 * - Explore Categories card like screenshot
 * - ✅ Explore Categories now follows Settings -> Category direction (LTR/RTL) (order + layout)
 * - ON/OFF toggles for major blocks
 * - App Promo + Footer sections included (toggleable)
 * - ✅ Optional backend settings sync: /api/site-settings/public (safe if not ready)
 */

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

const THEMES = [
  {
    id: "aurora",
    name: "Aurora",
    mode: "light",
    bg:
      "radial-gradient(900px circle at 18% 12%, rgba(37,99,235,0.14), transparent 50%), radial-gradient(800px circle at 78% 18%, rgba(124,58,237,0.12), transparent 54%), radial-gradient(900px circle at 62% 86%, rgba(16,185,129,0.10), transparent 58%), linear-gradient(180deg, #f8fafc 0%, #f6f7ff 40%, #ffffff 100%)",
    surface: "rgba(255,255,255,0.92)",
    surface2: "rgba(255,255,255,0.72)",
    border: "rgba(15,23,42,0.10)",
    text: "#0b1220",
    sub: "rgba(15,23,42,0.72)",
    muted: "rgba(15,23,42,0.52)",
    chip: "rgba(15,23,42,0.045)",
    chipHover: "rgba(15,23,42,0.075)",
    accent: "#2563eb",
    accent2: "#7c3aed",
    live: "#dc2626",
    breaking: "#b91c1c",
  },
  {
    id: "midnight",
    name: "Midnight",
    mode: "dark",
    bg:
      "radial-gradient(1000px circle at 16% 12%, rgba(59,130,246,0.26), transparent 48%), radial-gradient(900px circle at 78% 18%, rgba(168,85,247,0.20), transparent 52%), radial-gradient(900px circle at 65% 88%, rgba(34,197,94,0.14), transparent 56%), linear-gradient(180deg, #050814 0%, #060a18 42%, #050814 100%)",
    surface: "rgba(255,255,255,0.070)",
    surface2: "rgba(255,255,255,0.048)",
    border: "rgba(255,255,255,0.11)",
    text: "rgba(255,255,255,0.96)",
    sub: "rgba(255,255,255,0.72)",
    muted: "rgba(255,255,255,0.58)",
    chip: "rgba(255,255,255,0.06)",
    chipHover: "rgba(255,255,255,0.095)",
    accent: "#38bdf8",
    accent2: "#a78bfa",
    live: "#ef4444",
    breaking: "#f97316",
  },
] as const;

const getTheme = (id: string) => THEMES.find((t) => t.id === id) || THEMES[0];

const CATEGORIES = [
  { key: "breaking", label: "Breaking", Icon: Flame },
  { key: "regional", label: "Regional", Icon: MapPin },
  { key: "national", label: "National", Icon: Flag },
  { key: "international", label: "International", Icon: Globe },
  { key: "business", label: "Business", Icon: Briefcase },
  { key: "science-technology", label: "Science & Technology", Icon: Cpu },
  { key: "sports", label: "Sports", Icon: Trophy },
  { key: "lifestyle", label: "Lifestyle", Icon: Leaf },
  { key: "glamour", label: "Glamour", Icon: Sparkles },
  { key: "web-stories", label: "Web Stories", Icon: BookOpen },
  { key: "viral-videos", label: "Viral Videos", Icon: Video },
  { key: "editorial", label: "Editorial", Icon: PenLine },
  { key: "youth", label: "Youth Pulse", Icon: GraduationCap, badge: "NEW" },
  { key: "inspiration", label: "Inspiration Hub", Icon: Sparkles },
  { key: "community", label: "Community Reporter", Icon: Users },
] as const;

// Map categories to real routes where available
const CATEGORY_ROUTES: Record<string, string> = {
  breaking: "/breaking",
  regional: "/regional",
  national: "/national",
  international: "/international",
  business: "/business",
  "science-technology": "/science-technology",
  sports: "/sports",
  lifestyle: "/lifestyle",
  glamour: "/glamour",
  "web-stories": "/web-stories",
  "viral-videos": "/viral-videos",
  editorial: "/editorial",
  youth: "/youth-pulse",
  community: "/community-reporter",
  inspiration: "/inspiration-hub",
};

const CATEGORY_THEME: Record<string, { base: string; icon: string; hover: string; ring: string; active: string; dot: string }> = {
  breaking: {
    base: "bg-red-50 border-red-200 text-red-700",
    icon: "bg-red-100 border-red-200 text-red-700",
    hover: "hover:bg-red-100",
    ring: "focus-visible:ring-2 focus-visible:ring-red-300/50",
    active: "bg-red-100 ring-2 ring-red-300/50",
    dot: "bg-red-500/80",
  },
  regional: {
    base: "bg-emerald-50 border-emerald-200 text-emerald-700",
    icon: "bg-emerald-100 border-emerald-200 text-emerald-700",
    hover: "hover:bg-emerald-100",
    ring: "focus-visible:ring-2 focus-visible:ring-emerald-300/50",
    active: "bg-emerald-100 ring-2 ring-emerald-300/50",
    dot: "bg-emerald-500/80",
  },
  national: {
    base: "bg-amber-50 border-amber-200 text-amber-700",
    icon: "bg-amber-100 border-amber-200 text-amber-700",
    hover: "hover:bg-amber-100",
    ring: "focus-visible:ring-2 focus-visible:ring-amber-300/50",
    active: "bg-amber-100 ring-2 ring-amber-300/50",
    dot: "bg-amber-500/80",
  },
  international: {
    base: "bg-blue-50 border-blue-200 text-blue-700",
    icon: "bg-blue-100 border-blue-200 text-blue-700",
    hover: "hover:bg-blue-100",
    ring: "focus-visible:ring-2 focus-visible:ring-blue-300/50",
    active: "bg-blue-100 ring-2 ring-blue-300/50",
    dot: "bg-blue-500/80",
  },
  business: {
    base: "bg-indigo-50 border-indigo-200 text-indigo-700",
    icon: "bg-indigo-100 border-indigo-200 text-indigo-700",
    hover: "hover:bg-indigo-100",
    ring: "focus-visible:ring-2 focus-visible:ring-indigo-300/50",
    active: "bg-indigo-100 ring-2 ring-indigo-300/50",
    dot: "bg-indigo-500/80",
  },
  "science-technology": {
    base: "bg-violet-50 border-violet-200 text-violet-700",
    icon: "bg-violet-100 border-violet-200 text-violet-700",
    hover: "hover:bg-violet-100",
    ring: "focus-visible:ring-2 focus-visible:ring-violet-300/50",
    active: "bg-violet-100 ring-2 ring-violet-300/50",
    dot: "bg-violet-500/80",
  },
  sports: {
    base: "bg-cyan-50 border-cyan-200 text-cyan-700",
    icon: "bg-cyan-100 border-cyan-200 text-cyan-700",
    hover: "hover:bg-cyan-100",
    ring: "focus-visible:ring-2 focus-visible:ring-cyan-300/50",
    active: "bg-cyan-100 ring-2 ring-cyan-300/50",
    dot: "bg-cyan-500/80",
  },
  lifestyle: {
    base: "bg-rose-50 border-rose-200 text-rose-700",
    icon: "bg-rose-100 border-rose-200 text-rose-700",
    hover: "hover:bg-rose-100",
    ring: "focus-visible:ring-2 focus-visible:ring-rose-300/50",
    active: "bg-rose-100 ring-2 ring-rose-300/50",
    dot: "bg-rose-500/80",
  },
  glamour: {
    base: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700",
    icon: "bg-fuchsia-100 border-fuchsia-200 text-fuchsia-700",
    hover: "hover:bg-fuchsia-100",
    ring: "focus-visible:ring-2 focus-visible:ring-fuchsia-300/50",
    active: "bg-fuchsia-100 ring-2 ring-fuchsia-300/50",
    dot: "bg-fuchsia-500/80",
  },
  "web-stories": {
    base: "bg-yellow-50 border-yellow-200 text-yellow-700",
    icon: "bg-yellow-100 border-yellow-200 text-yellow-700",
    hover: "hover:bg-yellow-100",
    ring: "focus-visible:ring-2 focus-visible:ring-yellow-300/50",
    active: "bg-yellow-100 ring-2 ring-yellow-300/50",
    dot: "bg-yellow-500/80",
  },
  "viral-videos": {
    base: "bg-lime-50 border-lime-200 text-lime-700",
    icon: "bg-lime-100 border-lime-200 text-lime-700",
    hover: "hover:bg-lime-100",
    ring: "focus-visible:ring-2 focus-visible:ring-lime-300/50",
    active: "bg-lime-100 ring-2 ring-lime-300/50",
    dot: "bg-lime-500/80",
  },
  editorial: {
    base: "bg-slate-50 border-slate-200 text-slate-700",
    icon: "bg-slate-100 border-slate-200 text-slate-700",
    hover: "hover:bg-slate-100",
    ring: "focus-visible:ring-2 focus-visible:ring-slate-300/50",
    active: "bg-slate-100 ring-2 ring-slate-300/50",
    dot: "bg-slate-500/80",
  },
  youth: {
    base: "bg-sky-50 border-sky-200 text-sky-700",
    icon: "bg-sky-100 border-sky-200 text-sky-700",
    hover: "hover:bg-sky-100",
    ring: "focus-visible:ring-2 focus-visible:ring-sky-300/50",
    active: "bg-sky-100 ring-2 ring-sky-300/50",
    dot: "bg-sky-500/80",
  },
  inspiration: {
    base: "bg-teal-50 border-teal-200 text-teal-700",
    icon: "bg-teal-100 border-teal-200 text-teal-700",
    hover: "hover:bg-teal-100",
    ring: "focus-visible:ring-2 focus-visible:ring-teal-300/50",
    active: "bg-teal-100 ring-2 ring-teal-300/50",
    dot: "bg-teal-500/80",
  },
  community: {
    base: "bg-orange-50 border-orange-200 text-orange-700",
    icon: "bg-orange-100 border-orange-200 text-orange-700",
    hover: "hover:bg-orange-100",
    ring: "focus-visible:ring-2 focus-visible:ring-orange-300/50",
    active: "bg-orange-100 ring-2 ring-orange-300/50",
    dot: "bg-orange-500/80",
  },
  __default: {
    base: "bg-slate-50 border-slate-200 text-slate-700",
    icon: "bg-slate-100 border-slate-200 text-slate-700",
    hover: "hover:bg-slate-100",
    ring: "focus-visible:ring-2 focus-visible:ring-slate-300/50",
    active: "bg-slate-100 ring-2 ring-slate-300/50",
    dot: "bg-slate-500/80",
  },
};

// plug backend later
const BREAKING_FROM_BACKEND: string[] = [];
const BREAKING_DEMO: string[] = [
  "City issues advisory as heavy rain expected in key districts",
  "Markets steady; investors await next policy signals",
  "Health department shares seasonal advisory for citizens",
  "International summit opens with climate focus and pledges",
];

const TRENDING_CHIP_THEME: Record<
  TrendingTopic["colorKey"],
  { base: string; hover: string; ring: string; active: string }
> = {
  trending: {
    base: "bg-gradient-to-r from-red-50 to-pink-50 border-red-200 text-red-700",
    hover: "hover:from-red-100 hover:to-pink-100 hover:border-red-300",
    ring: "focus-visible:ring-2 focus-visible:ring-red-300/50",
    active: "from-red-100 to-pink-100 border-red-400",
  },
  breaking: {
    base: "bg-gradient-to-r from-rose-50 to-orange-50 border-rose-200 text-rose-700",
    hover: "hover:from-rose-100 hover:to-orange-100 hover:border-rose-300",
    ring: "focus-visible:ring-2 focus-visible:ring-rose-300/50",
    active: "from-rose-100 to-orange-100 border-rose-400",
  },
  sports: {
    base: "bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 text-cyan-700",
    hover: "hover:from-cyan-100 hover:to-blue-100 hover:border-cyan-300",
    ring: "focus-visible:ring-2 focus-visible:ring-cyan-300/50",
    active: "from-cyan-100 to-blue-100 border-cyan-400",
  },
  gold: {
    base: "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 text-amber-800",
    hover: "hover:from-amber-100 hover:to-yellow-100 hover:border-amber-300",
    ring: "focus-visible:ring-2 focus-visible:ring-amber-300/50",
    active: "from-amber-100 to-yellow-100 border-amber-400",
  },
  fuel: {
    base: "bg-gradient-to-r from-emerald-50 to-lime-50 border-emerald-200 text-emerald-700",
    hover: "hover:from-emerald-100 hover:to-lime-100 hover:border-emerald-300",
    ring: "focus-visible:ring-2 focus-visible:ring-emerald-300/50",
    active: "from-emerald-100 to-lime-100 border-emerald-400",
  },
  weather: {
    base: "bg-gradient-to-r from-sky-50 to-indigo-50 border-sky-200 text-sky-700",
    hover: "hover:from-sky-100 hover:to-indigo-100 hover:border-sky-300",
    ring: "focus-visible:ring-2 focus-visible:ring-sky-300/50",
    active: "from-sky-100 to-indigo-100 border-sky-400",
  },
  gujarat: {
    base: "bg-gradient-to-r from-emerald-50 to-teal-50 border-teal-200 text-teal-700",
    hover: "hover:from-emerald-100 hover:to-teal-100 hover:border-teal-300",
    ring: "focus-visible:ring-2 focus-visible:ring-teal-300/50",
    active: "from-emerald-100 to-teal-100 border-teal-400",
  },
  markets: {
    base: "bg-gradient-to-r from-indigo-50 to-fuchsia-50 border-indigo-200 text-indigo-700",
    hover: "hover:from-indigo-100 hover:to-fuchsia-100 hover:border-indigo-300",
    ring: "focus-visible:ring-2 focus-visible:ring-indigo-300/50",
    active: "from-indigo-100 to-fuchsia-100 border-indigo-400",
  },
  tech: {
    base: "bg-gradient-to-r from-violet-50 to-sky-50 border-violet-200 text-violet-700",
    hover: "hover:from-violet-100 hover:to-sky-100 hover:border-violet-300",
    ring: "focus-visible:ring-2 focus-visible:ring-violet-300/50",
    active: "from-violet-100 to-sky-100 border-violet-400",
  },
  education: {
    base: "bg-gradient-to-r from-rose-50 to-amber-50 border-rose-200 text-rose-700",
    hover: "hover:from-rose-100 hover:to-amber-100 hover:border-rose-300",
    ring: "focus-visible:ring-2 focus-visible:ring-rose-300/50",
    active: "from-rose-100 to-amber-100 border-rose-400",
  },
  __default: {
    base: "bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200 text-slate-700",
    hover: "hover:from-slate-100 hover:to-slate-200 hover:border-slate-300",
    ring: "focus-visible:ring-2 focus-visible:ring-slate-300/50",
    active: "from-slate-100 to-slate-200 border-slate-400",
  },
};

const MENU_QUICK_THEME: Record<"home" | "videos" | "search", { base: string; hover: string; ring: string }> = {
  home: {
    base: "bg-gradient-to-r from-sky-50 to-indigo-50 border-sky-200 text-sky-700",
    hover: "hover:from-sky-100 hover:to-indigo-100 hover:border-sky-300",
    ring: "focus-visible:ring-2 focus-visible:ring-sky-300/50",
  },
  videos: {
    base: "bg-gradient-to-r from-emerald-50 to-lime-50 border-emerald-200 text-emerald-700",
    hover: "hover:from-emerald-100 hover:to-lime-100 hover:border-emerald-300",
    ring: "focus-visible:ring-2 focus-visible:ring-emerald-300/50",
  },
  search: {
    base: "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 text-amber-800",
    hover: "hover:from-amber-100 hover:to-yellow-100 hover:border-amber-300",
    ring: "focus-visible:ring-2 focus-visible:ring-amber-300/50",
  },
};

const FEATURED = [
  {
    id: "f1",
    kicker: "Top Story",
    title: "Rain alert issued across key districts",
    desc: "What to expect in the next 24 hours — and what citizens should do.",
    time: "11:12 AM",
    source: "Regional Desk",
  },
];

const FEED = [
  {
    id: "t1",
    title: "Global summit highlights: what changed today",
    desc: "Key lines from the announcements — explained in simple terms.",
    time: "10:01 AM",
    source: "World Desk",
    category: "International",
  },
  {
    id: "t2",
    title: "New policy update could reshape local business",
    desc: "Who benefits, what changes, and what to watch next.",
    time: "9:38 AM",
    source: "Business Desk",
    category: "Business",
  },
  {
    id: "t3",
    title: "AI chips: why the next wave of devices will feel different",
    desc: "On-device intelligence, privacy, and the new performance race.",
    time: "9:10 AM",
    source: "Tech Desk",
    category: "Science & Technology",
  },
];

const DEFAULT_PREFS = {
  themeId: "aurora",
  lang: "English",

  liveTvEmbedUrl: "",
  showPreviewNotice: true,
};

type UiLangCode = 'en' | 'hi' | 'gu';

const UI_LANG_LABEL: Record<UiLangCode, string> = {
  en: 'English',
  hi: 'Hindi',
  gu: 'Gujarati',
};

function toUiLangCode(value: unknown): UiLangCode {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'hi' || v === 'hindi') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

function safeJsonParse(v: string) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function clampNum(n: any, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { getMessages } = await import("../lib/getMessages");
  return {
    props: {
      messages: await getMessages(locale as string),
    },
  };
};

function normalizePrefs(input: any) {
  const p = { ...DEFAULT_PREFS, ...(input || {}) };

  if (!THEMES.some((t) => t.id === p.themeId)) p.themeId = DEFAULT_PREFS.themeId;
  if (!["English", "Hindi", "Gujarati"].includes(p.lang)) p.lang = DEFAULT_PREFS.lang;
  p.showPreviewNotice = !!p.showPreviewNotice;
  p.liveTvEmbedUrl = typeof p.liveTvEmbedUrl === "string" ? p.liveTvEmbedUrl : "";

  // Legacy fields (module toggles / ticker controls) are intentionally ignored.
  const legacyKeys = [
    'breakingMode',
    'liveTickerOn',
    'liveTvOn',
    'showBreakingWhenEmpty',
    'liveSpeedSec',
    'breakingSpeedSec',
    'showCategoryStrip',
    'showTrendingStrip',
    'showExploreCategories',
    'showLiveTvCard',
    'showQuickTools',
    'showSnapshots',
    'showAppPromo',
    'showFooter',
  ];
  legacyKeys.forEach((k) => {
    if ((p as any)[k] !== undefined) delete (p as any)[k];
  });

  // Remove deprecated category direction from persisted prefs
  if ((p as any).catFlow !== undefined) delete (p as any).catFlow;

  return p;
}

function safeTitle(raw: unknown): string {
  return String(raw || '').trim();
}

function articleToTickerText(a: Article, requestedLang: 'en' | 'hi' | 'gu'): string | null {
  const { text } = resolveArticleTitle(a as any, requestedLang);
  const title = safeTitle(text || (a as any)?.title);
  return title ? title : null;
}

function articleToFeedItem(a: Article, requestedLang: 'en' | 'hi' | 'gu') {
  const id = safeTitle((a as any)?._id || (a as any)?.id || (a as any)?.slug) || undefined;
  const titleRes = resolveArticleTitle(a as any, requestedLang);
  const descRes = resolveArticleSummaryOrExcerpt(a as any, requestedLang);

  const title = safeTitle(titleRes.text || (a as any)?.title) || 'Untitled';
  const desc = safeTitle(descRes.text || (a as any)?.summary || (a as any)?.excerpt) || '';

  const iso = safeTitle((a as any)?.publishedAt || (a as any)?.createdAt) || '';
  let time = '';
  if (iso) {
    try {
      // Hydration-safe: use a fixed timezone so SSR and client match.
      time = new Intl.DateTimeFormat('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(iso));
    } catch {
      time = '';
    }
  }

  const source = safeTitle((a as any)?.source?.name || (a as any)?.source) || 'News Pulse';
  const category = safeTitle((a as any)?.category) || '';

  return {
    id: id || title,
    title,
    desc,
    titleIsOriginal: titleRes.isOriginal,
    descIsOriginal: descRes.isOriginal,
    time: time || '—',
    source,
    category,
  };
}

function labelKeyForCategory(key: string): string {
  if (key === 'science-technology') return 'categories.scienceTechnology';
  if (key === 'web-stories') return 'categories.webStories';
  if (key === 'viral-videos') return 'categories.viralVideos';
  if (key === 'youth') return 'categories.youthPulse';
  if (key === 'inspiration') return 'categories.inspirationHub';
  if (key === 'community') return 'categories.communityReporter';
  return `categories.${key}`;
}

function labelKeyForTrendingTopic(key: string): string | null {
  if (key === 'breaking') return 'trending.breaking';
  if (key === 'sports') return 'trending.sports';
  if (key === 'gold-rates') return 'trending.goldRates';
  if (key === 'fuel-prices') return 'trending.fuelPrices';
  if (key === 'weather') return 'trending.weather';
  if (key === 'gujarat') return 'trending.gujarat';
  if (key === 'markets') return 'trending.markets';
  if (key === 'tech-ai') return 'trending.techAI';
  if (key === 'education') return 'trending.education';
  return null;
}

// Categories are always LTR by default
function getCats() {
  return [...CATEGORIES];
}

function Surface({ theme, className, children }: any) {
  return (
    <div
      className={cx("rounded-3xl border shadow-[0_18px_70px_-60px_rgba(0,0,0,0.40)]", className)}
      style={{ background: theme.surface, borderColor: theme.border }}
    >
      {children}
    </div>
  );
}

function Button({ theme, variant = "soft", onClick, className, children }: any) {
  const style =
    variant === "solid"
      ? { background: theme.accent, color: "#fff", borderColor: "transparent" }
      : variant === "ghost"
        ? { background: "transparent", color: theme.text, borderColor: theme.border }
        : { background: theme.surface2, color: theme.text, borderColor: theme.border };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border transition hover:opacity-[0.98]",
        className
      )}
      style={style}
    >
      {children}
    </button>
  );
}

function IconButton({ theme, onClick, label, children }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]"
      style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
    >
      {children}
    </button>
  );
}

function Drawer({ open, onClose, theme, title, children, side = "right" }: any) {
  const fromX = side === "right" ? 420 : -420;
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            onClick={onClose}
            style={{ background: "rgba(0,0,0,0.35)" }}
          />
          <motion.div
            initial={{ x: fromX, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: fromX, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className={cx(
              "fixed top-0 z-[60] h-full w-[420px] max-w-[92vw]",
              side === "right" ? "right-0" : "left-0"
            )}
          >
            <div className="h-full p-3">
              <Surface theme={theme} className="h-full overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: theme.border }}>
                  <div className="text-sm font-extrabold" style={{ color: theme.text }}>
                    {title}
                  </div>
                  <IconButton theme={theme} onClick={onClose} label="Close">
                    <X className="h-5 w-5" />
                  </IconButton>
                </div>
                <div className="h-[calc(100%-60px)] overflow-auto p-4">{children}</div>
              </Surface>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function Toast({ theme, message, onDone }: any) {
  React.useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 18, opacity: 0 }}
          className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2"
        >
          <div
            className="rounded-2xl border px-4 py-2 text-sm font-semibold shadow-lg"
            style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
          >
            {message}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ToggleRow({ theme, title, sub, value, onToggle, disabled = false }: any) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-3xl border px-4 py-3" style={{ background: theme.surface, borderColor: theme.border }}>
      <div className="min-w-0">
        <div className="text-sm font-extrabold" style={{ color: theme.text }}>
          {title}
        </div>
        {sub ? (
          <div className="mt-0.5 text-xs" style={{ color: theme.sub }}>
            {sub}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        className="relative h-7 w-12 rounded-full border transition"
        style={{ background: value ? theme.accent : theme.chip, borderColor: theme.border }}
        aria-label={`Toggle ${title}`}
        aria-disabled={disabled}
        disabled={disabled}
      >
        <span
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full"
          style={{
            background: "rgba(255,255,255,0.92)",
            left: value ? "calc(100% - 22px)" : "4px",
            transition: "left 220ms ease",
          }}
        />
      </button>
    </div>
  );
}

function ThemePicker({ theme, themeId, setThemeId }: any) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: any) => {
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = getTheme(themeId);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border"
        style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
      >
        <span className="hidden md:inline">{t('common.style')}</span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full border" style={{ background: current.accent, borderColor: theme.border }} />
          <span className="font-extrabold">{current.name}</span>
          <ChevronDown className="h-4 w-4" style={{ color: theme.muted }} />
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ y: 8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="absolute right-0 mt-2 w-56 overflow-hidden rounded-3xl border shadow-xl z-[120]"
            style={{ background: theme.surface, borderColor: theme.border }}
          >
            <div className="p-2">
              {THEMES.map((t) => {
                const active = t.id === themeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setThemeId(t.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm font-semibold border"
                    style={{
                      background: active ? theme.chipHover : theme.surface2,
                      borderColor: active
                        ? theme.mode === "dark"
                          ? "rgba(56,189,248,0.35)"
                          : "rgba(37,99,235,0.28)"
                        : theme.border,
                      color: theme.text,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border" style={{ background: getTheme(t.id).accent, borderColor: theme.border }} />
                      {t.name}
                    </span>
                    {active ? <Check className="h-4 w-4" style={{ color: theme.accent }} /> : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function LanguagePicker({
  theme,
  value,
  onChange,
  options,
}: {
  theme: any;
  value: UiLangCode;
  onChange: (next: UiLangCode) => void;
  options: Array<{ code: UiLangCode; label: string }>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: any) => {
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border"
        style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
      >
        <span className="hidden md:inline">{t('common.language')}</span>
        <span className="font-extrabold">{UI_LANG_LABEL[value] ?? UI_LANG_LABEL.en}</span>
        <ChevronDown className="h-4 w-4" style={{ color: theme.muted }} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ y: 8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="absolute right-0 mt-2 w-48 overflow-hidden rounded-3xl border shadow-xl z-[120]"
            style={{ background: theme.surface, borderColor: theme.border }}
          >
            <div className="p-2">
              {options.map((o) => {
                const active = o.code === value;
                return (
                  <button
                    key={o.code}
                    type="button"
                    onClick={() => {
                      onChange(o.code);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm font-semibold border"
                    style={{
                      background: active ? theme.chipHover : theme.surface2,
                      borderColor: active
                        ? theme.mode === "dark"
                          ? "rgba(56,189,248,0.35)"
                          : "rgba(37,99,235,0.28)"
                        : theme.border,
                      color: theme.text,
                    }}
                  >
                    <span>{o.label}</span>
                    {active ? <Check className="h-4 w-4" style={{ color: theme.accent }} /> : null}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function TickerBar({ theme, kind, items, onViewAll, durationSec }: any) {
  const { t, lang } = useI18n();
  const label = kind === "breaking" ? `🔥 ${t('home.breakingNews')}` : `🔵 ${t('home.liveUpdates')}`;
  const tickerLang = lang === 'gu' ? 'gu' : lang === 'hi' ? 'hi' : 'en';

  const defaultDurationSec = kind === 'breaking' ? 18 : 24;

  const clampSeconds = (raw: any, fallback: number) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(40, Math.max(10, n));
  };

  const safeDurationSec = clampSeconds(durationSec, defaultDurationSec);

  const stayTuned = (k: 'breaking' | 'live'): string => {
    if (tickerLang === 'hi') return k === 'breaking' ? 'कोई ब्रेकिंग न्यूज़ नहीं — अपडेट के लिए जुड़े रहें' : 'लाइव अपडेट नहीं — जुड़े रहें';
    if (tickerLang === 'gu') return k === 'breaking' ? 'હાલ કોઈ બ્રેકિંગ નથી — અપડેટ માટે જોડાયેલા રહો' : 'હાલ લાઇવ અપડેટ નથી — જોડાયેલા રહો';
    return k === 'breaking' ? 'No breaking news right now — stay tuned' : 'No live updates right now — stay tuned';
  };

  const safeItems =
    kind === "live"
      ? items?.length
        ? items
        : [t('home.noUpdates') || stayTuned('live')]
      : items?.length
        ? items
        : [t('home.noBreaking') || stayTuned('breaking')];

  const text = (safeItems?.length ? safeItems : [""]).join("  •  ");

  // Force restart of marquee when duration/lang/items change (some browsers won't re-time an in-flight animation).
  const restartKey = (() => {
    const s = `${kind}|${tickerLang}|${safeDurationSec}|${text}`;
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = (h * 33) ^ s.charCodeAt(i);
    return `${kind}-${tickerLang}-${safeDurationSec}-${(h >>> 0).toString(16)}`;
  })();

  const bg =
    kind === "breaking"
      ? `linear-gradient(90deg, ${theme.breaking} 0%, ${theme.live} 55%, ${theme.breaking} 100%)`
      : `linear-gradient(90deg, ${theme.accent} 0%, ${theme.accent2} 55%, ${theme.accent} 100%)`;

  return (
    <div className="np-marqueeWrap w-full min-w-0" aria-live="polite">
      <div className="w-full">
        <div className="w-full rounded-2xl overflow-hidden border" style={{ background: bg, borderColor: theme.border }}>
          <div className="px-3 py-2">
            <div className="flex items-center gap-3">
              <span
                className="tickerLabel inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white border"
                style={{ borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.10)" }}
                lang={tickerLang}
              >
                <Radio className="h-4 w-4" /> {label}
              </span>

              <div
                className="relative min-w-0 flex-1 overflow-hidden pr-24"
                style={{
                  WebkitMaskImage: "linear-gradient(to right, black 0%, black 90%, transparent)",
                  maskImage: "linear-gradient(to right, black 0%, black 90%, transparent)",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskSize: "100% 100%",
                  maskSize: "100% 100%",
                }}
              >
                <div
                  key={restartKey}
                  className="np-tickerTrack"
                  style={{ animationDuration: `${safeDurationSec}s` }}
                >
                  <div className="np-tickerSeq whitespace-nowrap text-sm font-medium text-white">
                    <span className="tickerText pr-10" lang={tickerLang}>{text}</span>
                  </div>
                  <div className="np-tickerSeq whitespace-nowrap text-sm font-medium text-white">
                    <span className="tickerText pr-10" lang={tickerLang}>{text}</span>
                  </div>
                </div>
              </div>

              <button type="button" onClick={onViewAll} className="text-xs font-semibold text-white/95 hover:underline flex-none relative z-10">
                {t('common.viewAll')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendingStrip({ theme, onPick }: any) {
  const router = useRouter();
  const { t } = useI18n();
  const [topics, setTopics] = useState<TrendingTopic[]>(DEFAULT_TRENDING_TOPICS);
  const [path, setPath] = useState<string>("");
  const tapState = useRef({
    down: false,
    startX: 0,
    startY: 0,
    moved: false,
    touchNavigatedAt: 0,
  });

  React.useEffect(() => {
    setPath(window.location.pathname);

    let cancelled = false;
    getTrendingTopics().then((next) => {
      if (cancelled) return;
      setTopics(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
      <div className="mt-3">
        <Surface theme={theme} className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold border"
              style={{
                background: theme.mode === "dark" ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.10)",
                borderColor: "rgba(239,68,68,0.35)",
                color: theme.mode === "dark" ? "rgba(255,255,255,0.92)" : theme.text,
              }}
            >
              <Flame className="h-4 w-4" style={{ color: theme.live }} /> {t('common.trending')}
            </span>

            <div className="np-no-scrollbar w-full overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="inline-flex items-center gap-2 pr-4">
                {topics.map((topic) => {
                  const active = !!path && path === topic.href;
                  const chipTheme = TRENDING_CHIP_THEME[topic.colorKey] || TRENDING_CHIP_THEME.__default;
                  const k = labelKeyForTrendingTopic(String(topic.key));
                  const label = k ? t(k) : topic.label;

                  const navigate = () => {
                    onPick?.(label);
                    router.push(topic.href);
                  };

                  return (
                    <Link
                      key={topic.key}
                      href={topic.href}
                      aria-current={active ? "page" : undefined}
                      onPointerDown={(e) => {
                        tapState.current.down = true;
                        tapState.current.moved = false;
                        tapState.current.startX = e.clientX;
                        tapState.current.startY = e.clientY;
                      }}
                      onPointerMove={(e) => {
                        if (!tapState.current.down || tapState.current.moved) return;
                        const dx = e.clientX - tapState.current.startX;
                        const dy = e.clientY - tapState.current.startY;
                        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) tapState.current.moved = true;
                      }}
                      onPointerUp={(e) => {
                        tapState.current.down = false;

                        // On touch inside horizontal scrollers, `click` may never fire.
                        // Route on a true tap (no significant movement).
                        if (e.pointerType === "touch" && !tapState.current.moved) {
                          e.preventDefault();
                          tapState.current.touchNavigatedAt = Date.now();
                          navigate();
                        }
                      }}
                      onClick={(e) => {
                        // Avoid double-navigation when touch `pointerup` already routed.
                        if (Date.now() - tapState.current.touchNavigatedAt < 800) {
                          e.preventDefault();
                          return;
                        }

                        // For mouse/keyboard, treat like a normal click.
                        e.preventDefault();
                        navigate();
                      }}
                      className={cx(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-semibold border cursor-pointer pointer-events-auto relative z-10",
                        "transition-all duration-150 ease-out",
                        "hover:-translate-y-[1px] hover:shadow-sm",
                        "active:translate-y-0",
                        "focus-visible:outline-none",
                        chipTheme.base,
                        chipTheme.hover,
                        chipTheme.ring,
                        active ? cx("shadow-sm", chipTheme.active) : null
                      )}
                    >
                      {label}
                    </Link>
                  );
                })}
                <div className="w-2 shrink-0" />
              </div>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function TopCategoriesStrip({ theme, activeKey, onPick }: any) {
  const { t } = useI18n();
  const cats = useMemo(() => [...CATEGORIES], []);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ down: false, startX: 0, startLeft: 0, moved: false, blockUntil: 0 });

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      dragState.current.down = true;
      dragState.current.moved = false;
      dragState.current.startX = e.clientX;
      dragState.current.startLeft = el.scrollLeft;
      (el as any).style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragState.current.down) return;
      const dx = e.clientX - dragState.current.startX;
      if (Math.abs(dx) > 6) dragState.current.moved = true;
      el.scrollLeft = dragState.current.startLeft - dx;
    };

    const onPointerUp = () => {
      if (!dragState.current.down) return;
      dragState.current.down = false;
      (el as any).style.cursor = "grab";
      if (dragState.current.moved) dragState.current.blockUntil = Date.now() + 250;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    (el as any).style.cursor = "grab";

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const labelKeyForCategory = (key: string): string => {
    if (key === 'science-technology') return 'categories.scienceTechnology';
    if (key === 'web-stories') return 'categories.webStories';
    if (key === 'viral-videos') return 'categories.viralVideos';
    if (key === 'youth') return 'categories.youthPulse';
    if (key === 'inspiration') return 'categories.inspirationHub';
    if (key === 'community') return 'categories.communityReporter';
    return `categories.${key}`;
  };

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
        <div className="rounded-2xl border border-black/10 shadow-sm ring-1 ring-black/5 bg-white/80 backdrop-blur-md">
          <div className="px-3 py-2">
            <div className="no-scrollbar w-full overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <div
                ref={scrollerRef}
                className="scroll-smooth inline-flex items-center gap-2.5"
                style={{ touchAction: "pan-x", overscrollBehaviorX: "contain" as any }}
                onWheel={(e: any) => {
                  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) (e.currentTarget.parentElement as HTMLElement)?.scrollBy?.({ left: e.deltaY, behavior: "auto" });
                }}
              >
              {cats.map((c: any) => {
                const active = c.key === activeKey;
                const chipTheme = CATEGORY_THEME[c.key] || CATEGORY_THEME.__default;
                const href = CATEGORY_ROUTES[c.key as string];
                const content = (
                  <div
                    className={cx(
                      "inline-flex items-center gap-2 whitespace-nowrap h-9 rounded-full border px-3 text-xs font-semibold transition-all duration-200 focus-visible:outline-none",
                      // Keep colorful text (from CATEGORY_THEME), but force neutral pill background/border.
                      chipTheme.base,
                      "bg-white/90 border-black/10",
                      "hover:bg-black/[0.02]",
                      "focus-visible:ring-2 focus-visible:ring-black/20",
                      active ? "border-black/20 shadow-sm" : null
                    )}
                  >
                    <span className={cx("grid place-items-center w-7 h-7 rounded-full border bg-white/90 text-slate-700", "border-black/10")}>
                      <c.Icon className="h-4 w-4" />
                    </span>
                    {t(labelKeyForCategory(c.key))}
                  </div>
                );

                if (href) {
                  return (
                    <Link
                      key={c.key}
                      href={href}
                      onClick={(e) => {
                        if (Date.now() < dragState.current.blockUntil) e.preventDefault();
                      }}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      if (Date.now() < dragState.current.blockUntil) return;
                      onPick(c.key);
                    }}
                    style={{ background: "transparent", border: "none", padding: 0, margin: 0 }}
                  >
                    {content}
                  </button>
                );
              })}
                <div className="w-2 shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExploreCategoriesPanel({ theme, prefs, activeKey, onPick }: any) {
  const { t } = useI18n();
  const cats = useMemo(() => getCats(), []);

  // Quick revert switch (for review):
  // - false: simple list styling (matches screenshots 1&2)
  // - true: current colorful card styling
  const USE_COLORFUL_CATEGORY_THEME = false as boolean;

  const labelKeyForCategory = (key: string): string => {
    if (key === 'science-technology') return 'categories.scienceTechnology';
    if (key === 'web-stories') return 'categories.webStories';
    if (key === 'viral-videos') return 'categories.viralVideos';
    if (key === 'youth') return 'categories.youthPulse';
    if (key === 'inspiration') return 'categories.inspirationHub';
    if (key === 'community') return 'categories.communityReporter';
    return `categories.${key}`;
  };

  type ExploreTone = {
    wrap: string;
    iconWrap: string;
    text: string;
    arrow: string;
    activeRing: string;
    leftBar: string;
  };

  const TONE: Record<string, ExploreTone> = {
    breaking: {
      wrap: "bg-red-50 border-red-200 hover:bg-red-50/80",
      iconWrap: "bg-red-100 border-red-200 text-red-700",
      text: "text-red-800",
      arrow: "text-red-500",
      activeRing: "ring-red-200",
      leftBar: "bg-red-500",
    },
    regional: {
      wrap: "bg-emerald-50 border-emerald-200 hover:bg-emerald-50/80",
      iconWrap: "bg-emerald-100 border-emerald-200 text-emerald-700",
      text: "text-emerald-800",
      arrow: "text-emerald-500",
      activeRing: "ring-emerald-200",
      leftBar: "bg-emerald-500",
    },
    national: {
      wrap: "bg-amber-50 border-amber-200 hover:bg-amber-50/80",
      iconWrap: "bg-amber-100 border-amber-200 text-amber-800",
      text: "text-amber-900",
      arrow: "text-amber-600",
      activeRing: "ring-amber-200",
      leftBar: "bg-amber-500",
    },
    international: {
      wrap: "bg-blue-50 border-blue-200 hover:bg-blue-50/80",
      iconWrap: "bg-blue-100 border-blue-200 text-blue-700",
      text: "text-blue-800",
      arrow: "text-blue-500",
      activeRing: "ring-blue-200",
      leftBar: "bg-blue-500",
    },
    business: {
      wrap: "bg-violet-50 border-violet-200 hover:bg-violet-50/80",
      iconWrap: "bg-violet-100 border-violet-200 text-violet-700",
      text: "text-violet-800",
      arrow: "text-violet-500",
      activeRing: "ring-violet-200",
      leftBar: "bg-violet-500",
    },
    "science-technology": {
      wrap: "bg-cyan-50 border-cyan-200 hover:bg-cyan-50/80",
      iconWrap: "bg-cyan-100 border-cyan-200 text-cyan-700",
      text: "text-cyan-800",
      arrow: "text-cyan-500",
      activeRing: "ring-cyan-200",
      leftBar: "bg-cyan-500",
    },
    sports: {
      wrap: "bg-sky-50 border-sky-200 hover:bg-sky-50/80",
      iconWrap: "bg-sky-100 border-sky-200 text-sky-700",
      text: "text-sky-800",
      arrow: "text-sky-500",
      activeRing: "ring-sky-200",
      leftBar: "bg-sky-500",
    },
    lifestyle: {
      wrap: "bg-rose-50 border-rose-200 hover:bg-rose-50/80",
      iconWrap: "bg-rose-100 border-rose-200 text-rose-700",
      text: "text-rose-800",
      arrow: "text-rose-500",
      activeRing: "ring-rose-200",
      leftBar: "bg-rose-500",
    },
    glamour: {
      wrap: "bg-fuchsia-50 border-fuchsia-200 hover:bg-fuchsia-50/80",
      iconWrap: "bg-fuchsia-100 border-fuchsia-200 text-fuchsia-700",
      text: "text-fuchsia-800",
      arrow: "text-fuchsia-500",
      activeRing: "ring-fuchsia-200",
      leftBar: "bg-fuchsia-500",
    },
    "web-stories": {
      wrap: "bg-yellow-50 border-yellow-200 hover:bg-yellow-50/80",
      iconWrap: "bg-yellow-100 border-yellow-200 text-yellow-800",
      text: "text-yellow-900",
      arrow: "text-yellow-700",
      activeRing: "ring-yellow-200",
      leftBar: "bg-yellow-500",
    },
    "viral-videos": {
      wrap: "bg-lime-50 border-lime-200 hover:bg-lime-50/80",
      iconWrap: "bg-lime-100 border-lime-200 text-lime-800",
      text: "text-lime-900",
      arrow: "text-lime-700",
      activeRing: "ring-lime-200",
      leftBar: "bg-lime-500",
    },
    editorial: {
      wrap: "bg-slate-50 border-slate-200 hover:bg-slate-50/80",
      iconWrap: "bg-slate-100 border-slate-200 text-slate-700",
      text: "text-slate-800",
      arrow: "text-slate-500",
      activeRing: "ring-slate-200",
      leftBar: "bg-slate-500",
    },
    youth: {
      wrap: "bg-indigo-50 border-indigo-200 hover:bg-indigo-50/80",
      iconWrap: "bg-indigo-100 border-indigo-200 text-indigo-700",
      text: "text-indigo-800",
      arrow: "text-indigo-500",
      activeRing: "ring-indigo-200",
      leftBar: "bg-indigo-500",
    },
    inspiration: {
      wrap: "bg-teal-50 border-teal-200 hover:bg-teal-50/80",
      iconWrap: "bg-teal-100 border-teal-200 text-teal-700",
      text: "text-teal-800",
      arrow: "text-teal-500",
      activeRing: "ring-teal-200",
      leftBar: "bg-teal-500",
    },
    community: {
      wrap: "bg-orange-50 border-orange-200 hover:bg-orange-50/80",
      iconWrap: "bg-orange-100 border-orange-200 text-orange-700",
      text: "text-orange-800",
      arrow: "text-orange-500",
      activeRing: "ring-orange-200",
      leftBar: "bg-orange-500",
    },
  };

  const DEFAULT_TONE: ExploreTone = {
    wrap: "bg-neutral-50 border-neutral-200 hover:bg-neutral-50/80",
    iconWrap: "bg-neutral-100 border-neutral-200 text-neutral-700",
    text: "text-neutral-800",
    arrow: "text-neutral-500",
    activeRing: "ring-neutral-200",
    leftBar: "bg-neutral-400",
  };

  return (
    <Surface theme={theme} className="p-4">
      <div className="text-base font-extrabold" style={{ color: theme.text }}>
        {t('home.exploreCategories')}
      </div>
      <div className="mt-1 text-xs" style={{ color: theme.sub }}>
        {t('home.tapToFilter')}
      </div>

      <div className="mt-4 grid gap-3">
        {cats.map((c: any) => {
          const active = c.key === activeKey;
          const href = CATEGORY_ROUTES[c.key as string];
          const tone = TONE[c.key as string] ?? DEFAULT_TONE;

          const wrapClassName = USE_COLORFUL_CATEGORY_THEME
            ? [
                'relative flex items-center gap-3 rounded-3xl border transition',
                'h-14 px-4',
                tone.wrap,
                active ? `ring-2 ${tone.activeRing}` : '',
              ].join(' ')
            : [
                'relative flex items-center gap-3 rounded-2xl border transition',
                'h-14 px-4',
                'bg-white border-black/10',
                active ? 'border-black/20 shadow-sm' : '',
              ].join(' ');

          const content = (
            <div
              className={wrapClassName}
            >
              {USE_COLORFUL_CATEGORY_THEME ? (
                <span className={["absolute left-0 top-3 bottom-3 w-1 rounded-full", tone.leftBar].join(" ")} />
              ) : null}

              <span
                className={cx(
                  "grid place-items-center w-10 h-10 border",
                  USE_COLORFUL_CATEGORY_THEME ? "rounded-2xl" : "rounded-full",
                  tone.iconWrap,
                  USE_COLORFUL_CATEGORY_THEME ? null : "border-black/10"
                )}
              >
                <c.Icon className="w-5 h-5" />
              </span>

              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={["block text-[15px] font-bold truncate", tone.text].join(" ")}>{t(labelKeyForCategory(c.key))}</span>
                  {c.badge ? (
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold",
                        "bg-white/60 border-black/10",
                        tone.text,
                      ].join(" ")}
                    >
                      {t('common.new')}
                    </span>
                  ) : null}
                </span>
              </span>

              {USE_COLORFUL_CATEGORY_THEME ? (
                <ArrowRight className={["ml-auto w-5 h-5", tone.arrow].join(" ")} />
              ) : null}
            </div>
          );

          return href ? (
            <Link key={c.key} href={href}>{content}</Link>
          ) : (
            <button
              key={c.key}
              type="button"
              onClick={() => onPick(c.key)}
              style={{ background: "transparent", border: "none", padding: 0, margin: 0, width: "100%" }}
            >
              {content}
            </button>
          );
        })}
      </div>
    </Surface>
  );
}

function FeaturedCard({ theme, item, onToast }: any) {
  const { t } = useI18n();
  return (
    <Surface theme={theme} className="overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold border"
            style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
          >
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: theme.live }} />
            {item.kicker}
          </span>
          <div className="hidden sm:flex items-center gap-2 text-xs" style={{ color: theme.sub }}>
            <span className="rounded-full px-2.5 py-1 border" style={{ background: theme.chip, borderColor: theme.border }}>
              {item.time}
            </span>
            <span style={{ opacity: 0.55 }}>•</span>
            <span>{item.source}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xl sm:text-2xl font-black tracking-tight" style={{ color: theme.text }}>
          <span>{item.title}</span>
          {item.titleIsOriginal ? <OriginalTag /> : null}
        </div>
        <div className="mt-1 text-sm" style={{ color: theme.sub }}>
          {item.desc}
          {item.descIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button theme={theme} variant="solid" onClick={() => onToast("Open featured story (planned)")}>
            {t('common.read')} <ArrowRight className="h-4 w-4" />
          </Button>
          <Button theme={theme} variant="soft" onClick={() => onToast("Watch / Listen (planned)")}>
            <Play className="h-4 w-4" /> {t('common.watch')}
          </Button>
        </div>
      </div>
    </Surface>
  );
}

function FeedList({ theme, title, items, onOpen }: any) {
  const { t } = useI18n();
  return (
    <Surface theme={theme} className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold" style={{ color: theme.text }}>
            {title}
          </div>
          <div className="text-xs" style={{ color: theme.sub }}>
            {t('home.freshUpdates')}
          </div>
        </div>
        <Button theme={theme} variant="soft" onClick={() => onOpen("viewall")}>
          {t('common.viewAll')}
        </Button>
      </div>

      <div className="mt-4 grid gap-3">
        {items.map((f: any) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onOpen(f.id)}
            className="rounded-3xl border p-4 text-left transition hover:opacity-[0.98]"
            style={{ background: theme.surface2, borderColor: theme.border }}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: theme.sub }}>
              <span className="rounded-full px-2.5 py-1 border" style={{ background: theme.chip, borderColor: theme.border }}>
                {f.time}
              </span>
              <span style={{ opacity: 0.55 }}>•</span>
              <span>{f.source}</span>
              {f.category ? (
                <>
                  <span style={{ opacity: 0.55 }}>•</span>
                  <span className="rounded-full px-2.5 py-1 border" style={{ background: theme.chip, borderColor: theme.border }}>
                    {f.category}
                  </span>
                </>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-base font-extrabold" style={{ color: theme.text }}>
              <span>{f.title}</span>
              {f.titleIsOriginal ? <OriginalTag /> : null}
            </div>
            <div className="mt-1 text-sm" style={{ color: theme.sub }}>
              {f.desc}
              {f.descIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
            </div>
          </button>
        ))}
      </div>
    </Surface>
  );
}

function LiveTVWidget({ theme, enabled = true, onToast, embedUrlOverride }: any) {
  const { t } = useI18n();
  if (!enabled) return null;

  const effectiveEmbedUrlRaw = (typeof embedUrlOverride === 'string' && embedUrlOverride.trim()) ? embedUrlOverride : '';
  const effectiveEmbedUrl = sanitizeEmbedUrl(effectiveEmbedUrlRaw);
  const hasUrl = !!effectiveEmbedUrl;

  return (
    <Surface theme={theme} className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-extrabold" style={{ color: theme.text }}>
            {t('common.liveTv')}
          </div>
          <div className="text-xs" style={{ color: theme.sub }}>
            {t('home.liveTvPartnerChannel')}
          </div>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-extrabold border text-white" style={{ background: theme.live, borderColor: "rgba(255,255,255,0.18)" }}>
          {t('common.live')}
        </span>
      </div>

      <div className="mt-3 rounded-3xl border overflow-hidden" style={{ borderColor: theme.border, background: theme.surface2 }}>
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          {hasUrl ? (
            <iframe
              title="News Pulse Live TV"
              src={effectiveEmbedUrl}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold" style={{ color: theme.sub }}>
              {t('home.liveTvAddEmbedUrl')}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <Button theme={theme} variant="soft" className="w-full justify-start" onClick={() => onToast("Live TV full page (planned)")}>
          <Play className="h-4 w-4" /> {t('common.openLiveTv')}
        </Button>

        <Button
          theme={theme}
          variant="ghost"
          className="w-full justify-start"
          onClick={() => onToast("Live TV visibility is admin-controlled")}
        >
          <X className="h-4 w-4" /> {t('home.turnOffWidget')}
        </Button>
      </div>
    </Surface>
  );
}

function QuickToolsCard({ theme, onToast }: any) {
  const { t } = useI18n();
  return (
    <Surface theme={theme} className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-extrabold" style={{ color: theme.text }}>
            {t('home.quickToolsTitle')}
          </div>
          <div className="text-xs" style={{ color: theme.sub }}>
            {t('home.quickToolsSubtitle')}
          </div>
        </div>
        <Bell className="h-5 w-5" style={{ color: theme.muted }} />
      </div>

      <div className="mt-3 grid gap-2">
        <Button theme={theme} variant="soft" className="w-full justify-start" onClick={() => onToast("AI Explainer (planned)")}>
          <Sparkles className="h-4 w-4" /> {t('home.aiExplainer')}
        </Button>
        <Button theme={theme} variant="soft" className="w-full justify-start" onClick={() => onToast("Swipe-to-Listen (planned)")}>
          <Play className="h-4 w-4" /> {t('home.swipeToListen')}
        </Button>
        <Button theme={theme} variant="soft" className="w-full justify-start" onClick={() => onToast("Viral Videos (planned)")}>
          <Video className="h-4 w-4" /> {t('categories.viralVideos')}
        </Button>
      </div>
    </Surface>
  );
}

function SnapshotsCard({ theme }: any) {
  const { t } = useI18n();
  return (
    <Surface theme={theme} className="p-4">
      <div className="text-sm font-extrabold" style={{ color: theme.text }}>
        {t('home.snapshotsTitle')}
      </div>
      <div className="mt-1 text-xs" style={{ color: theme.sub }}>
        {t('home.snapshotsSubtitle')}
      </div>

      <div className="mt-3 grid gap-2">
        {[
          { k: t('home.snapshotWeather'), v: "27°C • Cloudy" },
          { k: t('home.snapshotMarkets'), v: "Stable" },
          { k: t('home.snapshotGold'), v: "₹ — (api)" },
        ].map((x) => (
          <div key={x.k} className="rounded-2xl border px-3 py-2" style={{ background: theme.surface2, borderColor: theme.border }}>
            <div className="text-xs" style={{ color: theme.muted }}>
              {x.k}
            </div>
            <div className="text-sm font-extrabold" style={{ color: theme.text }}>
              {x.v}
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

function PreferencesDrawer({ theme, open, onClose, moduleState, onToast }: any) {
  return (
    <Drawer open={open} onClose={onClose} theme={theme} title="Settings">
      <div className="space-y-4">
        

        <div className="rounded-3xl border p-4" style={{ background: theme.surface2, borderColor: theme.border }}>
          <div className="text-sm font-extrabold" style={{ color: theme.text }}>
            Home layout modules
          </div>
          <div className="mt-2 text-sm" style={{ color: theme.sub }}>
            Admin Panel is the only source of truth (read-only here).
          </div>

          <div className="mt-3 grid gap-2">
            <ToggleRow theme={theme} disabled title="Category strip" sub="Top horizontal categories bar" value={!!moduleState?.categoryStrip} />
            <ToggleRow theme={theme} disabled title="Trending strip" sub="Trending chips row" value={!!moduleState?.trending} />
            <ToggleRow theme={theme} disabled title="Explore Categories" sub="Left sidebar category list" value={!!moduleState?.explore} />
            <ToggleRow theme={theme} disabled title="Live TV card" sub="Left sidebar Live TV widget" value={!!moduleState?.liveTvCard} />
            <ToggleRow theme={theme} disabled title="Quick tools" sub="Left sidebar quick tools buttons" value={!!moduleState?.quickTools} />
            <ToggleRow theme={theme} disabled title="Snapshots" sub="Left sidebar snapshot cards" value={!!moduleState?.snapshots} />
            <ToggleRow theme={theme} disabled title="App promo section" sub="‘Take News Pulse Everywhere’ block" value={!!moduleState?.appPromo} />
            <ToggleRow theme={theme} disabled title="Footer" sub="Full footer with quick links" value={!!moduleState?.footer} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            theme={theme}
            variant="ghost"
            onClick={() => {
              onToast("Settings are admin-controlled");
            }}
          >
            Reset
          </Button>
          <Button theme={theme} variant="solid" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

function AppPromoSection({ theme, onToast }: any) {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 pb-10 pt-2">
      <Surface theme={theme} className="overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6">
              <div className="text-4xl sm:text-5xl font-black leading-[1.05]" style={{ color: theme.text }}>
                {t('home.appPromoTitlePrefix')}{" "}
                <span
                  className="px-2 py-1 rounded-2xl"
                  style={{
                    background:
                      theme.mode === "dark"
                        ? "linear-gradient(90deg, rgba(56,189,248,0.20), rgba(167,139,250,0.16))"
                        : "linear-gradient(90deg, rgba(37,99,235,0.12), rgba(124,58,237,0.10))",
                  }}
                >
                  <span style={{ color: theme.accent }}>News</span> <span style={{ color: theme.accent2 }}>Pulse</span>
                </span>{" "}
                {t('home.appPromoTitleSuffix')}
              </div>

              <div className="mt-4 text-sm sm:text-base" style={{ color: theme.sub }}>
                {t('home.appPromoSubtitle')}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onToast(`${t('common.appStore')} (planned)`) }
                  className="rounded-3xl px-5 py-4 text-sm font-extrabold border transition hover:opacity-[0.98] inline-flex items-center gap-2"
                  style={{
                    background: theme.mode === "dark" ? "rgba(0,0,0,0.55)" : "#0b1220",
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <BookOpen className="h-5 w-5" />
                  {t('common.appStore')}
                </button>

                <button
                  type="button"
                  onClick={() => onToast(`${t('common.googlePlay')} (planned)`) }
                  className="rounded-3xl px-5 py-4 text-sm font-extrabold border transition hover:opacity-[0.98] inline-flex items-center gap-2"
                  style={{
                    background: `linear-gradient(90deg, rgba(16,185,129,0.95), ${theme.accent} 60%)`,
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <Play className="h-5 w-5" />
                  {t('common.googlePlay')}
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-6 text-sm" style={{ color: theme.sub }}>
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: theme.accent2 }} /> {t('home.appPromoRating')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" style={{ color: theme.accent }} /> {t('home.appPromoDownloads')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Globe className="h-4 w-4" style={{ color: theme.accent }} /> {t('common.availableIn3Languages')}
                </span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div
                className="rounded-[28px] border shadow-[0_40px_120px_-80px_rgba(0,0,0,0.60)] overflow-hidden"
                style={{
                  borderColor: theme.border,
                  background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.accent2} 100%)`,
                }}
              >
                <div className="p-8 sm:p-10 text-white">
                  <div
                    className="mx-auto mb-6 h-14 w-14 rounded-2xl border flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.22)" }}
                  >
                    <span className="text-2xl">📱</span>
                  </div>

                  <div className="text-center text-2xl sm:text-3xl font-black">{t('home.appPromoPreviewTitle')}</div>
                  <div className="mt-2 text-center text-sm text-white/90 font-semibold">{t('home.appPromoPreviewSubtitle')}</div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-8 text-sm font-semibold text-white/95">
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> {t('home.appPromoFeatureAnalytics')}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Bell className="h-4 w-4" /> {t('home.appPromoFeatureNotifications')}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> {t('home.appPromoFeatureOfflineReading')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-center text-xs" style={{ color: theme.sub }}>
                {t('home.appPromoNote')}
              </div>
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}

function SiteFooter({ theme, onToast, footerTextOverride }: any) {
  const { t } = useI18n();

  const footerBg =
    theme.mode === "dark"
      ? "linear-gradient(180deg, rgba(10,14,35,0.95) 0%, rgba(7,10,24,0.98) 100%)"
      : "linear-gradient(180deg, rgba(10,14,35,0.92) 0%, rgba(7,10,24,0.98) 100%)";

  return (
    <div className="mt-6" style={{ background: footerBg }}>
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 py-10">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="text-3xl font-black text-white">
              News <span style={{ color: theme.accent2 }}>Pulse</span>
            </div>
            <div className="mt-3 text-sm text-white/80 leading-relaxed">
              {(typeof footerTextOverride === 'string' && footerTextOverride.trim()) ? footerTextOverride.trim() : t('footer.description')}
            </div>

            <div className="mt-6 flex items-center gap-3">
              {[
                { label: t('footer.iconCommunity'), icon: Users },
                { label: t('common.videos'), icon: Video },
                { label: t('common.live'), icon: Radio },
                { label: t('footer.iconWorld'), icon: Globe },
              ].map((x) => (
                <button
                  key={x.label}
                  type="button"
                  onClick={() => onToast(`${x.label} (planned)`)}
                  className="h-12 w-12 rounded-2xl border flex items-center justify-center transition hover:opacity-[0.98]"
                  style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)", color: "white" }}
                  aria-label={x.label}
                  title={x.label}
                >
                  <x.icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-4">
            <div className="text-lg font-extrabold" style={{ color: theme.accent }}>
              {t('footer.quickLinksTitle')}
            </div>
            <div className="mt-4 grid gap-3 text-sm text-white/85">
              {[t('footer.aboutUs'), t('footer.editorialPolicy'), t('footer.privacyPolicy'), t('footer.termsOfService'), t('common.contact'), t('footer.careers'), t('common.communityReporter'), t('footer.journalistDesk')].map((label) => (
                <button key={label} type="button" onClick={() => onToast(`${label} (planned)`) } className="text-left hover:underline">
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="text-lg font-extrabold" style={{ color: theme.accent2 }}>
              {t('footer.businessTitle')}
            </div>
            <div className="mt-4 grid gap-3 text-sm text-white/85">
              {[t('footer.advertiseWithUs'), t('footer.mediaKit'), t('footer.partnerships'), t('footer.rssFeeds'), t('footer.apiAccess'), t('footer.licensing')].map((label) => (
                <button key={label} type="button" onClick={() => onToast(`${label} (planned)`) } className="text-left hover:underline">
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <div className="text-xs text-white/70">{t('footer.copyright')}</div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-white/80">
            <span className="inline-flex items-center gap-2">
              <Globe className="h-4 w-4" /> {t('common.availableIn3Languages')}
            </span>
            <span className="inline-flex items-center gap-2">
              <Video className="h-4 w-4" /> {t('common.mobileAndWeb')}
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4" /> {t('common.secureAndPrivate')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UiPreviewV145() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const [prefs, setPrefs] = useState<any>(DEFAULT_PREFS);
  const theme = useMemo(() => getTheme(prefs.themeId), [prefs.themeId]);
  usePublicMode();

  const getUnprefixedPath = React.useCallback((asPath: string): string => {
    const raw = String(asPath || '/');
    const hashSplit = raw.split('#');
    const beforeHash = hashSplit[0] || '/';
    const hash = hashSplit.length > 1 ? `#${hashSplit.slice(1).join('#')}` : '';

    const qSplit = beforeHash.split('?');
    const pathPart = qSplit[0] || '/';
    const query = qSplit.length > 1 ? `?${qSplit.slice(1).join('?')}` : '';

    const p = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
    const withoutPrefix = p.replace(/^\/(en|hi|gu)(?=\/|$)/i, '');
    const rest = withoutPrefix.startsWith('/') ? withoutPrefix : `/${withoutPrefix}`;
    const normalizedRest = rest === '/' ? '/' : rest;
    return `${normalizedRest}${query}${hash}`;
  }, []);

  // Public settings drawer must be explicitly enabled (developer/founder mode).
  // Default is OFF so public users can't toggle live site modules.
  const enablePublicSettingsDrawer = String(process.env.NEXT_PUBLIC_ENABLE_PUBLIC_SETTINGS_DRAWER || '').toLowerCase() === 'true';

  const {
    settings,
    isLoading: settingsLoading,
    error: settingsError,
  } = usePublicSettings();

  const effectiveSettings = settings ?? DEFAULT_NORMALIZED_PUBLIC_SETTINGS;

  const [breakingFromBackend, setBreakingFromBackend] = useState<string[]>([]);
  const [liveFromBackend, setLiveFromBackend] = useState<string[]>([]);
  const [latestFromBackend, setLatestFromBackend] = useState<any[]>([]);

  const [broadcastBreakingEnabled, setBroadcastBreakingEnabled] = useState<boolean | null>(null);
  const [broadcastLiveEnabled, setBroadcastLiveEnabled] = useState<boolean | null>(null);
  const [broadcastBreakingSpeedSec, setBroadcastBreakingSpeedSec] = useState<number | null>(null);
  const [broadcastLiveSpeedSec, setBroadcastLiveSpeedSec] = useState<number | null>(null);

  const apiLang = useMemo(() => {
    const code = toUiLangCode(lang);
    return (code === 'en' ? 'en' : code === 'hi' ? 'hi' : 'gu') as 'en' | 'hi' | 'gu';
  }, [lang]);

  const broadcastTickers = usePublicBroadcastTicker({ lang: apiLang, pollMs: 10_000, enableSse: true });

  const [activeCatKey, setActiveCatKey] = useState<string>("breaking");
  const [toast, setToast] = useState<string>("");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [viewAllKind, setViewAllKind] = useState<"live" | "breaking">("live");

  // Real data hooks
  const regional = useRegionalPulse("gujarat");
  const youth = useYouthPulse();

  // Keep preview prefs in sync with global language (source of truth for UI i18n)
  React.useEffect(() => {
    const code = toUiLangCode(lang);
    setPrefs((p: any) => ({ ...p, lang: UI_LANG_LABEL[code] }));
  }, [lang]);


  // Fetch homepage data (latest) from backend.
  React.useEffect(() => {
    const controller = new AbortController();

    (async () => {
      // Latest news list (homepage)
      const latestResp = await fetchPublicNews({ language: apiLang, limit: 12, signal: controller.signal });
      if (controller.signal.aborted) return;
      const latestArticles = latestResp.items || [];
      setLatestFromBackend(latestArticles.map((a) => articleToFeedItem(a as any, apiLang)));
      const breakingResp = await fetchPublicNews({ category: 'breaking', language: apiLang, limit: 10, signal: controller.signal });
      if (controller.signal.aborted) return;

      // Keep this fetch for other UI uses; tickers now come from broadcast hook.
      void breakingResp;
    })().catch(() => {
      if (controller.signal.aborted) return;
      setLatestFromBackend([]);
    });

    return () => controller.abort();
  }, [apiLang]);

  // Apply broadcast-center tickers/settings live (polling + focus + SSE).
  React.useEffect(() => {
    const b = broadcastTickers.broadcast;

    setBreakingFromBackend(broadcastTickers.breakingTexts);
    setLiveFromBackend(broadcastTickers.liveTexts);

    if (b?.meta?.hasSettings) {
      setBroadcastBreakingEnabled(broadcastTickers.breakingEnabled);
      setBroadcastLiveEnabled(broadcastTickers.liveEnabled);
      setBroadcastBreakingSpeedSec(broadcastTickers.breakingSpeedSec);
      setBroadcastLiveSpeedSec(broadcastTickers.liveSpeedSec);
    } else {
      // If backend doesn't provide broadcast settings, fall back to published public settings.
      setBroadcastBreakingEnabled(null);
      setBroadcastLiveEnabled(null);
      setBroadcastBreakingSpeedSec(null);
      setBroadcastLiveSpeedSec(null);
    }
  }, [
    broadcastTickers.broadcast,
    broadcastTickers.breakingTexts,
    broadcastTickers.liveTexts,
    broadcastTickers.breakingEnabled,
    broadcastTickers.liveEnabled,
    broadcastTickers.breakingSpeedSec,
    broadcastTickers.liveSpeedSec,
  ]);


  // Apply backend-controlled defaults (do not persist). Keep this one-shot.
  const appliedPublishedDefaultsRef = useRef(false);
  React.useEffect(() => {
    if (enablePublicSettingsDrawer) return;
    if (appliedPublishedDefaultsRef.current) return;
    if (!effectiveSettings || settingsError) return;

    const themePreset = (effectiveSettings as any)?.languageTheme?.themePreset;

    if (typeof themePreset === 'string') {
      const next = themePreset.toLowerCase().trim();
      if (next === 'default') {
        setPrefs((p: any) => ({ ...p, themeId: DEFAULT_PREFS.themeId }));
      } else if (next === 'system') {
        const prefersDark = typeof window !== 'undefined' && window.matchMedia
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
          : false;
        setPrefs((p: any) => ({ ...p, themeId: prefersDark ? 'midnight' : 'aurora' }));
      } else if (next === 'aurora' || next === 'light' || next === 'ocean' || next === 'sunset') {
        setPrefs((p: any) => ({ ...p, themeId: 'aurora' }));
      } else if (next === 'midnight' || next === 'night' || next === 'dark') {
        setPrefs((p: any) => ({ ...p, themeId: 'midnight' }));
      }
    }

    appliedPublishedDefaultsRef.current = true;
  }, [enablePublicSettingsDrawer, effectiveSettings, settingsError]);

  const publishedLanguageOptions = useMemo(() => {
    const raw = (effectiveSettings as any)?.languageTheme?.languages;
    const normalize = (v: any): UiLangCode | null => {
      const s = String(v || '').toLowerCase().trim();
      if (s === 'en' || s === 'hi' || s === 'gu') return s as UiLangCode;
      return null;
    };

    if (Array.isArray(raw) && raw.length) {
      const codes = raw.map(normalize).filter(Boolean) as UiLangCode[];
      const uniq = Array.from(new Set(codes));
      if (uniq.length) {
        return uniq.map((c) => ({ code: c, label: UI_LANG_LABEL[c] }));
      }
    }
    return [
      { code: 'en' as UiLangCode, label: UI_LANG_LABEL.en },
      { code: 'hi' as UiLangCode, label: UI_LANG_LABEL.hi },
      { code: 'gu' as UiLangCode, label: UI_LANG_LABEL.gu },
    ];
  }, [effectiveSettings]);

  const publishedModulesContainer = useMemo(() => {
    return effectiveSettings?.modules ?? null;
  }, [effectiveSettings]);

  const moduleEnabledOrTrue = (key: string) => {
    const v = (publishedModulesContainer as any)?.[key]?.enabled;
    if (v === undefined) return true;
    return v === true;
  };

  const moduleOrderOr = (key: string, fallbackOrder: number) => {
    const raw = Number((publishedModulesContainer as any)?.[key]?.order);
    return Number.isFinite(raw) ? raw : fallbackOrder;
  };

  const showCategoryStrip = effectiveSettings.modules.categoryStrip.enabled === true;
  const showTrendingStrip = effectiveSettings.modules.trending.enabled === true;

  // Module toggles control whether the ticker can render at all.
  const breakingModuleEnabled = moduleEnabledOrTrue('breakingTicker');
  const liveModuleEnabled = moduleEnabledOrTrue('liveUpdatesTicker');

  const breakingTickerEnabled = breakingModuleEnabled && effectiveSettings.tickers.breaking.enabled === true;
  const liveTickerEnabled = liveModuleEnabled && effectiveSettings.tickers.live.enabled === true;

  // Broadcast config controls whether the ticker is active; it must not override module toggles.
  const breakingTickerVisible = breakingTickerEnabled && (broadcastBreakingEnabled ?? true);
  const liveTickerVisible = liveTickerEnabled && (broadcastLiveEnabled ?? true);

  const breakingDurationSec = clampNum(broadcastBreakingSpeedSec ?? effectiveSettings.tickers.breaking.speedSec, 10, 40, 18);
  const liveDurationSec = clampNum(broadcastLiveSpeedSec ?? effectiveSettings.tickers.live.speedSec, 10, 40, 24);

  const breakingItems = breakingFromBackend;
  const showBreakingContent = breakingItems.length > 0;
  const breakingItemsToShow = showBreakingContent ? breakingItems : [t('home.noBreaking')];

  const liveItemsToShow = liveFromBackend.length > 0 ? liveFromBackend : [t('home.noUpdates')];

  const onToast = (m: string) => setToast(m);

  const liveTvEnabled = effectiveSettings.liveTv.enabled === true;
  const liveTvEmbedUrl = effectiveSettings.liveTv.embedUrl;

  const moduleState = {
    categoryStrip: showCategoryStrip,
    trending: showTrendingStrip,
    explore: effectiveSettings.modules.explore.enabled === true,
    liveTvCard: effectiveSettings.modules.liveTvCard.enabled === true && liveTvEnabled,
    quickTools: effectiveSettings.modules.quickTools.enabled === true,
    snapshots: effectiveSettings.modules.snapshots.enabled === true,
    appPromo: effectiveSettings.modules.appPromo.enabled === true,
    footer: effectiveSettings.modules.footer.enabled === true,
  };

  const sidebarBlocks = [
    {
      key: 'explore',
      order: effectiveSettings.modules.explore.order,
      enabled: effectiveSettings.modules.explore.enabled === true,
      node: (
        <ExploreCategoriesPanel
          theme={theme}
          prefs={prefs}
          activeKey={activeCatKey}
          onPick={(k: string) => {
            setActiveCatKey(k);
            onToast(`Category: ${k}`);
          }}
        />
      ),
    },
    {
      key: 'liveTvCard',
      order: effectiveSettings.modules.liveTvCard.order,
      enabled: effectiveSettings.modules.liveTvCard.enabled === true && liveTvEnabled,
      node: (
        <LiveTVWidget
          theme={theme}
          enabled={effectiveSettings.modules.liveTvCard.enabled === true && liveTvEnabled}
          onToast={onToast}
          embedUrlOverride={liveTvEmbedUrl}
        />
      ),
    },
    {
      key: 'quickTools',
      order: effectiveSettings.modules.quickTools.order,
      enabled: effectiveSettings.modules.quickTools.enabled === true,
      node: <QuickToolsCard theme={theme} onToast={onToast} />,
    },
    {
      key: 'snapshots',
      order: effectiveSettings.modules.snapshots.order,
      enabled: effectiveSettings.modules.snapshots.enabled === true,
      node: <SnapshotsCard theme={theme} />,
    },
  ]
    .filter((x) => x.enabled)
    .sort((a, b) => a.order - b.order);

  const tickerBlocks = [
    {
      key: 'breakingTicker',
      order: effectiveSettings.tickers.breaking.order,
      enabled: breakingTickerVisible,
      node: (
        <div className="w-full min-w-0">
          <TickerBar
            key={`breaking-${breakingDurationSec}-${breakingItemsToShow.length}`}
            theme={theme}
            kind="breaking"
            items={breakingItemsToShow}
            durationSec={breakingDurationSec}
            onViewAll={() => {
              setViewAllKind("breaking");
              setViewAllOpen(true);
            }}
          />
        </div>
      ),
    },
    {
      key: 'liveUpdatesTicker',
      order: effectiveSettings.tickers.live.order,
      enabled: liveTickerVisible,
      node: (
        <div className="w-full min-w-0">
          <TickerBar
            key={`live-${liveDurationSec}-${liveItemsToShow.length}`}
            theme={theme}
            kind="live"
            items={liveItemsToShow}
            durationSec={liveDurationSec}
            onViewAll={() => {
              setViewAllKind("live");
              setViewAllOpen(true);
            }}
          />
        </div>
      ),
    },
  ]
    .filter((x) => x.enabled)
    .sort((a, b) => {
      // UX requirement: Breaking (red) should always appear above Live Updates (blue).
      if (a.key === b.key) return 0;
      if (a.key === 'breakingTicker') return -1;
      if (b.key === 'breakingTicker') return 1;
      return a.order - b.order;
    });

  const showAnyTicker = tickerBlocks.length > 0;

  const bottomBlocks = [
    {
      key: 'appPromo',
      order: effectiveSettings.modules.appPromo.order,
      enabled: effectiveSettings.modules.appPromo.enabled === true,
      node: <AppPromoSection theme={theme} onToast={onToast} />,
    },
    {
      key: 'footer',
      order: effectiveSettings.modules.footer.order,
      enabled: effectiveSettings.modules.footer.enabled === true,
      node: <SiteFooter theme={theme} onToast={onToast} footerTextOverride={undefined} />,
    },
  ]
    .filter((x) => x.enabled)
    .sort((a, b) => a.order - b.order);

  const tickerWrapperOrder = tickerBlocks.length
    ? Math.min(...tickerBlocks.map((b) => b.order).filter((n) => Number.isFinite(n)))
    : Number.POSITIVE_INFINITY;

  const topOrderedBlocks = [
    {
      key: 'categoryStrip',
      order: effectiveSettings.modules.categoryStrip.order,
      enabled: showCategoryStrip,
      node: (
        <div className="sticky top-0 z-40 mt-4">
          <TopCategoriesStrip
            theme={theme}
            activeKey={activeCatKey}
            onPick={(k: string) => {
              setActiveCatKey(k);
              onToast(`Category: ${k}`);
            }}
          />
        </div>
      ),
    },
    {
      key: 'tickers',
      order: tickerWrapperOrder,
      enabled: showAnyTicker,
      node: (
        <div className="mt-0 w-full max-w-full">
          <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
            <div className="rounded-2xl border border-black/10 bg-white/80 backdrop-blur-md shadow-sm ring-1 ring-black/5 overflow-hidden p-2 flex flex-col gap-2">
              {tickerBlocks.map((b) => (
                <React.Fragment key={b.key}>{b.node}</React.Fragment>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ]
    .filter((b) => b.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden overflow-hidden bg-gray-50/30" style={{ background: theme.bg }}>
      <style jsx global>{`
        html, body { height: 100%; }
        body { overflow-x: hidden; scrollbar-gutter: stable; }
        .np-no-scrollbar::-webkit-scrollbar { display: none; }
        .np-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes np-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .np-tickerTrack { display: flex; align-items: center; width: max-content; will-change: transform; animation-name: np-marquee; animation-timing-function: linear; animation-iteration-count: infinite; }
        .np-tickerSeq { flex-shrink: 0; display: flex; align-items: center; }
        .np-marqueeWrap:hover .np-tickerTrack { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .np-tickerTrack { animation: none !important; transform: none !important; }
        }
      `}</style>

      {/* TOP HEADER */}
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 pt-4">
        <Surface theme={theme} className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <IconButton theme={theme} onClick={() => setMobileLeftOpen(true)} label={t('common.menu')}>
                <Menu className="h-5 w-5" />
              </IconButton>

              <div className="min-w-0">
                <div className="text-base font-black tracking-tight" style={{ color: theme.text }}>
                  News <span style={{ color: theme.accent }}>Pulse</span>
                </div>
                <div className="text-xs font-semibold" style={{ color: theme.sub }}>
                  {t('brand.tagline')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <LanguagePicker
                theme={theme}
                value={toUiLangCode(lang)}
                options={publishedLanguageOptions}
                onChange={(nextCode: UiLangCode) => {
                  const next = String(nextCode).toLowerCase();
                  if (next === 'en' || next === 'hi' || next === 'gu') {
                    // Persist preference, but route locale remains the single source of truth.
                    setLang(next as any, { persist: true });
                    const unprefixed = getUnprefixedPath(String(router.asPath || '/'));
                    const nextAs = next === 'en' ? unprefixed : `/${next}${unprefixed === '/' ? '' : unprefixed}`;
                    router
                      .push({ pathname: router.pathname, query: router.query }, nextAs, {
                        locale: next,
                        shallow: false,
                        scroll: false,
                      })
                      .catch(() => {});
                  }
                  setPrefs((p: any) => ({ ...p, lang: UI_LANG_LABEL[nextCode] }));
                }}
              />
              <ThemePicker theme={theme} themeId={prefs.themeId} setThemeId={(id: string) => setPrefs((p: any) => ({ ...p, themeId: id }))} />

              {enablePublicSettingsDrawer ? (
                <IconButton theme={theme} onClick={() => setSettingsOpen(true)} label={t('common.settings')}>
                  <Settings className="h-5 w-5" />
                </IconButton>
              ) : null}
            </div>
          </div>

        </Surface>
      </div>

      {/* ORDERED TOP MODULES (admin-published source of truth) */}
      {topOrderedBlocks.map((b) => (
        <React.Fragment key={b.key}>{b.node}</React.Fragment>
      ))}

      <AdSlot
        slot="HOME_728x90"
        className="mx-auto w-full max-w-[1440px] px-4 md:px-8 my-2"
      />

      {/* TRENDING (below top advertisement) */}
      {showTrendingStrip ? (
        <TrendingStrip theme={theme} onPick={(t: string) => onToast(`Trending: ${t}`)} />
      ) : null}

      {/* MAIN GRID */}
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 pb-10 pt-4">
        <div className="grid grid-cols-12 gap-6 lg:gap-8">
          {/* LEFT (Navigation) */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="sticky top-4 grid gap-4">
              {sidebarBlocks.map((b) => (
                <React.Fragment key={b.key}>{b.node}</React.Fragment>
              ))}
            </div>
          </aside>

          {/* MIDDLE (News Content) */}
          <main className="col-span-12 lg:col-span-6">
            <div className="grid gap-4">
              <FeaturedCard theme={theme} item={FEATURED[0]} onToast={onToast} />
            </div>
          </main>

          {/* RIGHT (Advertisements) */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="sticky top-4 grid gap-4">
              <AdSlot slot="HOME_RIGHT_300x250" />

              <FeedList theme={theme} title={t('home.latest')} items={latestFromBackend} onOpen={(id: string) => onToast(id === "viewall" ? "View all latest (planned)" : `Open story: ${id}`)} />

              {/* Regional preview */}
              <div className="rounded-2xl border overflow-hidden" style={{ background: theme.surface2, borderColor: theme.border }}>
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: theme.border }}>
                  <div className="text-sm font-extrabold" style={{ color: theme.text }}>{t('home.regionalPreview')}</div>
                  <a href="/regional" className="text-xs font-semibold" style={{ color: theme.accent }}>{t('common.viewAll')} →</a>
                </div>
                <div className="p-3 grid gap-2">
                  {(regional.news.slice(0, 3)).map((a: any, idx: number) => (
                    <button
                      key={String(a.id || idx)}
                      type="button"
                      onClick={() => onToast("Open regional story (planned)")}
                      className="rounded-xl border px-3 py-2 text-sm hover:opacity-95 text-left w-full"
                      style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}
                    >
                      {a.title}
                    </button>
                  ))}
                  {regional.loading && !regional.news.length ? (
                    <div className="rounded-xl border px-3 py-7 animate-pulse" style={{ background: theme.surface, borderColor: theme.border }} />
                  ) : null}
                </div>
              </div>

              {/* Youth Pulse trending */}
              <div className="rounded-2xl border overflow-hidden" style={{ background: theme.surface2, borderColor: theme.border }}>
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: theme.border }}>
                  <div className="text-sm font-extrabold" style={{ color: theme.text }}>{t('home.youthPulseTrending')}</div>
                  <a href="/youth-pulse" className="text-xs font-semibold" style={{ color: theme.accent2 }}>{t('common.viewAll')} →</a>
                </div>
                <div className="p-3 grid gap-2">
                  {(youth.trending.slice(0, 6)).map((y: any) => (
                    <a key={String(y.id)} href={`/youth-pulse`} className="rounded-xl border px-3 py-2 text-sm hover:opacity-95" style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}>
                      {y.title}
                    </a>
                  ))}
                  {youth.loading && !youth.trending.length ? (
                    <div className="rounded-xl border px-3 py-7 animate-pulse" style={{ background: theme.surface, borderColor: theme.border }} />
                  ) : null}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* APP PROMO + FOOTER */}
      {bottomBlocks.map((b) => (
        <React.Fragment key={b.key}>{b.node}</React.Fragment>
      ))}

      {/* DRAWERS */}
      {enablePublicSettingsDrawer ? (
        <PreferencesDrawer theme={theme} open={settingsOpen} onClose={() => setSettingsOpen(false)} moduleState={moduleState} onToast={onToast} />
      ) : null}

      <Drawer open={mobileLeftOpen} onClose={() => setMobileLeftOpen(false)} theme={theme} title={t('common.menu')} side="left">
        <div className="grid gap-3">
          <Link
            href="/"
            onClick={() => setMobileLeftOpen(false)}
            className={cx(
              "w-full justify-start inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border transition-all duration-200 focus-visible:outline-none",
              MENU_QUICK_THEME.home.base,
              MENU_QUICK_THEME.home.hover,
              MENU_QUICK_THEME.home.ring
            )}
          >
            <Home className="h-4 w-4" /> {t('common.home')}
          </Link>
          <Link
            href="/viral-videos"
            onClick={() => setMobileLeftOpen(false)}
            className={cx(
              "w-full justify-start inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border transition-all duration-200 focus-visible:outline-none",
              MENU_QUICK_THEME.videos.base,
              MENU_QUICK_THEME.videos.hover,
              MENU_QUICK_THEME.videos.ring
            )}
          >
            <Video className="h-4 w-4" /> {t('common.videos')}
          </Link>
          <Link
            href="/search"
            onClick={() => setMobileLeftOpen(false)}
            className={cx(
              "w-full justify-start inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border transition-all duration-200 focus-visible:outline-none",
              MENU_QUICK_THEME.search.base,
              MENU_QUICK_THEME.search.hover,
              MENU_QUICK_THEME.search.ring
            )}
          >
            <Search className="h-4 w-4" /> {t('common.search')}
          </Link>

          <div className="h-px" style={{ background: theme.border }} />

          <div className="text-xs font-extrabold" style={{ color: theme.sub }}>
            {t('common.categories')}
          </div>

          <div className="grid gap-1">
            {getCats().map((c: any) => {
              const tone = CATEGORY_THEME[c.key] || CATEGORY_THEME.__default;
              const active = activeCatKey === c.key;
              const href = CATEGORY_ROUTES[c.key as string];
              const label = t(labelKeyForCategory(String(c.key)));

              const content = (
                <div
                  className={cx(
                    "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold border transition-all duration-200 focus-visible:outline-none",
                    tone.base,
                    tone.hover,
                    tone.ring,
                    active && tone.active
                  )}
                >
                  <span className={cx("inline-flex h-9 w-9 items-center justify-center rounded-2xl border", tone.icon)}>
                    <c.Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{label}</span>
                </div>
              );

              if (href) {
                return (
                  <Link
                    key={c.key}
                    href={href}
                    onClick={() => {
                      setActiveCatKey(c.key);
                      setMobileLeftOpen(false);
                    }}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setActiveCatKey(c.key);
                    setMobileLeftOpen(false);
                    onToast(`Category: ${label}`);
                  }}
                  className="text-left"
                  style={{ background: "transparent", border: "none", padding: 0, margin: 0 }}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      </Drawer>

      <Drawer
        open={viewAllOpen}
        onClose={() => setViewAllOpen(false)}
        theme={theme}
        title={viewAllKind === 'live' ? t('tickers.liveUpdates') : t('tickers.breakingNews')}
      >
        <div className="grid gap-2">
          {(viewAllKind === 'live'
            ? liveItemsToShow
            : breakingItemsToShow
          ).map(
            (x: string, idx: number) => (
              <div key={idx} className="rounded-2xl border px-3 py-3 text-sm" style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}>
                {x}
              </div>
            )
          )}
        </div>
      </Drawer>

      <Toast theme={theme} message={toast} onDone={() => setToast("")} />
    </div>
  );
}
