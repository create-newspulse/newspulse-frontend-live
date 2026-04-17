import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useYouthPulse } from "../features/youthPulse/useYouthPulse";
import { usePublicMode } from "../utils/PublicModeProvider";
import { usePublicSettings } from "../src/context/PublicSettingsContext";
import { DEFAULT_TRENDING_TOPICS, type TrendingTopic } from "../src/config/trendingTopics";
import { getTrendingTopics } from "../lib/getTrendingTopics";
import { fetchPublicNews, type Article } from "../lib/publicNewsApi";
import { toTickerTexts } from "../lib/publicBroadcast";
import { usePublicBroadcastTicker } from "../hooks/usePublicBroadcastTicker";
import { usePublicAdSlot } from "../hooks/usePublicAdSlot";
import { usePublicTickerAds } from "../hooks/usePublicTickerAds";
import { isSafeMode } from "../utils/safeMode";
import { resolveArticleSummaryOrExcerpt, resolveArticleTitle } from "../lib/contentFallback";
import OriginalTag from "../components/OriginalTag";
import { DEFAULT_NORMALIZED_PUBLIC_SETTINGS, sanitizeEmbedUrl } from "../src/lib/publicSettings";
import AdSlot from "../src/components/ads/AdSlot";
import { useBookmarks } from "../hooks/useBookmarks";
import { resolveArticleSlug } from "../lib/articleSlugs";
import { buildNewsUrl } from "../lib/newsRoutes";
import { resolveSponsoredContentMeta } from "../lib/sponsoredContent";
import { COVER_PLACEHOLDER_SRC, resolveCoverFitMode, resolveCoverImageUrl } from "../lib/coverImages";
import { fetchCurrentWeather } from "../lib/fetchWeather";
import { debugStoryCard, getStoryId, getStoryReactKey, getStorySlug, getStoryTranslationGroupId } from "../lib/storyIdentity";
import { formatEditorialDateTime, getStoryDateTimeValue, resolveStoryDateIso } from "../lib/storyDateTime";
import StoryImage, { TopStoryImage } from "../src/components/story/StoryImage";
import { getTickerMarqueeText, mergeTickerItemsWithAds, type TickerMarqueeItem } from "../lib/publicTickerAds";
import InspirationHubHomepageSection from "../components/home/InspirationHubHomepageSection";
import type { GetStaticProps } from "next";
import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "../src/i18n/LanguageProvider";
import { resolveInspirationHubDroneTvEmbedUrl } from "../src/lib/inspirationHubSettings";
import { usePublicFounderToggles } from "../hooks/usePublicFounderToggles";
import { DEFAULT_PUBLIC_FOUNDER_TOGGLES, type PublicFounderToggles } from "../lib/publicFounderToggles";
import {
  ArrowRight,
  Bell,
  Bookmark,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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

const STYLE_STORAGE_KEY = 'np_style';

function readSavedStyleId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STYLE_STORAGE_KEY);
    const v = String(raw || '').trim().toLowerCase();
    return v ? v : null;
  } catch {
    return null;
  }
}

function writeSavedStyleId(themeId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STYLE_STORAGE_KEY, String(themeId || ''));
  } catch {}
}

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
  regional: "/regional/gujarat",
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

const HOME_EDITORIAL_SECTIONS = [
  { key: 'national', route: '/national', Icon: Flag },
  { key: 'regional', route: '/regional/gujarat', Icon: MapPin },
  { key: 'international', route: '/international', Icon: Globe },
  { key: 'business', route: '/business', Icon: Briefcase },
  { key: 'science-technology', route: '/science-technology', Icon: Cpu },
  { key: 'sports', route: '/sports', Icon: Trophy },
  { key: 'lifestyle', route: '/lifestyle', Icon: Leaf },
  { key: 'glamour', route: '/glamour', Icon: Sparkles },
  { key: 'web-stories', route: '/web-stories', Icon: BookOpen },
] as const;

const HOME_SPOTLIGHT_PRIMARY_SECTION_KEYS = ['regional', 'national', 'international', 'science-technology', 'sports', 'business', 'youth'] as const;
const HOME_SPOTLIGHT_FALLBACK_SECTION_KEYS = ['glamour'] as const;
const HOME_SPOTLIGHT_RENDER_FILTER_KEYS = ['regional', 'national', 'international', 'business', 'science-technology', 'sports', 'lifestyle', 'glamour'] as const;
const HOME_SPOTLIGHT_MAX_ITEMS = 8;
const HOME_SPOTLIGHT_MAX_PER_CATEGORY = 2;
const HOME_SPOTLIGHT_MAX_GLAMOUR_ITEMS = 1;
const HOME_SPOTLIGHT_SOURCE_LIMIT = 18;
const HOME_SPOTLIGHT_ROTATE_MS = 5000;
const HOME_SPOTLIGHT_FRESH_HOURS = 72;

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

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateSmart(text: string, maxChars: number): string {
  const s = String(text || '').trim();
  if (!s) return '';
  if (s.length <= maxChars) return s;
  const slice = s.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > Math.floor(maxChars * 0.6) ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/\s+$/g, '')}…`;
}

function storyPublishedTimeValue(article: any): number {
  return getStoryDateTimeValue(article);
}

function storyAgeHours(article: any, referenceTime: number): number {
  const publishedTime = storyPublishedTimeValue(article);
  if (!publishedTime || !Number.isFinite(referenceTime)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (referenceTime - publishedTime) / (1000 * 60 * 60));
}

function makeDekFromContent(text: string): string {
  const s = String(text || '').trim();
  if (!s) return '';
  if (s.length <= 140) return s;

  const max = 140;
  const min = 120;
  const slice = s.slice(0, max);

  // Prefer a word boundary, but never cut below `min` when possible.
  for (let i = slice.length - 1; i >= min; i--) {
    if (slice[i] === ' ') {
      return `${slice.slice(0, i).trim()}…`;
    }
  }

  return `${slice.trim()}…`;
}

function estimateReadMinutes(text: string): number {
  const s = String(text || '').trim();
  if (!s) return 1;
  const words = s.split(/\s+/g).filter(Boolean).length;
  // Typical reading speeds range ~180-240 wpm; keep it stable and simple.
  return Math.max(1, Math.ceil(words / 220));
}

function storyLocationLabel(story: any): string {
  const loc = story?.location;
  if (typeof loc === 'string') return loc.trim();
  const parts = [
    safeTitle(loc?.city),
    safeTitle(loc?.district),
    safeTitle(loc?.state),
    safeTitle(loc?.region),
  ].filter(Boolean);
  return parts.join(', ');
}

function pickTranslatedField(item: any, lang: 'en' | 'hi' | 'gu', field: string): string {
  const direct = pickTranslatedValue(item, lang, field);
  return safeTitle(direct);
}

function pickTranslatedValue(item: any, lang: 'en' | 'hi' | 'gu', field: string): unknown {
  const direct = item?.translations?.[lang]?.[field];
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  const alt1 = item?.i18n?.[lang]?.[field];
  if (alt1 !== undefined && alt1 !== null && alt1 !== '') return alt1;
  const alt2 = item?.localized?.[lang]?.[field];
  if (alt2 !== undefined && alt2 !== null && alt2 !== '') return alt2;
  const alt3 = item?.locales?.[lang]?.[field];
  if (alt3 !== undefined && alt3 !== null && alt3 !== '') return alt3;
  return undefined;
}

function resolveTopStoryTitle(article: any, requestedLang: 'en' | 'hi' | 'gu') {
  if (requestedLang !== 'en') {
    const translated = pickTranslatedField(article, requestedLang, 'title');
    if (translated) return { text: translated, isOriginal: false };
  }
  return resolveArticleTitle(article, requestedLang);
}

function resolveTopStorySummary(article: any, requestedLang: 'en' | 'hi' | 'gu') {
  if (requestedLang !== 'en') {
    const translated = pickTranslatedField(article, requestedLang, 'summary');
    if (translated) return { text: translated, isOriginal: false };
  }

  // Top Story rule: use summary if present; otherwise generate a dek.
  const summary = safeTitle(article?.summary);
  if (summary) return { text: summary, isOriginal: false };
  return { text: '', isOriginal: false };
}

function resolveStoryImageSrc(article: any, requestedLang: 'en' | 'hi' | 'gu') {
  return resolveCoverImageUrl(article as any, { lang: requestedLang }) || '';
}

function articleToTickerText(a: Article, requestedLang: 'en' | 'hi' | 'gu'): string | null {
  const { text } = resolveArticleTitle(a as any, requestedLang);
  const title = safeTitle(text || (a as any)?.title);
  return title ? title : null;
}

function articleToFeedItem(a: Article, requestedLang: 'en' | 'hi' | 'gu') {
  const storyId = getStoryId(a as any) || undefined;
  const slug = resolveArticleSlug(a as any, requestedLang) || safeTitle((a as any)?.slug) || undefined;
  const titleRes = resolveArticleTitle(a as any, requestedLang);
  const descRes = resolveArticleSummaryOrExcerpt(a as any, requestedLang);

  const title = safeTitle(titleRes.text || (a as any)?.title) || 'Untitled';
  const desc = safeTitle(descRes.text || (a as any)?.summary || (a as any)?.excerpt) || '';

  const iso = resolveStoryDateIso(a as any);
  const time = formatEditorialDateTime(iso);

  const source = safeTitle((a as any)?.source?.name || (a as any)?.source) || 'News Pulse';
  const category = safeTitle((a as any)?.category) || '';
  const imageSrc = resolveStoryImageSrc(a as any, requestedLang);
  const coverFitMode = resolveCoverFitMode(a as any, { src: imageSrc, altText: title });

  return {
    _id: storyId,
    id: storyId || slug || title,
    lang: String((a as any)?.lang || (a as any)?.language || (a as any)?.sourceLang || (a as any)?.sourceLanguage || '').trim(),
    slug,
    translationGroupId: getStoryTranslationGroupId(a as any) || undefined,
    title,
    desc,
    titleIsOriginal: titleRes.isOriginal,
    descIsOriginal: descRes.isOriginal,
    time: time || '—',
    iso,
    source,
    category,
    imageSrc,
    coverFitMode,
  };
}

type HomepageFeatureSelection = {
  article: Article | null;
  label: string;
  dotColor?: string;
};

function normalizeFeatureText(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[_/|]+/g, ' ')
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toFeatureStringList(value: unknown): string[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry) => toFeatureStringList(entry));
  }

  if (typeof value === 'object') {
    const candidate =
      (value as any)?.label ??
      (value as any)?.name ??
      (value as any)?.title ??
      (value as any)?.value ??
      (value as any)?.key ??
      '';
    return candidate ? [String(candidate)] : [];
  }

  if (typeof value === 'string') {
    return value
      .split(/[;,]+/g)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  return [String(value)];
}

function readFeatureValue(article: any, keys: string[]): unknown {
  if (!article || typeof article !== 'object') return undefined;

  const containers = [
    article,
    article.meta,
    article.metadata,
    article.attributes,
    article.flags,
    article.settings,
  ].filter((value) => value && typeof value === 'object');

  for (const container of containers) {
    for (const key of keys) {
      const value = (container as any)?.[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }

  return undefined;
}

function hasTruthyFeatureFlag(article: any, keys: string[]): boolean {
  const value = readFeatureValue(article, keys);
  if (typeof value === 'boolean') return value;

  const normalized = normalizeFeatureText(value);
  return ['1', 'true', 'yes', 'active', 'enabled', 'on'].includes(normalized);
}

function isExplicitlyInactiveFeature(article: any): boolean {
  const directFlags = [
    readFeatureValue(article, ['active', 'isActive', 'enabled']),
    readFeatureValue(article, ['sponsoredActive', 'sponsoredFeatureActive', 'featureActive']),
  ];

  for (const flag of directFlags) {
    if (flag === false) return true;
    const normalized = normalizeFeatureText(flag);
    if (['0', 'false', 'no', 'inactive', 'disabled', 'off', 'expired'].includes(normalized)) return true;
  }

  const statusValues = [
    readFeatureValue(article, ['status', 'featureStatus', 'publicationStatus']),
    readFeatureValue(article, ['sponsoredStatus', 'sponsoredFeatureStatus']),
  ];

  return statusValues.some((value) => {
    const normalized = normalizeFeatureText(value);
    return ['inactive', 'disabled', 'draft', 'archived', 'expired'].includes(normalized);
  });
}

function collectArticleFeatureTokens(article: any): string[] {
  if (!article || typeof article !== 'object') return [];

  const rawValues = [
    readFeatureValue(article, ['tags', 'tag', 'keywords', 'labels', 'label', 'badges', 'badge', 'categories']),
    readFeatureValue(article, ['featureType', 'featureLabel', 'placement', 'slot']),
    readFeatureValue(article, ['type', 'storyType', 'articleType', 'contentType', 'format']),
    readFeatureValue(article, ['topic', 'topics']),
    readFeatureValue(article, ['category', 'categoryLabel', 'categoryName']),
  ];

  const normalized = rawValues
    .flatMap((value) => toFeatureStringList(value))
    .map((value) => normalizeFeatureText(value))
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function tokenMatchesAny(tokens: string[], patterns: RegExp[]): boolean {
  return patterns.some((pattern) => tokens.some((token) => pattern.test(token)));
}

function scoreHomepageFeatureQuality(article: Article, requestedLang: 'en' | 'hi' | 'gu'): number {
  const feedItem = articleToFeedItem(article, requestedLang);
  const descriptionLength = String(feedItem?.desc || '').trim().length;
  const titleLength = String(feedItem?.title || '').trim().length;
  const hasLocation = Boolean(storyLocationLabel(article as any));

  return (
    (String(feedItem?.imageSrc || '').trim() ? 3 : 0) +
    (descriptionLength >= 120 ? 2 : descriptionLength >= 48 ? 1 : 0) +
    (hasLocation ? 1 : 0) +
    (titleLength >= 40 ? 1 : 0)
  );
}

function resolveHomepageFeatureSelection(options: {
  latestRawStories: Article[] | null;
  homeSectionNews: Record<string, Article[]>;
  requestedLang: 'en' | 'hi' | 'gu';
  fallbackArticle?: Article | null;
}): HomepageFeatureSelection {
  const { latestRawStories, homeSectionNews, requestedLang, fallbackArticle = null } = options;

  const rawStories = [
    ...(Array.isArray(latestRawStories) ? latestRawStories : []),
    ...HOME_EDITORIAL_SECTIONS.flatMap((section) => (Array.isArray(homeSectionNews[section.key]) ? homeSectionNews[section.key] : [])),
  ];

  const seen = new Set<string>();
  const candidates = rawStories
    .map((article) => {
      const identity = [
        String((article as any)?._id || (article as any)?.id || '').trim().toLowerCase(),
        String(resolveArticleSlug(article as any, requestedLang) || '').trim().toLowerCase(),
        String((article as any)?.slug || '').trim().toLowerCase(),
        String((article as any)?.title || '').trim().toLowerCase(),
      ].find(Boolean);

      if (!identity || seen.has(identity)) return null;
      seen.add(identity);

      const tokens = collectArticleFeatureTokens(article);
      const qualityScore = scoreHomepageFeatureQuality(article, requestedLang);
      const publishedTime = storyPublishedTimeValue(article);
      const categoryKey = normalizeCategoryKey((article as any)?.category);
      const sponsored = resolveSponsoredContentMeta(article, requestedLang);

      const isEditorsPick =
        hasTruthyFeatureFlag(article, ['isEditorsPick', 'editorsPick', 'editorPick', 'isEditorPick']) ||
        tokenMatchesAny(tokens, [
          /\beditors pick\b/,
          /\beditor pick\b/,
          /\beditorial pick\b/,
          /\bdesk pick\b/,
        ]);

      const isTopExplainer =
        hasTruthyFeatureFlag(article, ['isTopExplainer', 'topExplainer', 'isExplainer', 'explainer']) ||
        tokenMatchesAny(tokens, [
          /\btop explainer\b/,
          /\bexplainer\b/,
          /\bdeep dive\b/,
        ]);

      return {
        article,
        identity,
        publishedTime,
        qualityScore,
        categoryKey,
        isSponsoredFeature: sponsored.isFeatureActive,
        isEditorsPick,
        isTopExplainer,
      };
    })
    .filter(Boolean) as Array<{
      article: Article;
      identity: string;
      publishedTime: number;
      qualityScore: number;
      categoryKey: string;
      isSponsoredFeature: boolean;
      isEditorsPick: boolean;
      isTopExplainer: boolean;
    }>;

  const byPriority = (left: { publishedTime: number; qualityScore: number; identity: string }, right: { publishedTime: number; qualityScore: number; identity: string }) => {
    if (left.publishedTime !== right.publishedTime) return right.publishedTime - left.publishedTime;
    if (left.qualityScore !== right.qualityScore) return right.qualityScore - left.qualityScore;
    return left.identity.localeCompare(right.identity);
  };

  const sponsored = candidates.filter((candidate) => candidate.isSponsoredFeature).sort(byPriority)[0];
  if (sponsored) {
    return { article: sponsored.article, label: 'Sponsored Feature', dotColor: '#f59e0b' };
  }

  const editorsPick = candidates.filter((candidate) => candidate.isEditorsPick).sort(byPriority)[0];
  if (editorsPick) {
    return { article: editorsPick.article, label: "Editor's Pick", dotColor: '#8b5cf6' };
  }

  const topExplainer = candidates.filter((candidate) => candidate.isTopExplainer).sort(byPriority)[0];
  if (topExplainer) {
    return { article: topExplainer.article, label: 'Top Explainer', dotColor: '#2563eb' };
  }

  const regionalNationalCandidates = candidates
    .filter((candidate) => candidate.categoryKey === 'regional' || candidate.categoryKey === 'national')
    .sort((left, right) => {
      const leftStrong = left.qualityScore >= 3 ? 1 : 0;
      const rightStrong = right.qualityScore >= 3 ? 1 : 0;
      if (leftStrong !== rightStrong) return rightStrong - leftStrong;
      return byPriority(left, right);
    });

  const regionalNational = regionalNationalCandidates[0];
  if (regionalNational) {
    return {
      article: regionalNational.article,
      label: regionalNational.categoryKey === 'regional' ? 'Regional Spotlight' : 'National Spotlight',
      dotColor: regionalNational.categoryKey === 'regional' ? '#10b981' : '#f59e0b',
    };
  }

  const latestFallback = candidates.sort(byPriority)[0] || (fallbackArticle ? { article: fallbackArticle } : null);
  return {
    article: latestFallback?.article || null,
    label: 'Top Story',
    dotColor: undefined,
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

function normalizeCategoryKey(raw: unknown): string {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  const aliases: Record<string, string> = {
    'science & technology': 'science-technology',
    'science and technology': 'science-technology',
    'science technology': 'science-technology',
    'science-tech': 'science-technology',
    'web stories': 'web-stories',
    'viral videos': 'viral-videos',
    'youth pulse': 'youth',
    'inspiration hub': 'inspiration',
    'community reporter': 'community',
  };
  if (aliases[v]) return aliases[v];

  // Normalize common backend variants.
  const cleaned = v
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleaned;
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

function getVisibleCats(founderToggles: PublicFounderToggles = DEFAULT_PUBLIC_FOUNDER_TOGGLES) {
  if (founderToggles.communityReporterClosed) {
    return CATEGORIES.filter((category) => category.key !== 'community');
  }

  return [...CATEGORIES];
}

function localizePath(path: string, lang: 'en' | 'hi' | 'gu') {
  const safeLang = lang === 'hi' || lang === 'gu' ? lang : 'en';
  const normalized = String(path || '/').startsWith('/') ? String(path || '/') : `/${String(path || '/')}`;
  return safeLang === 'en' ? normalized : `/${safeLang}${normalized === '/' ? '' : normalized}`;
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

function TickerBar({
  theme,
  kind,
  items,
  onViewAll,
  durationSec,
}: {
  theme: any;
  kind: 'breaking' | 'live';
  items: TickerMarqueeItem[];
  onViewAll: () => void;
  durationSec: number;
}) {
  const { t, lang } = useI18n();
  const label = kind === "breaking" ? `🔥 ${t('home.breakingNews')}` : `🔵 ${t('home.liveUpdates')}`;
  const tickerLang = lang === 'gu' ? 'gu' : lang === 'hi' ? 'hi' : 'en';
  const sponsor = useTickerSponsor(kind, tickerLang);

  const defaultDurationSec = kind === 'breaking' ? 18 : 24;

  const clampSeconds = (raw: any, fallback: number) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(300, Math.max(10, n));
  };

  const baseDurationSec = clampSeconds(durationSec, defaultDurationSec);

  const stayTuned = (k: 'breaking' | 'live'): string => {
    if (tickerLang === 'hi') return k === 'breaking' ? 'कोई ब्रेकिंग न्यूज़ नहीं — अपडेट के लिए जुड़े रहें' : 'लाइव अपडेट नहीं — जुड़े रहें';
    if (tickerLang === 'gu') return k === 'breaking' ? 'હાલ કોઈ બ્રેકિંગ નથી — અપડેટ માટે જોડાયેલા રહો' : 'હાલ લાઇવ અપડેટ નથી — જોડાયેલા રહો';
    return k === 'breaking' ? 'No breaking news right now — stay tuned' : 'No live updates right now — stay tuned';
  };

  const normalizeItemText = (it: any): string => {
    if (typeof it === 'string') return it.trim();
    if (it && typeof it === 'object') {
      const v = String((it as any)?.text ?? (it as any)?.title ?? '').trim();
      return v;
    }
    return String(it ?? '').trim();
  };

  const normalized = (Array.isArray(items) ? items : [])
    .map((item: any, index: number) => {
      if (item && typeof item === 'object' && (item.kind === 'news' || item.kind === 'ad')) {
        const text = normalizeItemText(item);
        if (!text) return null;
        return { ...item, id: String(item.id || `${item.kind}-${index}`), text } as TickerMarqueeItem;
      }

      const text = normalizeItemText(item);
      if (!text) return null;
      return { id: `news-${index}`, kind: 'news', text } satisfies TickerMarqueeItem;
    })
    .filter(Boolean) as TickerMarqueeItem[];

  const fallback = kind === 'live' ? (t('home.noUpdates') || stayTuned('live')) : (t('home.noBreaking') || stayTuned('breaking'));
  const safeItems = normalized.length ? normalized : [{ id: `${kind}-fallback`, kind: 'news', text: fallback } satisfies TickerMarqueeItem];

  const marqueeText = getTickerMarqueeText(safeItems);

  // Auto-adjust: duration grows with text length (prevents long tickers from scrolling too fast).
  const targetCharsPerSec = kind === 'breaking' ? 9 : 8;
  const autoDurationSec = Math.ceil(Math.max(1, marqueeText.length) / targetCharsPerSec);
  const effectiveDurationSec = clampSeconds(Math.max(baseDurationSec, autoDurationSec, defaultDurationSec), defaultDurationSec);

  // Force restart of marquee when duration/lang/items change (some browsers won't re-time an in-flight animation).
  const restartKey = (() => {
    const s = `${kind}|${tickerLang}|${effectiveDurationSec}|${marqueeText}`;
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = (h * 33) ^ s.charCodeAt(i);
    return `${kind}-${tickerLang}-${effectiveDurationSec}-${(h >>> 0).toString(16)}`;
  })();

  const renderTickerSequence = (suffix: string) => (
    <div className="np-tickerSeq pr-10 flex items-center whitespace-nowrap text-sm font-medium text-white">
      {safeItems.map((item, index) => {
        const isAd = item.kind === 'ad';
        const content = isAd ? (
          <span className="tickerText" lang={tickerLang}>{`🟡 Ad: ${item.text}`}</span>
        ) : (
          <span className="tickerText" lang={tickerLang}>{item.text}</span>
        );

        return (
          <React.Fragment key={`${item.id}-${suffix}`}>
            {index > 0 ? <span aria-hidden="true" className="mx-4 opacity-60">•</span> : null}
            {isAd ? (
              item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="inline-flex items-center rounded-full border border-white/20 bg-black/15 px-3 py-1 text-amber-50/95 opacity-95 transition hover:bg-black/25 hover:opacity-100"
                >
                  {content}
                </a>
              ) : (
                <span className="inline-flex items-center rounded-full border border-white/20 bg-black/15 px-3 py-1 text-amber-50/95 opacity-95">
                  {content}
                </span>
              )
            ) : (
              content
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

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
                className="relative min-w-0 flex-1 overflow-hidden pr-6"
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
                  style={{ animationDuration: `${effectiveDurationSec}s` }}
                >
                  {renderTickerSequence('a')}
                  {renderTickerSequence('b')}
                </div>
              </div>

              <div className="hidden md:flex items-center gap-3 shrink-0">
                <TickerSponsorMeta kind={kind} sponsor={sponsor} />

                <button type="button" onClick={onViewAll} className="text-xs font-semibold text-white whitespace-nowrap flex-none relative z-10">
                  {t('common.viewAll')}
                </button>
              </div>

              <button type="button" onClick={onViewAll} className="text-xs font-semibold text-white whitespace-nowrap flex-none relative z-10 md:hidden">
                {t('common.viewAll')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type TickerSponsor = {
  brand: string;
  targetUrl: string;
};

function TickerSponsorMeta({ kind, sponsor }: { kind: 'breaking' | 'live'; sponsor: TickerSponsor | null }) {
  void kind;
  if (sponsor) {
    return (
      <a
        href={sponsor.targetUrl}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="hidden md:flex text-[11px] opacity-90 text-white whitespace-nowrap hover:opacity-100"
        title={`Sponsored by ${sponsor.brand}`}
      >
        Sponsored by <span className="font-semibold max-w-[180px] inline-block align-middle truncate">{sponsor.brand}</span>
      </a>
    );
  }

  return null;
}

function resolveSponsorBrand(ad: any): string {
  const normalizeLabel = (value: unknown): string => {
    const text = String(value || '').trim();
    if (!text) return '';
    const upper = text.toUpperCase();
    if (/^(?:[A-Z0-9]+_)+[A-Z0-9]+$/.test(text) && text === upper) return '';
    return text;
  };

  const candidates = [
    ad?.brandName,
    ad?.title,
    ad?.name,
    ad?.advertiserName,
  ];

  for (const candidate of candidates) {
    const value = normalizeLabel(candidate);
    if (value) return value;
  }

  return '';
}

function normalizeSponsorAd(ad: any, enabled: boolean): TickerSponsor | null {
  if (!enabled || !ad || typeof ad !== 'object') return null;
  const brand = resolveSponsorBrand(ad);
  if (!brand) return null;
  const targetUrl = String(ad.targetUrl || ad.clickUrl || ad.url || '').trim();
  if (!targetUrl) return null;
  return { brand, targetUrl };
}

function useTickerSponsor(kind: 'breaking' | 'live', lang: 'en' | 'hi' | 'gu') {
  const slot = kind === 'live' ? 'LIVE_UPDATE_SPONSOR' : 'BREAKING_SPONSOR';
  const { enabled, ad } = usePublicAdSlot({
    slot,
    language: lang,
    allowWithoutImage: true,
  });

  return normalizeSponsorAd(ad, enabled);
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

function TopCategoriesStrip({ theme, activeKey, onPick, founderToggles }: any) {
  const { t } = useI18n();
  const cats = useMemo(() => getVisibleCats(founderToggles), [founderToggles]);

  // IMPORTANT: the ref must be on the *scroll container* (the overflow-x-auto element).
  // If it's attached to the inner inline-flex, mouse drag won't scroll on some desktops.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({
    down: false,
    pointerId: -1,
    startX: 0,
    startLeft: 0,
    moved: false,
    captured: false,
    blockUntil: 0,
  });

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < max - 1);
  }, []);

  React.useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows as any);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows]);

  const labelKeyForCategory = (key: string): string => {
    if (key === 'science-technology') return 'categories.scienceTechnology';
    if (key === 'web-stories') return 'categories.webStories';
    if (key === 'viral-videos') return 'categories.viralVideos';
    if (key === 'youth') return 'categories.youthPulse';
    if (key === 'inspiration') return 'categories.inspirationHub';
    if (key === 'community') return 'categories.communityReporter';
    return `categories.${key}`;
  };

  const categorySubtitleMap: Record<string, { en: string; hi?: string; gu?: string }> = {
    breaking: { en: 'Latest urgent updates' },
    regional: { en: 'Gujarat districts and cities' },
    national: { en: 'India-wide coverage' },
    international: { en: 'Global top stories' },
    business: { en: 'Markets and economy' },
    'science-technology': { en: 'Innovation and tech' },
    sports: { en: 'Matches and results' },
    lifestyle: { en: 'Health, style and living' },
    glamour: { en: 'Bollywood and celebrity buzz' },
    'web-stories': { en: 'Quick visual stories' },
    'viral-videos': { en: 'Trending clips and viral moments' },
    editorial: { en: 'Opinions, analysis and insight' },
    youth: { en: 'Students, careers and youth trends' },
    inspiration: { en: 'Positive stories and motivation' },
    community: { en: 'Public voices and local reports' },
  };

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8">
        <div className="rounded-2xl border border-black/10 shadow-sm ring-1 ring-black/5 bg-white/80 backdrop-blur-md">
          <div className="px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Scroll categories left"
                disabled={!canScrollLeft}
                onClick={() => {
                  const el = scrollerRef.current;
                  if (!el) return;
                  el.scrollBy?.({ left: -250, behavior: 'smooth' });
                }}
                className={cx(
                  'shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border',
                  'bg-white/90 border-black/10 text-slate-700',
                  canScrollLeft ? 'hover:bg-black/[0.02]' : 'opacity-40 cursor-not-allowed'
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div
                ref={scrollerRef}
                className={cx('no-scrollbar w-full overflow-x-auto scroll-smooth', 'cursor-grab active:cursor-grabbing')}
                style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x', overscrollBehaviorX: 'contain' as any }}
                onWheel={(e: any) => {
                  // Convert vertical wheel to horizontal scroll for mouse-only desktops.
                  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    e.preventDefault();
                    const el = e.currentTarget as HTMLDivElement;
                    el.scrollLeft += e.deltaY;
                  }
                }}
                onPointerDown={(e) => {
                  if (e.pointerType === 'touch') return;
                  const el = e.currentTarget as HTMLDivElement;
                  dragState.current.down = true;
                  dragState.current.pointerId = e.pointerId;
                  dragState.current.moved = false;
                  dragState.current.captured = false;
                  dragState.current.startX = e.clientX;
                  dragState.current.startLeft = el.scrollLeft;
                }}
                onPointerMove={(e) => {
                  if (!dragState.current.down) return;
                  const el = e.currentTarget as HTMLDivElement;
                  const dx = e.clientX - dragState.current.startX;
                  if (!dragState.current.moved && Math.abs(dx) > 6) {
                    dragState.current.moved = true;
                    // Only capture once we know it's a drag; capturing on pointerdown
                    // can prevent child Links from receiving click events.
                    if (!dragState.current.captured) {
                      dragState.current.captured = true;
                      try {
                        el.setPointerCapture(dragState.current.pointerId);
                      } catch {}
                      // Avoid text selection while dragging.
                      try {
                        document.body.style.userSelect = 'none';
                      } catch {}
                    }
                  }

                  if (!dragState.current.moved) return;
                  e.preventDefault();
                  el.scrollLeft = dragState.current.startLeft - dx;
                }}
                onPointerUp={(e) => {
                  if (!dragState.current.down) return;
                  dragState.current.down = false;
                  if (dragState.current.moved) dragState.current.blockUntil = Date.now() + 250;
                  const el = e.currentTarget as HTMLDivElement;
                  if (dragState.current.captured) {
                    try {
                      el.releasePointerCapture(dragState.current.pointerId);
                    } catch {}
                  }
                  dragState.current.captured = false;
                  try {
                    document.body.style.userSelect = '';
                  } catch {}
                }}
                onPointerCancel={() => {
                  dragState.current.down = false;
                  dragState.current.captured = false;
                  try {
                    document.body.style.userSelect = '';
                  } catch {}
                }}
              >
                <div className="inline-flex items-center gap-2.5 pr-4 whitespace-nowrap">
              {cats.map((c: any) => {
                const active = c.key === activeKey;
                const chipTheme = CATEGORY_THEME[c.key] || CATEGORY_THEME.__default;
                const href = CATEGORY_ROUTES[c.key as string];
                const content = (
                  <div
                    className={cx(
                      "inline-flex items-center gap-2 whitespace-nowrap h-9 rounded-full border px-3 text-xs font-semibold transition-all duration-200 focus-visible:outline-none",
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

              <button
                type="button"
                aria-label="Scroll categories right"
                disabled={!canScrollRight}
                onClick={() => {
                  const el = scrollerRef.current;
                  if (!el) return;
                  el.scrollBy?.({ left: 250, behavior: 'smooth' });
                }}
                className={cx(
                  'shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full border',
                  'bg-white/90 border-black/10 text-slate-700',
                  canScrollRight ? 'hover:bg-black/[0.02]' : 'opacity-40 cursor-not-allowed'
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExploreCategoriesPanel({ theme, prefs, activeKey, onPick, founderToggles }: any) {
  const { t } = useI18n();
  const cats = useMemo(() => getVisibleCats(founderToggles), [founderToggles]);

  const labelKeyForCategory = (key: string): string => {
    if (key === 'science-technology') return 'categories.scienceTechnology';
    if (key === 'web-stories') return 'categories.webStories';
    if (key === 'viral-videos') return 'categories.viralVideos';
    if (key === 'youth') return 'categories.youthPulse';
    if (key === 'inspiration') return 'categories.inspirationHub';
    if (key === 'community') return 'categories.communityReporter';
    return `categories.${key}`;
  };

  const categorySubtitleMap: Record<string, { en: string; hi?: string; gu?: string }> = {
    breaking: { en: 'Latest urgent updates' },
    regional: { en: 'Gujarat districts and cities' },
    national: { en: 'India-wide coverage' },
    international: { en: 'Global top stories' },
    business: { en: 'Markets and economy' },
    'science-technology': { en: 'Innovation and tech' },
    sports: { en: 'Matches and results' },
    lifestyle: { en: 'Health, style and living' },
    glamour: { en: 'Bollywood and celebrity buzz' },
    'web-stories': { en: 'Quick visual stories' },
    'viral-videos': { en: 'Trending clips and viral moments' },
    viralVideo: { en: 'Trending clips and viral moments' },
    viral_videos: { en: 'Trending clips and viral moments' },
    editorial: { en: 'Opinions, analysis and insight' },
    youth: { en: 'Students, careers and youth trends' },
    'youth-pulse': { en: 'Students, careers and youth trends' },
    youthPulse: { en: 'Students, careers and youth trends' },
    youth_pulse: { en: 'Students, careers and youth trends' },
    inspiration: { en: 'Positive stories and motivation' },
    'inspiration-hub': { en: 'Positive stories and motivation' },
    inspirationHub: { en: 'Positive stories and motivation' },
    inspiration_hub: { en: 'Positive stories and motivation' },
    community: { en: 'Public voices and local reports' },
    'community-reporter': { en: 'Public voices and local reports' },
    communityReporter: { en: 'Public voices and local reports' },
    community_reporter: { en: 'Public voices and local reports' },
  };

  const getCategorySubtitle = (key: string) => {
    const rawKey = String(key || '').trim();
    if (!rawKey) return '';

    const aliasKey = rawKey
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .toLowerCase();

    return (
      categorySubtitleMap[rawKey]?.en ||
      categorySubtitleMap[aliasKey]?.en ||
      ''
    );
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
    <Surface theme={theme} className="overflow-hidden">
      <div
        className="border-b px-4 py-4 sm:px-5"
        style={{
          borderColor: theme.border,
          background: theme.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(167,139,250,0.10) 55%, transparent 100%)'
            : 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(124,58,237,0.08) 55%, rgba(255,255,255,0.72) 100%)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-black tracking-tight" style={{ color: theme.text }}>
              {t('home.exploreCategories')}
            </div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
              {t('home.tapToFilter')}
            </div>
          </div>
          <span
            className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ background: theme.surface, borderColor: theme.border, color: theme.sub }}
          >
            News Desk
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:p-5">
        {cats.map((c: any) => {
          const active = c.key === activeKey;
          const href = CATEGORY_ROUTES[c.key as string];
          const tone = TONE[c.key as string] ?? DEFAULT_TONE;
          const subtitle = getCategorySubtitle(c.key as string);

          const content = (
            <div
              className={cx(
                'group relative flex min-h-[78px] items-start gap-3 rounded-[24px] border px-4 py-3.5 transition duration-200 sm:min-h-[82px]',
                'bg-white/90 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.36)] hover:-translate-y-[1px]',
                active ? 'border-black/20 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.42)]' : 'border-black/10 hover:border-black/15'
              )}
              style={{ background: theme.surface, borderColor: active ? 'rgba(15,23,42,0.18)' : theme.border }}
            >
              <span className={["absolute left-0 top-3 bottom-3 w-1 rounded-full", tone.leftBar].join(" ")} />

              <span
                className={cx(
                  'mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border',
                  tone.iconWrap,
                )}
              >
                <c.Icon className="w-5 h-5" />
              </span>

              <div className="min-w-0 flex-1 self-stretch pr-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <div className={["min-w-0 truncate text-[15px] font-bold leading-tight tracking-tight", tone.text].join(" ")}>{t(labelKeyForCategory(c.key))}</div>
                  {c.badge ? (
                    <span
                      className={[
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em]',
                        'bg-white/70 border-black/10',
                        tone.text,
                      ].join(" ")}
                    >
                      {t('common.new')}
                    </span>
                  ) : null}
                </div>
                {subtitle ? (
                  <div className="mt-1 text-[12px] font-medium leading-[1.35]" style={{ color: theme.sub }}>
                    {subtitle}
                  </div>
                ) : null}
              </div>

              <ArrowRight className={["ml-auto mt-0.5 h-5 w-5 shrink-0 self-center", tone.arrow].join(" ")} />
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

function FeaturedCard({ theme, item, onToast, isLoading = false }: any) {
  const { t } = useI18n();
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const router = useRouter();

  const requestedLang = (item?.requestedLang || 'en') as 'en' | 'hi' | 'gu';
  const article = item?.article as Article | null | undefined;
  const sponsored = useMemo(() => resolveSponsoredContentMeta(article, requestedLang), [article, requestedLang]);

  const vm = useMemo(() => {
    if (!article) {
      const href = localizePath('/latest', requestedLang);
      return {
        id: `homepage-safe-fallback-${requestedLang}`,
        href,
        title: 'News Pulse Front Page',
        summary: 'Stay with the homepage desk for the latest curated stories, explainers, and regional updates as the next lead feature arrives.',
        titleIsOriginal: false,
        summaryIsOriginal: false,
        time: 'Live now',
        iso: '',
        source: 'News Pulse',
        category: 'Homepage',
        location: '',
        readMinutes: 1,
        imageSrc: '',
        coverFitMode: 'cover',
      };
    }

    const id = safeTitle((article as any)?._id || (article as any)?.id || (article as any)?.slug) || '';
    const slug = resolveArticleSlug(article as any, requestedLang);
    const href = buildNewsUrl({ id: id || slug, slug, lang: requestedLang });

    const titleRes = resolveTopStoryTitle(article as any, requestedLang);
    const summaryRes = resolveTopStorySummary(article as any, requestedLang);

    const title = safeTitle(titleRes.text) || t('common.untitled');
    const summaryFromApi = safeTitle(summaryRes.text);

    const contentFallback = cleanText(
      pickTranslatedField(article as any, requestedLang, 'content') ||
        pickTranslatedField(article as any, requestedLang, 'body') ||
        pickTranslatedField(article as any, requestedLang, 'html') ||
        (article as any)?.content ||
        (article as any)?.body ||
        (article as any)?.html ||
        (article as any)?.summary ||
        (article as any)?.excerpt
    );

    const summaryGenerated = makeDekFromContent(contentFallback);
    const excerptFallback = safeTitle(
      pickTranslatedField(article as any, requestedLang, 'excerpt') || (article as any)?.excerpt
    );
    const summary = summaryFromApi || summaryGenerated || excerptFallback;

    const iso = resolveStoryDateIso(article as any);
    const time = formatEditorialDateTime(iso);

    const source = safeTitle((article as any)?.source?.name || (article as any)?.source) || 'News Pulse';
    const categoryRaw = safeTitle((article as any)?.category) || '';
    const categoryKey = normalizeCategoryKey(categoryRaw);
    const categoryLabelKey = categoryKey ? labelKeyForCategory(categoryKey) : '';
    const categoryLabel = categoryLabelKey ? t(categoryLabelKey) : '';
    const category = categoryLabelKey && categoryLabel === categoryLabelKey ? categoryRaw : (categoryLabel || categoryRaw);

    const location = storyLocationLabel(article as any);
    const readMinutes = estimateReadMinutes(`${title} ${summary} ${contentFallback}`);

    const imageSrc = resolveStoryImageSrc(article as any, requestedLang);
    const coverFitMode = resolveCoverFitMode(article as any, { src: imageSrc, altText: title, lang: requestedLang });
    const destinationHref = sponsored.isFeatureActive && sponsored.destinationHref ? sponsored.destinationHref : href;
    const ctaLabel = sponsored.isFeatureActive ? sponsored.ctaLabel : '';

    return {
      id: id || slug || title,
      href,
      destinationHref,
      destinationIsExternal: sponsored.destinationIsExternal,
      ctaLabel,
      sponsorName: sponsored.sponsorName,
      sponsorDisclosure: sponsored.sponsorDisclosure,
      title,
      summary,
      titleIsOriginal: Boolean(titleRes.isOriginal),
      summaryIsOriginal: Boolean(summaryFromApi ? summaryRes.isOriginal : false),
      time: time || '—',
      iso: iso || '',
      source,
      category,
      location,
      readMinutes,
      imageSrc,
      coverFitMode,
    };
  }, [article, requestedLang, sponsored.ctaLabel, sponsored.destinationHref, sponsored.destinationIsExternal, sponsored.isFeatureActive, sponsored.sponsorDisclosure, sponsored.sponsorName, t]);

  const bookmarked = vm ? isBookmarked(vm.id) : false;

  const onToggleSave = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!vm) return;

      toggleBookmark({
        id: vm.id,
        title: vm.title,
        excerpt: vm.summary,
        image: vm.imageSrc || '',
        source: vm.source,
        category: vm.category || '',
        publishedAt: vm.iso || '',
        url: vm.href,
      });
    },
    [toggleBookmark, vm]
  );

  const lineClamp2: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const lineClamp3: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const lineClamp4: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    paddingTop: '0.08em',
    paddingBottom: '0.03em',
  };

  const Chip = ({ children }: { children: React.ReactNode }) => (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border"
      style={{ background: theme.chip, borderColor: theme.border, color: theme.sub }}
    >
      {children}
    </span>
  );

  void Chip;

  const topStoryLabel = safeTitle(item?.featureLabel) || t('home.topStory');
  const topStoryDotColor = safeTitle(item?.featureDotColor) || theme.live;
  const isSponsoredFeatureCard = Boolean(sponsored.isFeatureActive);
  const primaryHref = vm?.destinationHref || vm?.href || '';

  const openArticle = React.useCallback(() => {
    if (!primaryHref) return;
    if (vm?.destinationIsExternal) {
      if (typeof window !== 'undefined') {
        window.open(primaryHref, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    void router.push(primaryHref);
  }, [primaryHref, router, vm?.destinationIsExternal]);

  if (article && vm?.imageSrc) {
    debugStoryCard(
      'home-top-story',
      { ...(article as any), title: vm.title, slug: resolveArticleSlug(article as any, requestedLang) },
      vm.imageSrc
    );
  }

  if (isLoading) {
    return (
      <Surface theme={theme} className="group overflow-hidden">
        <div className="relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-6">
          <div className="flex items-start justify-between gap-3">
            <div
              className="inline-flex h-8 w-28 animate-pulse rounded-full border"
              style={{ background: theme.surface2, borderColor: theme.border }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="h-3 w-16 animate-pulse rounded-full" style={{ background: theme.chip }} />
            <div className="h-3 w-24 animate-pulse rounded-full" style={{ background: theme.chip }} />
            <div className="h-3 w-20 animate-pulse rounded-full" style={{ background: theme.chip }} />
          </div>

          <div className="mt-5 grid gap-3">
            <div className="h-9 w-[88%] animate-pulse rounded-2xl" style={{ background: theme.surface2 }} />
            <div className="h-9 w-[72%] animate-pulse rounded-2xl" style={{ background: theme.surface2 }} />
          </div>

          <div className="mt-5 aspect-[16/9] w-full animate-pulse rounded-[28px] border" style={{ background: theme.surface2, borderColor: theme.border }} />

          <div className="mt-5 grid gap-2">
            <div className="h-4 w-full animate-pulse rounded-full" style={{ background: theme.surface2 }} />
            <div className="h-4 w-[92%] animate-pulse rounded-full" style={{ background: theme.surface2 }} />
            <div className="h-4 w-[78%] animate-pulse rounded-full" style={{ background: theme.surface2 }} />
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: theme.border }}>
            <div className="flex gap-2">
              <div className="h-3 w-20 animate-pulse rounded-full" style={{ background: theme.chip }} />
              <div className="h-3 w-24 animate-pulse rounded-full" style={{ background: theme.chip }} />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-28 animate-pulse rounded-2xl" style={{ background: theme.surface2 }} />
              <div className="h-10 w-24 animate-pulse rounded-2xl" style={{ background: theme.surface2 }} />
            </div>
          </div>
        </div>
      </Surface>
    );
  }

  return (
    <Surface theme={theme} className="group overflow-hidden">
      <div
        className={cx('relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-6', vm ? 'cursor-pointer' : '')}
        role={vm ? 'link' : undefined}
        tabIndex={vm ? 0 : undefined}
        aria-label={vm ? (vm.title || t('home.topStory')) : undefined}
        onClick={vm ? openArticle : undefined}
        onKeyDown={
          vm
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openArticle();
                }
              }
            : undefined
        }
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: isSponsoredFeatureCard
              ? (theme.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(120,53,15,0.08) 42%, transparent 78%), radial-gradient(circle at 82% 18%, rgba(251,191,36,0.18), transparent 30%)'
                : 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(255,251,235,0.78) 46%, rgba(255,255,255,0.92) 78%), radial-gradient(circle at 84% 18%, rgba(251,191,36,0.18), transparent 30%)')
              : (theme.mode === 'dark'
                ? 'radial-gradient(circle at top left, rgba(56,189,248,0.16), transparent 36%), radial-gradient(circle at 85% 20%, rgba(167,139,250,0.14), transparent 32%)'
                : 'radial-gradient(circle at top left, rgba(37,99,235,0.10), transparent 36%), radial-gradient(circle at 85% 20%, rgba(124,58,237,0.09), transparent 32%)'),
          }}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em]"
              style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: topStoryDotColor }} />
              {topStoryLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {vm ? (
              <button
                type="button"
                onClick={onToggleSave}
                aria-label={bookmarked ? t('common.saved') : t('common.save')}
                title={bookmarked ? t('common.saved') : t('common.save')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]"
                style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
              >
                <Bookmark className="h-5 w-5" fill={bookmarked ? 'currentColor' : 'none'} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative mt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.sub }}>
            <span>{vm.time}</span>
            <span aria-hidden="true" style={{ opacity: 0.45 }}>•</span>
            <span className="truncate">{vm.source}</span>
            {vm.category ? (
              <>
                <span aria-hidden="true" style={{ opacity: 0.45 }}>•</span>
                <span className="truncate" style={{ color: theme.text }}>{vm.category}</span>
              </>
            ) : null}
            {isSponsoredFeatureCard && vm.sponsorName ? (
              <>
                <span aria-hidden="true" style={{ opacity: 0.45 }}>•</span>
                <span className="truncate" style={{ color: '#b45309' }}>Presented with {vm.sponsorName}</span>
              </>
            ) : null}
          </div>

          <div className="mt-4 flex items-start gap-2">
            <h1 className="min-w-0 text-[1.82rem] font-extrabold leading-[1.18] tracking-[-0.015em] sm:text-[2.15rem] sm:leading-[1.15] md:text-[2.35rem]" style={{ color: theme.text, ...lineClamp4 }}>
              {vm.title}
            </h1>
            {vm.titleIsOriginal ? <OriginalTag /> : null}
          </div>

          <div className="mt-5">
            <TopStoryImage
              storyId={vm.id}
              src={vm.imageSrc}
              alt={vm.title}
              priority
              fallbackSrc={COVER_PLACEHOLDER_SRC}
            />
          </div>

          <div className="mt-5 text-[15px] leading-7 sm:text-[15px] sm:leading-7" style={{ color: theme.sub }}>
            <span style={lineClamp3}>{vm.summary}</span>
            {vm.summaryIsOriginal ? <span className="ml-2 align-middle"><OriginalTag /></span> : null}
          </div>

          {isSponsoredFeatureCard && (vm.sponsorDisclosure || vm.sponsorName) ? (
            <div
              className="mt-5 rounded-[24px] border px-4 py-3 text-sm leading-6"
              style={{
                borderColor: 'rgba(245,158,11,0.22)',
                background: theme.mode === 'dark' ? 'rgba(120,53,15,0.18)' : 'rgba(255,251,235,0.88)',
                color: theme.sub,
              }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: '#b45309' }}>
                Sponsored Feature
              </div>
              <div className="mt-1">
                {vm.sponsorDisclosure || (vm.sponsorName ? `Presented with ${vm.sponsorName}.` : '')}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: theme.border }}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] font-medium" style={{ color: theme.sub }}>
              {vm.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {vm.location}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> {vm.readMinutes} {t('common.minutesShort')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {primaryHref ? (
                vm.destinationIsExternal ? (
                  <a
                    href={primaryHref}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold border transition hover:opacity-[0.98]"
                    style={{ background: isSponsoredFeatureCard ? '#b45309' : theme.accent, color: '#fff', borderColor: 'transparent' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(isSponsoredFeatureCard && vm.ctaLabel) ? vm.ctaLabel : t('common.read')} <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <Link
                    href={primaryHref}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold border transition hover:opacity-[0.98]"
                    style={{ background: isSponsoredFeatureCard ? '#b45309' : theme.accent, color: '#fff', borderColor: 'transparent' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(isSponsoredFeatureCard && vm.ctaLabel) ? vm.ctaLabel : t('common.read')} <ArrowRight className="h-4 w-4" />
                  </Link>
                )
              ) : null}

              {!isSponsoredFeatureCard ? (
                <Button
                  theme={theme}
                  variant="soft"
                  className="px-4 py-2.5"
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToast('Listen (planned)');
                  }}
                >
                  <Radio className="h-4 w-4" /> {t('common.listen')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}

function CenterStoryFeed({ theme, items, lang }: any) {
  const { t } = useI18n();
  const safeLang = lang === 'hi' || lang === 'gu' ? lang : 'en';
  const prefix = safeLang === 'en' ? '' : `/${safeLang}`;
  const isLoading = items == null;
  const listItems: any[] = Array.isArray(items) ? items : [];

  const visibleItems = React.useMemo(() => listItems.slice(0, 6), [listItems]);

  const lineClamp2: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const resolveCategoryLabel = React.useCallback(
    (raw: unknown) => {
      const categoryRaw = String(raw || '').trim();
      const categoryKey = normalizeCategoryKey(categoryRaw);
      const categoryLabelKey = categoryKey ? labelKeyForCategory(categoryKey) : '';
      const translated = categoryLabelKey ? t(categoryLabelKey) : '';
      if (categoryLabelKey && translated && translated !== categoryLabelKey) return translated;
      return categoryRaw;
    },
    [t]
  );

  if (!isLoading && !visibleItems.length) return null;

  return (
    <Surface theme={theme} className="overflow-hidden">
      <div className="border-b px-4 py-4 sm:px-5" style={{ borderColor: theme.border }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold uppercase tracking-[0.18em]" style={{ color: theme.sub }}>
              {t('home.freshUpdates')}
            </div>
            <div className="mt-1 text-lg font-black tracking-tight" style={{ color: theme.text }}>
              Continuous live homepage flow
            </div>
          </div>

          <Link
            href={`${prefix}/latest`}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition hover:opacity-[0.98]"
            style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}
          >
            {t('common.viewAll')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:p-5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`home-center-row-skeleton-${index}`}
                className="grid grid-cols-[108px_1fr] gap-4 rounded-[26px] border bg-white p-3 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.28)] sm:grid-cols-[132px_1fr] sm:p-4"
                style={{ borderColor: theme.border }}
              >
                <div className="h-[82px] rounded-2xl bg-slate-100 animate-pulse sm:h-[96px]" />
                <div className="min-w-0">
                  <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
                  <div className="mt-3 h-5 w-full rounded bg-slate-100 animate-pulse" />
                  <div className="mt-2 h-5 w-4/5 rounded bg-slate-100 animate-pulse" />
                  <div className="mt-3 h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
                </div>
              </div>
            ))
          : visibleItems.map((item: any, index: number) => {
              const storyId = getStoryId(item);
              const rawSlug = getStorySlug(item);
              const href = buildNewsUrl({ id: storyId || rawSlug, slug: rawSlug, lang: safeLang });
              const categoryLabel = resolveCategoryLabel(item?.category);
              const imageSrc = String(item?.imageSrc || '').trim();
              const summary = String(item?.desc || '').trim();
              const readMinutes = estimateReadMinutes(`${String(item?.title || '').trim()} ${summary}`);
              const showSummary = index < 2 && summary;
              const storyKey = getStoryReactKey(item, href);

              debugStoryCard('home-fresh-updates', item, imageSrc);

              return (
                <Link
                  key={storyKey}
                  href={href}
                  className="group block rounded-[28px] border p-3 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.32)] transition hover:-translate-y-[1px] hover:shadow-[0_24px_46px_-30px_rgba(15,23,42,0.34)] sm:p-4"
                  style={{ borderColor: theme.border, background: theme.surface }}
                >
                  <article className={cx('grid gap-4', showSummary ? 'md:grid-cols-[148px_1fr]' : 'md:grid-cols-[116px_1fr]')}>
                    {imageSrc ? (
                      <StoryImage
                        storyId={storyId}
                        src={imageSrc}
                        fitMode={item?.coverFitMode}
                        alt={String(item?.title || '').trim()}
                        variant="mini"
                        fallbackSrc={COVER_PLACEHOLDER_SRC}
                        className={cx(
                          'w-full border border-black/10',
                          showSummary ? 'md:w-[148px]' : 'md:w-[116px]'
                        )}
                      />
                    ) : (
                      <div
                        className={cx(
                          'relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/10 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(226,232,240,0.9))] w-full',
                          showSummary ? 'md:w-[148px]' : 'md:w-[116px]'
                        )}
                      >
                        <div className="absolute inset-0 grid place-items-center text-[10px] font-extrabold tracking-[0.16em] text-slate-600/90">
                          NP
                        </div>
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.sub }}>
                        {categoryLabel ? (
                          <span className="rounded-full border px-2.5 py-1" style={{ borderColor: theme.border, background: theme.surface2, color: theme.text }}>
                            {categoryLabel}
                          </span>
                        ) : null}
                        {item?.time ? <span>{item.time}</span> : null}
                        <span>{readMinutes} {t('common.minutesShort')}</span>
                      </div>

                      <div className="mt-2 flex items-start gap-2">
                        <h3
                          className={cx('min-w-0 font-black tracking-tight', showSummary ? 'text-lg leading-snug sm:text-[1.1rem]' : 'text-base leading-snug')}
                          style={{ color: theme.text, ...lineClamp2 }}
                        >
                          {String(item?.title || '').trim()}
                        </h3>
                        {item?.titleIsOriginal ? <OriginalTag /> : null}
                      </div>

                      {showSummary ? (
                        <div className="mt-2 text-sm leading-6" style={{ color: theme.sub, ...lineClamp2 }}>
                          {summary}
                        </div>
                      ) : null}
                    </div>
                  </article>
                </Link>
              );
            })}
      </div>
    </Surface>
  );
}

function MoreReadsSection({ theme, items, lang }: any) {
  const { t } = useI18n();
  const safeLang = lang === 'hi' || lang === 'gu' ? lang : 'en';
  const prefix = safeLang === 'en' ? '' : `/${safeLang}`;
  const isLoading = items == null;
  const listItems: any[] = Array.isArray(items) ? items : [];

  const visibleItems = React.useMemo(() => listItems.slice(0, 3), [listItems]);

  const lineClamp2: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const resolveCategoryLabel = React.useCallback(
    (raw: unknown) => {
      const categoryRaw = String(raw || '').trim();
      const categoryKey = normalizeCategoryKey(categoryRaw);
      const categoryLabelKey = categoryKey ? labelKeyForCategory(categoryKey) : '';
      const translated = categoryLabelKey ? t(categoryLabelKey) : '';
      if (categoryLabelKey && translated && translated !== categoryLabelKey) return translated;
      return categoryRaw;
    },
    [t]
  );

  return (
    <Surface theme={theme} className="overflow-hidden">
      <div
        className="flex items-center justify-between gap-3 border-b p-4 sm:p-5"
        style={{
          borderColor: theme.border,
          background: theme.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(56,189,248,0.08), transparent 58%)'
            : 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,0.72) 58%)',
        }}
      >
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold uppercase tracking-[0.18em]" style={{ color: theme.sub }}>
            More Reads
          </div>
          <div className="mt-1 text-sm font-semibold" style={{ color: theme.text }}>
            The next set of stories shaping the edition
          </div>
        </div>

        <Link
          href={`${prefix}/latest`}
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold transition hover:opacity-[0.98]"
          style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}
        >
          {t('common.viewAll')} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`more-reads-skeleton-${index}`}
                className="rounded-[28px] border bg-white p-3 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.24)]"
                style={{ borderColor: theme.border }}
              >
                <div className="h-[120px] rounded-2xl bg-slate-100 animate-pulse" />
                <div className="mt-3 h-3 w-24 rounded bg-slate-100 animate-pulse" />
                <div className="mt-3 h-5 w-full rounded bg-slate-100 animate-pulse" />
                <div className="mt-2 h-5 w-4/5 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : !visibleItems.length ? (
          <div
            className="rounded-[28px] border p-6 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)] sm:p-7"
            style={{ borderColor: theme.border, background: theme.surface }}
          >
            <div className="mx-auto max-w-2xl text-center">
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em]"
                style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: theme.accent2 }} />
                More Reads
              </div>

              <div className="mt-4 text-xl font-black tracking-tight sm:text-2xl" style={{ color: theme.text }}>
                Fresh stories will appear here shortly
              </div>

              <div className="mt-3 text-sm leading-6 sm:text-[15px]" style={{ color: theme.sub }}>
                The homepage desk is holding this slot until the next strong read is ready. Explore the latest feed in the meantime.
              </div>

              <div className="mt-5 flex justify-center">
                <Link
                  href={`${prefix}/latest`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold border transition hover:opacity-[0.98]"
                  style={{ background: theme.accent, color: '#fff', borderColor: 'transparent' }}
                >
                  {t('common.viewAll')} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {visibleItems.map((item: any, index: number) => {
              const storyId = getStoryId(item);
              const rawSlug = getStorySlug(item);
              const href = buildNewsUrl({ id: storyId || rawSlug, slug: rawSlug, lang: safeLang });
              const categoryLabel = resolveCategoryLabel(item?.category);
              const imageSrc = String(item?.imageSrc || '').trim();
              const summary = String(item?.desc || '').trim();
              const storyKey = getStoryReactKey(item, href);

              debugStoryCard('home-more-reads', item, imageSrc);

              return (
                <Link
                  key={storyKey}
                  href={href}
                  className="group block rounded-[28px] border p-3 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.28)] transition hover:-translate-y-[1px] hover:shadow-[0_22px_46px_-30px_rgba(15,23,42,0.30)] sm:p-4"
                  style={{ borderColor: theme.border, background: theme.surface }}
                >
                  {imageSrc ? (
                    <StoryImage
                      storyId={storyId}
                      src={imageSrc}
                      fitMode={item?.coverFitMode}
                      alt={String(item?.title || '').trim()}
                      variant="card"
                      fallbackSrc={COVER_PLACEHOLDER_SRC}
                      className="border border-black/10"
                    />
                  ) : (
                    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-black/10 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(226,232,240,0.9))]">
                      <div className="absolute inset-0 grid place-items-center text-[11px] font-extrabold tracking-[0.14em] text-slate-600/90 select-none">
                        News Pulse
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: theme.sub }}>
                    {categoryLabel ? <span>{categoryLabel}</span> : null}
                    {categoryLabel && item?.time ? <span>•</span> : null}
                    {item?.time ? <span>{item.time}</span> : null}
                  </div>

                  <div className="mt-2 flex items-start gap-2">
                    <h3 className="min-w-0 text-base font-bold leading-snug tracking-tight" style={{ color: theme.text, ...lineClamp2 }}>
                      {String(item?.title || '').trim()}
                    </h3>
                    {item?.titleIsOriginal ? <OriginalTag /> : null}
                  </div>

                  {summary ? (
                    <div className="mt-2 text-sm leading-6" style={{ color: theme.sub, ...lineClamp2 }}>
                      {summary}
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Surface>
  );
}

function FeedList({ theme, title, items, lang }: any) {
  const { t } = useI18n();
  const safeLang = (lang === 'hi' || lang === 'gu') ? lang : 'en';
  const prefix = safeLang === 'en' ? '' : `/${safeLang}`;

  const MAX_ITEMS = 6;
  const CATEGORY_ORDER = [
    'regional',
    'national',
    'international',
    'business',
    'science-tech',
    'sports',
    'lifestyle',
    'glamour',
  ] as const;
  type LatestCategoryKey = (typeof CATEGORY_ORDER)[number] | 'unknown';

  const normalizeCategoryKey = (raw: unknown): LatestCategoryKey => {
    const v = String(raw || '').toLowerCase().trim();
    if (!v) return 'unknown';
    if (v.includes('sci') || v.includes('tech') || v.includes('science')) return 'science-tech';
    if (v.includes('international') || v.includes('world')) return 'international';
    if (v.includes('national')) return 'national';
    if (v.includes('business')) return 'business';
    if (v.includes('sport')) return 'sports';
    if (v.includes('lifestyle')) return 'lifestyle';
    if (v.includes('glamour') || v.includes('entertain')) return 'glamour';
    if (v.includes('regional') || v.includes('gujarat') || v.includes('local')) return 'regional';
    return 'unknown';
  };

  const categoryBadgeClasses = (raw: unknown): string => {
    const key = normalizeCategoryKey(raw);
    if (key === 'business') return 'bg-blue-50 text-blue-700 border-blue-100';
    if (key === 'national') return 'bg-orange-50 text-orange-700 border-orange-100';
    if (key === 'international') return 'bg-purple-50 text-purple-700 border-purple-100';
    if (key === 'sports') return 'bg-green-50 text-green-700 border-green-100';
    if (key === 'science-tech') return 'bg-cyan-50 text-cyan-700 border-cyan-100';
    if (key === 'lifestyle') return 'bg-pink-50 text-pink-700 border-pink-100';
    if (key === 'glamour') return 'bg-rose-50 text-rose-700 border-rose-100';
    if (key === 'regional') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  const isLoading = items == null;
  const listItems: any[] = Array.isArray(items) ? items : [];

  const FILTER_OPTIONS = [
    { key: 'all', label: 'All' },
    { key: 'regional', label: 'Regional' },
    { key: 'national', label: 'National' },
    { key: 'international', label: 'International' },
  ] as const;
  type LatestFilterKey = (typeof FILTER_OPTIONS)[number]['key'];
  const [activeFilter, setActiveFilter] = React.useState<LatestFilterKey>('all');

  const orderedItems = React.useMemo(() => {
    const picked: any[] = [];
    const pickedIds = new Set<string>();

    const getItemId = (it: any): string => {
      return getStoryId(it) || getStorySlug(it);
    };

    for (const item of listItems) {
      const id = getItemId(item);
      if (!id || pickedIds.has(id)) {
        continue;
      }
      picked.push(item);
      pickedIds.add(id);
    }

    const filtered = activeFilter === 'all'
      ? picked
      : picked.filter((item) => normalizeCategoryKey(item?.category) === activeFilter);

    return filtered.slice(0, MAX_ITEMS);
  }, [activeFilter, listItems]);

  if (!isLoading && !orderedItems.length) return null;

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/85 backdrop-blur shadow-[0_22px_48px_-38px_rgba(15,23,42,0.34)] transition hover:shadow-[0_28px_56px_-38px_rgba(15,23,42,0.38)]">
      <div
        className="border-b p-4"
        style={{
          borderColor: theme.border,
          background: theme.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(167,139,250,0.12), transparent 58%)'
            : 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(255,255,255,0.70) 58%)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" aria-hidden="true" style={{ background: theme.accent }} />
              <div className="truncate text-sm font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
                {title}
              </div>
            </div>
            <div className="mt-1 text-base font-black tracking-tight" style={{ color: theme.text }}>
              Real-time homepage desk
            </div>
          </div>

          <Link
            href={`${prefix}/latest`}
            className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold transition"
            style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}
          >
            {t('common.viewAll')}
          </Link>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => {
            const isActive = activeFilter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveFilter(option.key)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.08em] transition"
                style={{
                  borderColor: isActive ? theme.accent : theme.border,
                  color: isActive ? theme.accent : theme.sub,
                  background: isActive
                    ? (theme.mode === 'dark' ? 'rgba(56,189,248,0.12)' : 'rgba(37,99,235,0.08)')
                    : theme.surface,
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-2 pb-2 pt-2">
        {isLoading ? (
          <div className="px-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`sk-${i}`} className="border-b border-slate-100 last:border-b-0 py-2.5">
                <div className="h-3 w-2/3 rounded bg-slate-100 animate-pulse" />
                <div className="mt-2 h-4 w-full rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : !orderedItems.length ? (
          <div className="px-4 pb-4 pt-2 text-sm text-slate-500">No fresh updates right now</div>
        ) : (
          orderedItems.map((f: any) => {
            const storyId = getStoryId(f);
            const rawSlug = getStorySlug(f);
            const href = buildNewsUrl({ id: storyId || rawSlug, slug: rawSlug, lang: safeLang });
            const time = String(f?.time || '').trim();
            const category = String(f?.category || '').trim();
            const metaText = time;
            const storyKey = getStoryReactKey(f, href);

            debugStoryCard('home-feed-list', f, f?.imageSrc);

            return (
              <Link
                key={storyKey}
                href={href}
                className="block rounded-[20px] border-b border-slate-100 px-3 py-2.5 transition last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {metaText ? (
                    <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{metaText}</div>
                  ) : null}

                  {category ? (
                    <span
                      className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${categoryBadgeClasses(category)}`}
                    >
                      {category}
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 flex items-start gap-2">
                  <span className="line-clamp-2 font-semibold text-sm leading-snug" style={{ color: theme.text }}>
                    {String(f?.title || '').trim()}
                  </span>
                  {f?.titleIsOriginal ? <OriginalTag /> : null}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function LiveTVWidget({ theme, enabled = true, onToast, embedUrlOverride }: any) {
  const { t } = useI18n();
  if (!enabled) return null;

  const effectiveEmbedUrlRaw = (typeof embedUrlOverride === 'string' && embedUrlOverride.trim()) ? embedUrlOverride : '';
  const effectiveEmbedUrl = sanitizeEmbedUrl(effectiveEmbedUrlRaw);
  const hasUrl = !!effectiveEmbedUrl;

  return (
    <Surface theme={theme} className="overflow-hidden">
      <div
        className="border-b px-4 py-4"
        style={{
          borderColor: theme.border,
          background: theme.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(239,68,68,0.16), rgba(56,189,248,0.10) 68%, transparent 100%)'
            : 'linear-gradient(135deg, rgba(220,38,38,0.10), rgba(37,99,235,0.07) 68%, rgba(255,255,255,0.74) 100%)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
              Broadcast module
            </div>
            <div className="mt-1 text-sm font-black tracking-tight" style={{ color: theme.text }}>
            {t('common.liveTv')}
            </div>
            <div className="mt-1 text-xs" style={{ color: theme.sub }}>
            {t('home.liveTvPartnerChannel')}
            </div>
          </div>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-extrabold border text-white" style={{ background: theme.live, borderColor: "rgba(255,255,255,0.18)" }}>
          {t('common.live')}
        </span>
      </div>

      <div className="p-4 pt-4">
      <div className="rounded-3xl border overflow-hidden shadow-[0_20px_46px_-36px_rgba(15,23,42,0.36)]" style={{ borderColor: theme.border, background: theme.surface2 }}>
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

      <div className="mt-4 grid gap-2">
        <Button theme={theme} variant="soft" className="w-full justify-start px-4 py-3" onClick={() => onToast("Live TV full page (planned)")}>
          <Play className="h-4 w-4" /> {t('common.openLiveTv')}
        </Button>

        <Button
          theme={theme}
          variant="ghost"
          className="w-full justify-start px-4 py-3"
          onClick={() => onToast("Live TV visibility is admin-controlled")}
        >
          <X className="h-4 w-4" /> {t('home.turnOffWidget')}
        </Button>
      </div>
      </div>
    </Surface>
  );
}

function HomeEditorialSection({ theme, title, href, items, lang, Icon }: any) {
  const { t } = useI18n();
  const safeLang = lang === 'hi' || lang === 'gu' ? lang : 'en';
  const spotlightLeadMediaClasses = 'relative overflow-hidden rounded-[30px] bg-slate-100 shadow-[0_24px_54px_-36px_rgba(15,23,42,0.26)] ring-1 ring-slate-200/70';

  const lineClamp2: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const resolveCategoryLabel = React.useCallback(
    (raw: unknown) => {
      const categoryRaw = String(raw || '').trim();
      const categoryKey = normalizeCategoryKey(categoryRaw);
      const categoryLabelKey = categoryKey ? labelKeyForCategory(categoryKey) : '';
      const translated = categoryLabelKey ? t(categoryLabelKey) : '';
      if (categoryLabelKey && translated && translated !== categoryLabelKey) return translated;
      return categoryRaw;
    },
    [t]
  );

  if (!Array.isArray(items) || !items.length) return null;

  const lead = items[0];
  const secondary = items.slice(1, 5);
  const localizedHref = localizePath(href, safeLang);

  if (lead) {
    debugStoryCard('home-editorial-lead', lead, lead?.imageSrc);
  }

  return (
    <Surface theme={theme} className="overflow-hidden">
      <div
        className="border-b px-4 py-4 sm:px-5"
        style={{
          borderColor: theme.border,
          background: theme.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(56,189,248,0.10), rgba(167,139,250,0.09) 65%, transparent 100%)'
            : 'linear-gradient(135deg, rgba(37,99,235,0.07), rgba(124,58,237,0.06) 65%, rgba(255,255,255,0.72) 100%)',
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border" style={{ borderColor: theme.border, background: theme.surface2, color: theme.text }}>
                <Icon className="h-4 w-4" />
              </span>
              Section spotlight
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight" style={{ color: theme.text }}>
              {title}
            </div>
          </div>

          <Link
            href={localizedHref}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition hover:opacity-[0.98]"
            style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}
          >
            {t('common.viewAll')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] xl:items-start">
        {lead ? (
          <Link
            href={buildNewsUrl({ id: getStoryId(lead) || getStorySlug(lead), slug: getStorySlug(lead), lang: safeLang })}
            className="group block overflow-hidden rounded-[28px] border p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.30)] transition hover:-translate-y-[1px] hover:shadow-[0_24px_52px_-34px_rgba(15,23,42,0.34)] sm:p-5"
            style={{ borderColor: theme.border, background: theme.surface }}
          >
            <div className={spotlightLeadMediaClasses}>
              {lead?.imageSrc ? (
                <StoryImage
                  storyId={getStoryId(lead)}
                  src={String(lead.imageSrc)}
                  fitMode="cover"
                  alt={String(lead?.title || title || '').trim()}
                  variant="top"
                  fallbackSrc={COVER_PLACEHOLDER_SRC}
                  allowLowResContainFallback={false}
                  className="w-full rounded-none bg-transparent shadow-none ring-0"
                />
              ) : (
                <div className="w-full bg-slate-100" style={{ aspectRatio: '16 / 9' }}>
                  <div className="grid h-full w-full place-items-center">
                    <div className="text-xs font-extrabold tracking-tight text-slate-500 select-none">
                      News <span className="text-slate-700">Pulse</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.sub }}>
              {lead?.category ? (
                <span className="rounded-full border px-2.5 py-1" style={{ borderColor: theme.border, background: theme.surface2, color: theme.text }}>
                  {resolveCategoryLabel(lead.category)}
                </span>
              ) : null}
              {lead?.time ? <span>{lead.time}</span> : null}
            </div>

            <div className="mt-3 flex items-start gap-2">
              <h3 className="min-w-0 text-[1.35rem] font-black leading-tight tracking-tight" style={{ color: theme.text, ...lineClamp2 }}>
                {String(lead?.title || '').trim()}
              </h3>
              {lead?.titleIsOriginal ? <OriginalTag /> : null}
            </div>

            {lead?.desc ? (
              <div className="mt-3 text-sm leading-6" style={{ color: theme.sub, ...lineClamp2 }}>
                {String(lead.desc).trim()}
              </div>
            ) : null}
          </Link>
        ) : null}

        <div className="grid gap-3">
          {secondary.map((item: any) => {
            const storyId = getStoryId(item);
            const rawSlug = getStorySlug(item);
            const href = buildNewsUrl({ id: storyId || rawSlug, slug: rawSlug, lang: safeLang });
            const storyKey = getStoryReactKey(item, href);

            debugStoryCard('home-editorial-secondary', item, item?.imageSrc);

            return (
              <Link
                key={storyKey}
                href={href}
                className="group block rounded-[24px] border p-3 shadow-[0_14px_32px_-28px_rgba(15,23,42,0.28)] transition hover:-translate-y-[1px] hover:shadow-[0_20px_40px_-28px_rgba(15,23,42,0.30)] sm:p-4"
                style={{ borderColor: theme.border, background: theme.surface }}
              >
                <article className="grid grid-cols-[96px_1fr] gap-4 sm:grid-cols-[116px_1fr]">
                  {item?.imageSrc ? (
                    <StoryImage
                      storyId={storyId}
                      src={String(item.imageSrc)}
                      fitMode={item?.coverFitMode}
                      alt={String(item?.title || '').trim()}
                      variant="mini"
                      fallbackSrc={COVER_PLACEHOLDER_SRC}
                      className="border border-black/10"
                    />
                  ) : (
                    <div className="relative w-[96px] aspect-[4/3] overflow-hidden rounded-2xl border border-black/10 bg-[linear-gradient(135deg,rgba(248,250,252,0.95),rgba(226,232,240,0.9))] sm:w-[116px]">
                      <div className="absolute inset-0 grid place-items-center text-[10px] font-extrabold tracking-[0.16em] text-slate-600/90">NP</div>
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.sub }}>
                      {item?.category ? <span>{resolveCategoryLabel(item.category)}</span> : null}
                      {item?.category && item?.time ? <span>•</span> : null}
                      {item?.time ? <span>{item.time}</span> : null}
                    </div>
                    <div className="mt-2 flex items-start gap-2">
                      <h3 className="min-w-0 text-base font-bold leading-snug tracking-tight" style={{ color: theme.text, ...lineClamp2 }}>
                        {String(item?.title || '').trim()}
                      </h3>
                      {item?.titleIsOriginal ? <OriginalTag /> : null}
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}

function HomeSpotlightCarousel({ theme, title, href, items, lang, Icon }: any) {
  const { t } = useI18n();
  const safeLang = lang === 'hi' || lang === 'gu' ? lang : 'en';
  const localizedHref = localizePath(href, safeLang);
  const slides = React.useMemo(() => (Array.isArray(items) ? items.slice(0, HOME_SPOTLIGHT_MAX_ITEMS) : []), [items]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const lineClamp2: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const lineClamp3: React.CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  const resolveCategoryLabel = React.useCallback(
    (raw: unknown) => {
      const categoryRaw = String(raw || '').trim();
      const categoryKey = normalizeCategoryKey(categoryRaw);
      const categoryLabelKey = categoryKey ? labelKeyForCategory(categoryKey) : '';
      const translated = categoryLabelKey ? t(categoryLabelKey) : '';
      if (categoryLabelKey && translated && translated !== categoryLabelKey) return translated;
      return categoryRaw;
    },
    [t]
  );

  React.useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  const goToPrevious = React.useCallback(() => {
    if (slides.length <= 1) return;
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goToNext = React.useCallback(() => {
    if (slides.length <= 1) return;
    setActiveIndex((current) => (current + 1) % slides.length);
  }, [slides.length]);

  React.useEffect(() => {
    if (slides.length <= 1 || isPaused) return;
    const timerId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, HOME_SPOTLIGHT_ROTATE_MS);

    return () => window.clearInterval(timerId);
  }, [isPaused, slides.length]);

  const onTouchStart = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }, []);

  const onTouchEnd = React.useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    touchStartX.current = null;

    if (startX == null || endX == null) return;

    const delta = endX - startX;
    if (Math.abs(delta) < 40) return;

    if (delta > 0) {
      goToPrevious();
      return;
    }

    goToNext();
  }, [goToNext, goToPrevious]);

  const activeItem = slides[activeIndex] || null;

  const vm = React.useMemo(() => {
    if (!activeItem) return null;

    const storyId = getStoryId(activeItem);
    const rawSlug = getStorySlug(activeItem);
    const storyHref = buildNewsUrl({ id: storyId || rawSlug, slug: rawSlug, lang: safeLang });
    const categoryLabel = resolveCategoryLabel(activeItem?.category);
    const summary = truncateSmart(String(activeItem?.desc || '').trim(), 180);
    const readMinutes = estimateReadMinutes(`${String(activeItem?.title || '').trim()} ${summary}`);

    return {
      key: getStoryReactKey(activeItem, storyHref),
      href: storyHref,
      categoryLabel,
      summary,
      readMinutes,
      imageSrc: String(activeItem?.imageSrc || '').trim(),
      title: String(activeItem?.title || '').trim(),
      time: String(activeItem?.time || '').trim(),
      coverFitMode: activeItem?.coverFitMode,
      storyId,
      titleIsOriginal: Boolean(activeItem?.titleIsOriginal),
    };
  }, [activeItem, resolveCategoryLabel, safeLang]);

  if (!vm) return null;

  return (
    <Surface theme={theme} className="overflow-hidden">
      <div
        className="border-b px-4 py-4 sm:px-5"
        style={{
          borderColor: theme.border,
          background: theme.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(56,189,248,0.10), rgba(244,114,182,0.09) 65%, transparent 100%)'
            : 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(244,114,182,0.08) 65%, rgba(255,255,255,0.76) 100%)',
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border" style={{ borderColor: theme.border, background: theme.surface2, color: theme.text }}>
                <Icon className="h-4 w-4" />
              </span>
              Spotlight
            </div>
            <div className="mt-2 text-2xl font-black tracking-tight" style={{ color: theme.text }}>
              {title}
            </div>
            <div className="mt-1 max-w-2xl text-sm leading-6" style={{ color: theme.sub }}>
              Freshly selected from the newsroom's most important stories
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={goToPrevious}
                aria-label="Previous spotlight story"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]"
                style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToNext}
                aria-label="Next spotlight story"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]"
                style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <Link
              href={localizedHref}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition hover:opacity-[0.98]"
              style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}
            >
              {t('common.viewAll')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div
          className="overflow-hidden rounded-[30px] border p-4 shadow-[0_24px_54px_-38px_rgba(15,23,42,0.30)] sm:p-5 lg:p-6"
          style={{ borderColor: theme.border, background: theme.surface }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.article
              key={vm.key}
              initial={{ opacity: 0, y: 10, scale: 0.992 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, y: -10, scale: 0.996 }}
              transition={{ duration: 0.34, ease: 'easeOut' }}
              className="grid gap-5 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-center lg:gap-7"
            >
              <Link href={vm.href} className="group block">
                <div className="relative overflow-hidden rounded-[28px] bg-slate-100 shadow-[0_22px_48px_-36px_rgba(15,23,42,0.26)] ring-1 ring-slate-200/70">
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-[linear-gradient(180deg,rgba(15,23,42,0.12),rgba(15,23,42,0))]" />
                  {vm.imageSrc ? (
                    <StoryImage
                      storyId={vm.storyId}
                      src={vm.imageSrc}
                      fitMode={vm.coverFitMode}
                      alt={vm.title}
                      variant="top"
                      fallbackSrc={COVER_PLACEHOLDER_SRC}
                      allowLowResContainFallback={false}
                      className="w-full rounded-none bg-transparent shadow-none ring-0"
                    />
                  ) : (
                    <div className="w-full bg-slate-100" style={{ aspectRatio: '16 / 9' }}>
                      <div className="grid h-full w-full place-items-center">
                        <div className="text-xs font-extrabold tracking-tight text-slate-500 select-none">
                          News <span className="text-slate-700">Pulse</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Link>

              <div className="min-w-0 lg:pr-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.sub }}>
                  {vm.categoryLabel ? (
                    <span className="rounded-full border px-2.5 py-1 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.35)]" style={{ borderColor: theme.border, background: theme.surface2, color: theme.text }}>
                      {vm.categoryLabel}
                    </span>
                  ) : null}
                  {vm.time ? <span className="text-[10.5px]" style={{ color: theme.muted }}>{vm.time}</span> : null}
                  {vm.time ? <span aria-hidden="true" style={{ opacity: 0.38 }}>•</span> : null}
                  <span className="text-[10.5px]" style={{ color: theme.muted }}>{vm.readMinutes} {t('common.minutesShort')}</span>
                </div>

                <div className="mt-4 flex items-start gap-2">
                  <h3 className="min-w-0 text-[1.62rem] font-black leading-[1.14] tracking-[-0.015em] sm:text-[1.92rem]" style={{ color: theme.text, ...lineClamp2 }}>
                    {vm.title}
                  </h3>
                  {vm.titleIsOriginal ? <OriginalTag /> : null}
                </div>

                {vm.summary ? (
                  <div className="mt-4 max-w-xl text-sm leading-6 sm:text-[15px] sm:leading-6" style={{ color: theme.sub, ...lineClamp3 }}>
                    {vm.summary}
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={vm.href}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold border transition hover:opacity-[0.98]"
                    style={{ background: theme.accent, color: '#fff', borderColor: 'transparent' }}
                  >
                    {t('common.read')} <ArrowRight className="h-4 w-4" />
                  </Link>

                  <div className="flex items-center gap-2 sm:hidden">
                    <button
                      type="button"
                      onClick={goToPrevious}
                      aria-label="Previous spotlight story"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]"
                      style={{ color: theme.text, borderColor: theme.border, background: theme.surface2 }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={goToNext}
                      aria-label="Next spotlight story"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-[0.98]"
                      style={{ color: theme.text, borderColor: theme.border, background: theme.surface2 }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        {slides.length > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: theme.sub }}>
              <span>{activeIndex + 1} / {slides.length}</span>
              <span className="inline-flex h-1.5 w-20 overflow-hidden rounded-full" style={{ background: theme.border }}>
                <motion.span
                  key={`spotlight-progress-${activeIndex}-${isPaused ? 'paused' : 'running'}`}
                  initial={{ width: '0%' }}
                  animate={{ width: isPaused ? '100%' : '100%' }}
                  transition={{ duration: isPaused ? 0.2 : HOME_SPOTLIGHT_ROTATE_MS / 1000, ease: 'linear' }}
                  className="h-full rounded-full"
                  style={{ background: theme.accent }}
                />
              </span>
            </div>
            <div className="flex items-center gap-2">
              {slides.map((slide: any, index: number) => {
                const isActive = index === activeIndex;
                const key = getStoryReactKey(slide, `${String(slide?.id || slide?.slug || index)}`);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Go to spotlight story ${index + 1}`}
                    className="h-2.5 rounded-full transition-all"
                    style={{
                      width: isActive ? 24 : 8,
                      background: isActive ? theme.accent : theme.border,
                      opacity: isActive ? 1 : 0.55,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
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
  const [weatherValue, setWeatherValue] = useState<string>('');

  React.useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const city = 'Ahmedabad';
    const load = async () => {
      try {
        const wx = await fetchCurrentWeather({ city, signal: controller.signal });
        if (!mounted) return;
        setWeatherValue(`${Math.round(wx.tempC)}°C • ${wx.condition}`);
      } catch {
        if (!mounted) return;
        setWeatherValue('Weather unavailable');
      }
    };

    void load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => {
      mounted = false;
      controller.abort();
      clearInterval(id);
    };
  }, []);

  return (
    <Surface theme={theme} className="overflow-hidden">
      <div
        className="border-b px-4 py-4"
        style={{
          borderColor: theme.border,
          background: theme.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(56,189,248,0.08) 72%, transparent 100%)'
            : 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(37,99,235,0.05) 72%, rgba(255,255,255,0.72) 100%)',
        }}
      >
        <div className="text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
          Daily briefing
        </div>
        <div className="mt-1 text-sm font-black tracking-tight" style={{ color: theme.text }}>
        {t('home.snapshotsTitle')}
        </div>
      <div className="mt-1 text-xs" style={{ color: theme.sub }}>
        {t('home.snapshotsSubtitle')}
      </div>
      </div>

      <div className="grid gap-3 p-4">
        {[
          { k: t('home.snapshotWeather'), v: weatherValue || '—' },
          { k: t('home.snapshotMarkets'), v: "Stable" },
          { k: t('home.snapshotGold'), v: "₹ — (api)" },
        ].map((x) => (
          <div key={x.k} className="rounded-[22px] border px-3 py-3 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.24)]" style={{ background: theme.surface2, borderColor: theme.border }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.muted }}>
              {x.k}
            </div>
            <div className="mt-1 text-sm font-extrabold" style={{ color: theme.text }}>
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

function SiteFooter({ theme, onToast, footerTextOverride, lang }: any) {
  const { t } = useI18n();

  const footerBg =
    theme.mode === "dark"
      ? "linear-gradient(180deg, rgba(10,14,35,0.95) 0%, rgba(7,10,24,0.98) 100%)"
      : "linear-gradient(180deg, rgba(10,14,35,0.92) 0%, rgba(7,10,24,0.98) 100%)";

  const businessLinks = [
    { label: t('footer.advertiseWithUs'), href: localizePath('/advertise-with-us', lang) },
    { label: t('footer.mediaKit'), href: localizePath('/media-kit', lang) },
    { label: 'Advertising Policy', href: localizePath('/advertising-policy', lang) },
    { label: t('footer.partnerships') },
    { label: t('footer.licensing') },
  ];

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
              {businessLinks.map((item) => (
                item.href ? (
                  <Link key={item.label} href={item.href} className="text-left hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <button key={item.label} type="button" onClick={() => onToast(`${item.label} (planned)`) } className="text-left hover:underline">
                    {item.label}
                  </button>
                )
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
  const { toggles: founderToggles } = usePublicFounderToggles();
  const SAFE_MODE = isSafeMode();
  const [prefs, setPrefs] = useState<any>(() => {
    const saved = readSavedStyleId();
    const valid = saved && THEMES.some((t) => t.id === saved);
    return normalizePrefs({ ...DEFAULT_PREFS, themeId: valid ? saved : DEFAULT_PREFS.themeId });
  });
  const theme = useMemo(() => getTheme(prefs.themeId), [prefs.themeId]);
  usePublicMode();

  const setThemeId = React.useCallback((themeId: string) => {
    const next = String(themeId || '').trim().toLowerCase();
    if (THEMES.some((t) => t.id === next)) writeSavedStyleId(next);
    setPrefs((p: any) => normalizePrefs({ ...p, themeId: next }));
  }, []);

  const getLocalizedBreakingHref = React.useCallback(
    (tab: 'breaking' | 'live'): string => {
      const raw = String(router.asPath || '/');
      const beforeHash = raw.split('#')[0] || '/';
      const pathPart = (beforeHash.split('?')[0] || '/').trim() || '/';
      const p = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
      const m = p.match(/^\/(en|hi|gu)(?=\/|$)/i);
      const prefix = m ? `/${String(m[1] || '').toLowerCase()}` : '';
      return `${prefix}/breaking?tab=${encodeURIComponent(tab)}`;
    },
    [router.asPath]
  );

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
  const [latestFromBackend, setLatestFromBackend] = useState<any[] | null>(null);
  const [latestRawStories, setLatestRawStories] = useState<Article[] | null>(null);
  const [topStory, setTopStory] = useState<Article | null>(null);
  const [homeSectionNews, setHomeSectionNews] = useState<Record<string, Article[]>>({});

  const apiLang = useMemo(() => {
    const code = toUiLangCode(lang);
    return (code === 'en' ? 'en' : code === 'hi' ? 'hi' : 'gu') as 'en' | 'hi' | 'gu';
  }, [lang]);

  const broadcastTickers = usePublicBroadcastTicker({
    lang: apiLang,
    enableSse: true,
    enabled: !SAFE_MODE,
  });

  const breakingTickerAds = usePublicTickerAds({
    lang: apiLang,
    channel: 'breaking',
    enabled: !SAFE_MODE,
    refreshIntervalMs: 15_000,
  });

  const liveTickerAds = usePublicTickerAds({
    lang: apiLang,
    channel: 'live',
    enabled: !SAFE_MODE,
    refreshIntervalMs: 15_000,
  });

  const [activeCatKey, setActiveCatKey] = useState<string>("breaking");
  const [toast, setToast] = useState<string>("");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);

  // Real data hooks
  const youth = useYouthPulse();

  // Keep preview prefs in sync with global language (source of truth for UI i18n)
  React.useEffect(() => {
    const code = toUiLangCode(lang);
    setPrefs((p: any) => ({ ...p, lang: UI_LANG_LABEL[code] }));
  }, [lang]);


  // Fetch homepage data (latest) from backend.
  React.useEffect(() => {
    const controller = new AbortController();

    setLatestFromBackend(null);
    setLatestRawStories(null);

    (async () => {
      // Latest news list (homepage)
      const latestResp = await fetchPublicNews({ language: apiLang, limit: 12, signal: controller.signal });
      if (controller.signal.aborted) return;
      const latestArticles = latestResp.items || [];
      setTopStory(latestArticles[0] || null);
      setLatestRawStories(Array.isArray(latestArticles) ? latestArticles : []);
      setLatestFromBackend(latestArticles.map((a) => articleToFeedItem(a as any, apiLang)));
      const breakingResp = await fetchPublicNews({ category: 'breaking', language: apiLang, limit: 10, signal: controller.signal });
      if (controller.signal.aborted) return;

      // Keep this fetch for other UI uses; tickers now come from broadcast hook.
      void breakingResp;
    })().catch(() => {
      if (controller.signal.aborted) return;
      setTopStory(null);
      setLatestRawStories([]);
      setLatestFromBackend([]);
    });

    return () => controller.abort();
  }, [apiLang]);

  React.useEffect(() => {
    const controller = new AbortController();

    setHomeSectionNews({});

    (async () => {
      const sectionEntries = await Promise.all(
        HOME_EDITORIAL_SECTIONS.map(async (section) => {
          const resp = await fetchPublicNews({
            category: section.key,
            language: apiLang,
            limit: HOME_SPOTLIGHT_SOURCE_LIMIT,
            extraQuery: { strictLocale: '1' },
            signal: controller.signal,
          });

          const items = Array.isArray(resp?.items) ? resp.items.slice().sort((left, right) => storyPublishedTimeValue(right) - storyPublishedTimeValue(left)) : [];

          return [section.key, items] as const;
        })
      );

      if (controller.signal.aborted) return;
      setHomeSectionNews(Object.fromEntries(sectionEntries));
    })().catch(() => {
      if (controller.signal.aborted) return;
      setHomeSectionNews({});
    });

    return () => controller.abort();
  }, [apiLang]);


  // Apply backend-controlled defaults (do not persist). Keep this one-shot.
  const appliedPublishedDefaultsRef = useRef(false);
  React.useEffect(() => {
    if (enablePublicSettingsDrawer) return;
    if (appliedPublishedDefaultsRef.current) return;
    if (!effectiveSettings || settingsError) return;

    // Never override an explicit user style choice (fixes Midnight flip on Back).
    const saved = readSavedStyleId();
    if (saved && THEMES.some((t) => t.id === saved)) {
      appliedPublishedDefaultsRef.current = true;
      return;
    }

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
  const breakingTickerVisible = !SAFE_MODE && breakingTickerEnabled && (broadcastTickers.breakingEnabled ?? true);
  const liveTickerVisible = !SAFE_MODE && liveTickerEnabled && (broadcastTickers.liveEnabled ?? true);

  const breakingDurationSec = clampNum(broadcastTickers.breakingSpeedSec ?? effectiveSettings.tickers.breaking.speedSec, 10, 300, 18);
  const liveDurationSec = clampNum(broadcastTickers.liveSpeedSec ?? effectiveSettings.tickers.live.speedSec, 10, 300, 24);

  const breakingItems = broadcastTickers.breakingTexts;
  const showBreakingContent = breakingItems.length > 0;
  const breakingItemsToShow = useMemo(
    () => mergeTickerItemsWithAds(showBreakingContent ? breakingItems.slice(0, 12) : [], breakingTickerAds.ads, 'breaking'),
    [breakingItems, breakingTickerAds.ads, showBreakingContent]
  );

  const liveItemsToShow = useMemo(
    () => mergeTickerItemsWithAds(broadcastTickers.liveTexts.length > 0 ? broadcastTickers.liveTexts.slice(0, 15) : [], liveTickerAds.ads, 'live'),
    [broadcastTickers.liveTexts, liveTickerAds.ads]
  );

  const onToast = (m: string) => setToast(m);

  const liveTvEnabled = effectiveSettings.liveTv.enabled === true;
  const liveTvEmbedUrl = effectiveSettings.liveTv.embedUrl;
  const inspirationHomepageDroneTvEmbedUrl = resolveInspirationHubDroneTvEmbedUrl(effectiveSettings, 'homepage');

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
          founderToggles={founderToggles}
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
              router.push(getLocalizedBreakingHref('breaking'));
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
              router.push(getLocalizedBreakingHref('live'));
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

  const localizedYouthPulseHref = localizePath('/youth-pulse', apiLang);

  const youthPulseTrendingBlock = !youth.loading && youth.trending.length === 0 ? null : (
    <div className="overflow-hidden rounded-[28px] border shadow-[0_18px_42px_-34px_rgba(15,23,42,0.30)]" style={{ background: theme.surface2, borderColor: theme.border }}>
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-4"
        style={{
          borderColor: theme.border,
          background: theme.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(79,70,229,0.16), rgba(56,189,248,0.08) 70%, transparent 100%)'
            : 'linear-gradient(135deg, rgba(79,70,229,0.10), rgba(37,99,235,0.05) 70%, rgba(255,255,255,0.72) 100%)',
        }}
      >
        <div className="min-w-0">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>Youth desk</div>
          <div className="mt-1 text-sm font-black tracking-tight" style={{ color: theme.text }}>{t('home.youthPulseTrending')}</div>
        </div>
        <a href={localizedYouthPulseHref} className="shrink-0 whitespace-nowrap text-xs font-semibold" style={{ color: theme.accent2 }}>{t('common.viewAll')} →</a>
      </div>
      <div className="grid gap-3 p-4">
        {(youth.trending.slice(0, 6)).map((y: any) => (
          <a key={String(y.id)} href={localizedYouthPulseHref} className="rounded-[22px] border px-3 py-3 text-sm shadow-[0_14px_28px_-26px_rgba(15,23,42,0.24)] hover:opacity-95" style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}>
            {y.title}
          </a>
        ))}
        {youth.loading && !youth.trending.length ? (
          <div className="rounded-[22px] border px-3 py-7 animate-pulse" style={{ background: theme.surface, borderColor: theme.border }} />
        ) : null}
      </div>
    </div>
  );

  const homepageFeatureSelection = React.useMemo(
    () => resolveHomepageFeatureSelection({
      latestRawStories,
      homeSectionNews,
      requestedLang: apiLang,
      fallbackArticle: topStory,
    }),
    [apiLang, homeSectionNews, latestRawStories, topStory]
  );

  const homepageFeatureArticle = homepageFeatureSelection.article;

  const centerFeedItems = React.useMemo(() => {
    if (!Array.isArray(latestFromBackend)) return latestFromBackend;

    const topIdentifiers = new Set(
      [
        safeTitle((homepageFeatureArticle as any)?._id || (homepageFeatureArticle as any)?.id),
        resolveArticleSlug(homepageFeatureArticle as any, apiLang),
        safeTitle((homepageFeatureArticle as any)?.slug),
      ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const seen = new Set<string>();
    const withImage: any[] = [];
    const withoutImage: any[] = [];

    for (const item of latestFromBackend) {
      const id = String(item?.id || '').trim().toLowerCase();
      const slug = String(item?.slug || '').trim().toLowerCase();
      const identity = id || slug || String(item?.title || '').trim().toLowerCase();

      if (!identity || seen.has(identity)) continue;
      if ((id && topIdentifiers.has(id)) || (slug && topIdentifiers.has(slug))) continue;

      seen.add(identity);
      if (String(item?.imageSrc || '').trim()) {
        withImage.push(item);
      } else {
        withoutImage.push(item);
      }
    }

    return [...withImage, ...withoutImage].slice(0, 6);
  }, [apiLang, homepageFeatureArticle, latestFromBackend]);

  const centerFeedIdentitySet = React.useMemo(() => {
    const values = Array.isArray(centerFeedItems) ? centerFeedItems : [];
    return new Set(
      values
        .flatMap((item: any) => [String(item?.id || '').trim().toLowerCase(), String(item?.slug || '').trim().toLowerCase()])
        .filter(Boolean)
    );
  }, [centerFeedItems]);

  const moreReadItems = React.useMemo(() => {
    if (!Array.isArray(latestFromBackend)) return latestFromBackend;

    const topIdentifiers = new Set(
      [
        safeTitle((homepageFeatureArticle as any)?._id || (homepageFeatureArticle as any)?.id),
        resolveArticleSlug(homepageFeatureArticle as any, apiLang),
        safeTitle((homepageFeatureArticle as any)?.slug),
      ]
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const withImage: any[] = [];
    const withoutImage: any[] = [];
    const seen = new Set<string>();

    for (const item of latestFromBackend) {
      const id = String(item?.id || '').trim().toLowerCase();
      const slug = String(item?.slug || '').trim().toLowerCase();
      const identity = id || slug || String(item?.title || '').trim().toLowerCase();

      if (!identity || seen.has(identity)) continue;
      if ((id && topIdentifiers.has(id)) || (slug && topIdentifiers.has(slug))) continue;
      if ((id && centerFeedIdentitySet.has(id)) || (slug && centerFeedIdentitySet.has(slug))) continue;

      seen.add(identity);
      if (String(item?.imageSrc || '').trim()) {
        withImage.push(item);
      } else {
        withoutImage.push(item);
      }
    }

    return [...withImage, ...withoutImage].slice(0, 3);
  }, [apiLang, centerFeedIdentitySet, homepageFeatureArticle, latestFromBackend]);

  const homepageLeadIdentitySet = React.useMemo(() => {
    const values = new Set<string>();

    const collect = (item: any) => {
      [
        String(item?._id || item?.id || '').trim().toLowerCase(),
        String(item?.slug || '').trim().toLowerCase(),
      ]
        .filter(Boolean)
        .forEach((value) => values.add(value));
    };

    collect(homepageFeatureArticle);
    if (Array.isArray(centerFeedItems)) centerFeedItems.forEach(collect);
    if (Array.isArray(moreReadItems)) moreReadItems.forEach(collect);

    return values;
  }, [centerFeedItems, homepageFeatureArticle, moreReadItems]);

  const spotlightExcludedIdentitySet = React.useMemo(() => {
    const values = new Set<string>();

    [
      String((homepageFeatureArticle as any)?._id || (homepageFeatureArticle as any)?.id || '').trim().toLowerCase(),
      String(resolveArticleSlug(homepageFeatureArticle as any, apiLang) || '').trim().toLowerCase(),
      String((homepageFeatureArticle as any)?.slug || '').trim().toLowerCase(),
    ]
      .filter(Boolean)
      .forEach((value) => values.add(value));

    return values;
  }, [apiLang, homepageFeatureArticle]);

  const editorialSections = React.useMemo(() => {
    return HOME_EDITORIAL_SECTIONS.map((section) => {
      const rawItems = Array.isArray(homeSectionNews[section.key]) ? homeSectionNews[section.key] : [];
      const seen = new Set<string>();
      const items: any[] = [];

      for (const article of rawItems) {
        const feedItem = articleToFeedItem(article as any, apiLang);
        const identifiers = [
          String((article as any)?._id || (article as any)?.id || feedItem?.id || '').trim().toLowerCase(),
          String((article as any)?.slug || feedItem?.slug || '').trim().toLowerCase(),
        ].filter(Boolean);

        if (identifiers.some((value) => homepageLeadIdentitySet.has(value))) continue;

        const identity = identifiers[0] || identifiers[1] || String(feedItem?.title || '').trim().toLowerCase();
        if (!identity || seen.has(identity)) continue;

        seen.add(identity);
        items.push(feedItem);

        if (items.length >= 5) break;
      }

      return {
        ...section,
        title: t(labelKeyForCategory(section.key)),
        items,
      };
    }).filter((section) => section.items.length > 0);
  }, [apiLang, homeSectionNews, homepageLeadIdentitySet, t]);

  const spotlightItems = React.useMemo(() => {
    const seen = new Set<string>();

    const toIdentity = (item: any) => {
      const identifiers = [
        String(item?._id || item?.id || '').trim().toLowerCase(),
        String(item?.slug || '').trim().toLowerCase(),
      ].filter(Boolean);

      return identifiers[0] || identifiers[1] || String(item?.title || '').trim().toLowerCase();
    };

    const buildFeedItem = (article: any) => articleToFeedItem(article as any, apiLang);

    const rawHomepageStories = [
      ...(Array.isArray(latestRawStories) ? latestRawStories : []),
      ...HOME_EDITORIAL_SECTIONS.flatMap((section) => Array.isArray(homeSectionNews[section.key]) ? homeSectionNews[section.key] : []),
    ];

    const rawStoryCandidates = rawHomepageStories
      .map((article) => {
        const feedItem = buildFeedItem(article);
        const identity = toIdentity({
          _id: (article as any)?._id || (article as any)?.id || feedItem?.id,
          slug: (article as any)?.slug || feedItem?.slug,
          title: feedItem?.title,
        });

        if (!identity || seen.has(identity)) return null;
        if (spotlightExcludedIdentitySet.has(identity)) return null;

        const sortTime = storyPublishedTimeValue(article);
        if (!sortTime) return null;

        seen.add(identity);

        return {
          identity,
          sortTime,
          categoryKey: normalizeCategoryKey((article as any)?.category || feedItem?.category),
          qualityScore:
            (String(feedItem?.imageSrc || '').trim().length > 0 ? 2 : 0) +
            (String(feedItem?.desc || '').trim().length >= 30 ? 1 : 0),
          item: feedItem,
        };
      })
      .filter(Boolean) as Array<{
        identity: string;
        sortTime: number;
        categoryKey: string;
        qualityScore: number;
        item: any;
      }>;

    const sortedCandidates = rawStoryCandidates.sort((left, right) => {
        if (left.sortTime !== right.sortTime) return right.sortTime - left.sortTime;
        if (left.qualityScore !== right.qualityScore) return right.qualityScore - left.qualityScore;
        return left.identity.localeCompare(right.identity);
      });

    const primaryCandidates = sortedCandidates.filter((candidate) =>
      HOME_SPOTLIGHT_PRIMARY_SECTION_KEYS.includes(candidate.categoryKey as (typeof HOME_SPOTLIGHT_PRIMARY_SECTION_KEYS)[number])
    );

    const glamourCandidates = sortedCandidates.filter((candidate) =>
      HOME_SPOTLIGHT_FALLBACK_SECTION_KEYS.includes(candidate.categoryKey as (typeof HOME_SPOTLIGHT_FALLBACK_SECTION_KEYS)[number])
    );

    const filled: typeof rawStoryCandidates = [];
    const categoryCounts = new Map<string, number>();

    for (let pass = 1; pass <= HOME_SPOTLIGHT_MAX_PER_CATEGORY; pass += 1) {
      for (const candidate of primaryCandidates) {
        if (filled.length >= HOME_SPOTLIGHT_MAX_ITEMS) break;

        const currentCount = categoryCounts.get(candidate.categoryKey) || 0;
        if (currentCount >= pass) continue;

        filled.push(candidate);
        categoryCounts.set(candidate.categoryKey, currentCount + 1);
      }

      if (filled.length >= HOME_SPOTLIGHT_MAX_ITEMS) break;
    }

    for (const candidate of glamourCandidates) {
      if (filled.length >= HOME_SPOTLIGHT_MAX_ITEMS) break;

      const currentCount = categoryCounts.get(candidate.categoryKey) || 0;
      if (currentCount >= HOME_SPOTLIGHT_MAX_GLAMOUR_ITEMS) continue;

      filled.push(candidate);
      categoryCounts.set(candidate.categoryKey, currentCount + 1);
    }

    return filled.slice(0, HOME_SPOTLIGHT_MAX_ITEMS).map((candidate) => candidate.item);
  }, [apiLang, homeSectionNews, latestRawStories, spotlightExcludedIdentitySet]);

  const renderedEditorialSections = React.useMemo(
    () => editorialSections.filter((section) => !HOME_SPOTLIGHT_RENDER_FILTER_KEYS.includes(section.key as (typeof HOME_SPOTLIGHT_RENDER_FILTER_KEYS)[number])),
    [editorialSections]
  );

  const heroLeftBlocks = sidebarBlocks.filter((b) => b.key === 'explore');
  const utilityLeftBlocks = sidebarBlocks.filter((b) => b.key !== 'explore');
  const showUtilityRow = utilityLeftBlocks.length > 0 || moreReadItems == null || (Array.isArray(moreReadItems) && moreReadItems.length > 0) || youthPulseTrendingBlock != null;
  const heroCenterColClass = heroLeftBlocks.length > 0 ? 'lg:col-span-6' : 'lg:col-span-9';
  const utilityCenterColClass = utilityLeftBlocks.length > 0 ? 'lg:col-span-6' : 'lg:col-span-9';
  const utilityFeatureCardItem = React.useMemo(
    () => ({
      article: homepageFeatureArticle,
      requestedLang: apiLang,
      featureLabel: homepageFeatureSelection.label,
      featureDotColor: homepageFeatureSelection.dotColor,
    }),
    [apiLang, homepageFeatureArticle, homepageFeatureSelection.dotColor, homepageFeatureSelection.label]
  );
  const utilityCenterNode = showUtilityRow ? (
    <FeaturedCard
      theme={theme}
      item={utilityFeatureCardItem}
      onToast={onToast}
      isLoading={latestFromBackend == null && !homepageFeatureArticle}
    />
  ) : null;

  const hasSnapshotsBlock = sidebarBlocks.some((b) => b.key === 'snapshots');

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
      node: <SiteFooter theme={theme} onToast={onToast} footerTextOverride={undefined} lang={apiLang} />,
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
            founderToggles={founderToggles}
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
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
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
                    const currentLocale = String(router.locale || router.defaultLocale || 'en').toLowerCase();
                    const currentPath = String(router.asPath || '/').split('?')[0] || '/';
                    const targetPath = next === 'en' ? '/' : `/${next}`;

                    // Guard: if already on desired locale/path, don't re-navigate.
                    if (currentLocale === next && currentPath === targetPath) {
                      setLang(next as any, { persist: true });
                      setPrefs((p: any) => ({ ...p, lang: UI_LANG_LABEL[nextCode] }));
                      return;
                    }

                    // Persist preference, but route locale remains the single source of truth.
                    setLang(next as any, { persist: true });

                    // Requirement: on dropdown change, route to /, /hi, /gu.
                    router.replace(targetPath, targetPath, { locale: next, shallow: false, scroll: false }).catch(() => {});
                  }
                  setPrefs((p: any) => ({ ...p, lang: UI_LANG_LABEL[nextCode] }));
                }}
              />
              <ThemePicker theme={theme} themeId={prefs.themeId} setThemeId={setThemeId} />

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
        variant="homeBanner"
        className="mx-auto mt-3 mb-4"
      />

      <AdSlot
        slot="HOME_BILLBOARD_970x250"
        variant="billboard970x250"
        className="mx-auto mt-2 mb-8"
      />

      {/* TRENDING (below top advertisement) */}
      {showTrendingStrip ? (
        <TrendingStrip theme={theme} onPick={(t: string) => onToast(`Trending: ${t}`)} />
      ) : null}

      {/* HERO ROW */}
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 pb-10 pt-4">
        <div
          className="relative overflow-hidden rounded-[34px] border p-3 shadow-[0_40px_100px_-82px_rgba(15,23,42,0.46)] sm:p-4 lg:p-5"
          style={{ background: theme.surface2, borderColor: theme.border }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: theme.mode === 'dark'
                ? 'radial-gradient(circle at top left, rgba(56,189,248,0.10), transparent 34%), radial-gradient(circle at 82% 16%, rgba(167,139,250,0.10), transparent 32%), radial-gradient(circle at 52% 100%, rgba(16,185,129,0.08), transparent 34%)'
                : 'radial-gradient(circle at top left, rgba(37,99,235,0.08), transparent 34%), radial-gradient(circle at 82% 16%, rgba(124,58,237,0.07), transparent 32%), radial-gradient(circle at 52% 100%, rgba(16,185,129,0.06), transparent 34%)',
            }}
          />

          <div className="relative grid gap-6">
            <div className="grid grid-cols-12 items-start gap-6 lg:gap-8">
              {heroLeftBlocks.length ? (
                <aside className="col-span-12 order-3 lg:order-1 lg:col-span-3">
                  <div className="sticky top-4 grid gap-4">
                    {heroLeftBlocks.map((b) => (
                      <React.Fragment key={b.key}>
                        {b.node}
                      </React.Fragment>
                    ))}
                  </div>
                </aside>
              ) : null}

              <main className={`col-span-12 order-1 lg:order-2 ${heroCenterColClass}`}>
                <div className="grid gap-4">
                  <FeaturedCard
                    theme={theme}
                    item={{
                      article: homepageFeatureArticle,
                      requestedLang: apiLang,
                      featureLabel: homepageFeatureSelection.label,
                      featureDotColor: homepageFeatureSelection.dotColor,
                    }}
                    onToast={onToast}
                    isLoading={latestFromBackend == null}
                  />
                  <CenterStoryFeed theme={theme} items={centerFeedItems} lang={apiLang} />
                </div>
              </main>

              <aside className="col-span-12 order-2 self-start lg:order-3 lg:col-span-3">
                <div className="sticky top-4 grid gap-4">
                  <AdSlot slot="HOME_RIGHT_300x250" variant="right300" />

                  <FeedList
                    theme={theme}
                    title={t('home.latest')}
                    items={latestFromBackend}
                    lang={apiLang}
                  />
                </div>
              </aside>
            </div>

            {showUtilityRow ? (
              <div className="grid grid-cols-12 gap-6 lg:gap-8">
                {utilityLeftBlocks.length ? (
                  <aside className="col-span-12 order-2 lg:order-1 lg:col-span-3">
                    <div className="grid gap-4">
                      {utilityLeftBlocks.map((b) => (
                        <React.Fragment key={b.key}>
                          {b.node}
                        </React.Fragment>
                      ))}
                    </div>
                  </aside>
                ) : null}

                {utilityCenterNode ? (
                  <main className={`col-span-12 order-1 lg:order-2 ${utilityCenterColClass}`}>
                    {utilityCenterNode}
                  </main>
                ) : null}

                <aside className="col-span-12 order-3 lg:order-3 lg:col-span-3">
                  <div className="grid gap-4">
                    <AdSlot slot="HOME_RIGHT_300x600" variant="right300x600" className="hidden lg:block" />
                    {youthPulseTrendingBlock}
                  </div>
                </aside>
              </div>
            ) : null}
          </div>
        </div>

        {renderedEditorialSections.length ? (
          <div className="mt-8 grid gap-6 lg:gap-7">
            {renderedEditorialSections.map((section) => (
              <HomeEditorialSection
                key={section.key}
                theme={theme}
                title={section.title}
                href={section.route}
                items={section.items}
                lang={apiLang}
                Icon={section.Icon}
              />
            ))}
          </div>
        ) : null}

        {spotlightItems.length ? (
          <div className="mt-8">
            <HomeSpotlightCarousel
              theme={theme}
              title="News Pulse Spotlight"
              href="/latest"
              items={spotlightItems}
              lang={apiLang}
              Icon={Sparkles}
            />
          </div>
        ) : null}

        <div className="mt-8">
          <InspirationHubHomepageSection
            theme={theme}
            href={localizePath('/inspiration-hub', apiLang)}
            droneVideoEmbedUrl={inspirationHomepageDroneTvEmbedUrl}
          />
        </div>
      </div>

      {/* APP PROMO + FOOTER */}
      {bottomBlocks.map((b) => (
        <React.Fragment key={b.key}>
          {b.key === 'footer' ? (
            <>
              <AdSlot
                slot="FOOTER_BANNER_728x90"
                variant="homeBanner"
                className="mx-auto w-full max-w-[1440px] px-4 md:px-8 my-2"
              />
              {b.node}
            </>
          ) : (
            b.node
          )}
        </React.Fragment>
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
            {getVisibleCats(founderToggles).map((c: any) => {
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

      <Toast theme={theme} message={toast} onDone={() => setToast("")} />
    </div>
  );
}
