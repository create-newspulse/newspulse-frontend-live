"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRegionalPulse } from "../src/features/regional/useRegionalPulse";
import { useYouthPulse } from "../features/youthPulse/useYouthPulse";
import { usePublicMode } from "../utils/PublicModeProvider";
import type { GetStaticProps } from "next";
import { AnimatePresence, motion } from "framer-motion";
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
  LogIn,
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
const PREF_KEY = "newspulse.ui.v14_5_3.prefs";

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
  { key: "science", label: "Science & Technology", Icon: Cpu },
  { key: "sports", label: "Sports", Icon: Trophy },
  { key: "lifestyle", label: "Lifestyle", Icon: Leaf },
  { key: "glamour", label: "Glamour", Icon: Sparkles },
  { key: "webstories", label: "Web Stories", Icon: BookOpen },
  { key: "viral", label: "Viral Videos", Icon: Video },
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
  youth: "/youth-pulse",
  community: "/community-reporter",
  editorial: "/editorial",
  inspiration: "/inspiration-hub",
};

const CATEGORY_THEME: Record<string, { base: string; hover: string; ring: string; active: string; dot: string }> = {
  breaking: {
    base: "bg-red-50 border-red-200 text-red-700",
    hover: "hover:bg-red-100",
    ring: "focus-visible:ring-2 focus-visible:ring-red-300/50",
    active: "bg-red-100 ring-2 ring-red-300/50",
    dot: "bg-red-500/80",
  },
  regional: {
    base: "bg-emerald-50 border-emerald-200 text-emerald-700",
    hover: "hover:bg-emerald-100",
    ring: "focus-visible:ring-2 focus-visible:ring-emerald-300/50",
    active: "bg-emerald-100 ring-2 ring-emerald-300/50",
    dot: "bg-emerald-500/80",
  },
  national: {
    base: "bg-amber-50 border-amber-200 text-amber-700",
    hover: "hover:bg-amber-100",
    ring: "focus-visible:ring-2 focus-visible:ring-amber-300/50",
    active: "bg-amber-100 ring-2 ring-amber-300/50",
    dot: "bg-amber-500/80",
  },
  international: {
    base: "bg-blue-50 border-blue-200 text-blue-700",
    hover: "hover:bg-blue-100",
    ring: "focus-visible:ring-2 focus-visible:ring-blue-300/50",
    active: "bg-blue-100 ring-2 ring-blue-300/50",
    dot: "bg-blue-500/80",
  },
  business: {
    base: "bg-indigo-50 border-indigo-200 text-indigo-700",
    hover: "hover:bg-indigo-100",
    ring: "focus-visible:ring-2 focus-visible:ring-indigo-300/50",
    active: "bg-indigo-100 ring-2 ring-indigo-300/50",
    dot: "bg-indigo-500/80",
  },
  science: {
    base: "bg-violet-50 border-violet-200 text-violet-700",
    hover: "hover:bg-violet-100",
    ring: "focus-visible:ring-2 focus-visible:ring-violet-300/50",
    active: "bg-violet-100 ring-2 ring-violet-300/50",
    dot: "bg-violet-500/80",
  },
  sports: {
    base: "bg-cyan-50 border-cyan-200 text-cyan-700",
    hover: "hover:bg-cyan-100",
    ring: "focus-visible:ring-2 focus-visible:ring-cyan-300/50",
    active: "bg-cyan-100 ring-2 ring-cyan-300/50",
    dot: "bg-cyan-500/80",
  },
  lifestyle: {
    base: "bg-rose-50 border-rose-200 text-rose-700",
    hover: "hover:bg-rose-100",
    ring: "focus-visible:ring-2 focus-visible:ring-rose-300/50",
    active: "bg-rose-100 ring-2 ring-rose-300/50",
    dot: "bg-rose-500/80",
  },
  glamour: {
    base: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700",
    hover: "hover:bg-fuchsia-100",
    ring: "focus-visible:ring-2 focus-visible:ring-fuchsia-300/50",
    active: "bg-fuchsia-100 ring-2 ring-fuchsia-300/50",
    dot: "bg-fuchsia-500/80",
  },
  webstories: {
    base: "bg-yellow-50 border-yellow-200 text-yellow-700",
    hover: "hover:bg-yellow-100",
    ring: "focus-visible:ring-2 focus-visible:ring-yellow-300/50",
    active: "bg-yellow-100 ring-2 ring-yellow-300/50",
    dot: "bg-yellow-500/80",
  },
  viral: {
    base: "bg-lime-50 border-lime-200 text-lime-700",
    hover: "hover:bg-lime-100",
    ring: "focus-visible:ring-2 focus-visible:ring-lime-300/50",
    active: "bg-lime-100 ring-2 ring-lime-300/50",
    dot: "bg-lime-500/80",
  },
  editorial: {
    base: "bg-slate-50 border-slate-200 text-slate-700",
    hover: "hover:bg-slate-100",
    ring: "focus-visible:ring-2 focus-visible:ring-slate-300/50",
    active: "bg-slate-100 ring-2 ring-slate-300/50",
    dot: "bg-slate-500/80",
  },
  youth: {
    base: "bg-sky-50 border-sky-200 text-sky-700",
    hover: "hover:bg-sky-100",
    ring: "focus-visible:ring-2 focus-visible:ring-sky-300/50",
    active: "bg-sky-100 ring-2 ring-sky-300/50",
    dot: "bg-sky-500/80",
  },
  inspiration: {
    base: "bg-teal-50 border-teal-200 text-teal-700",
    hover: "hover:bg-teal-100",
    ring: "focus-visible:ring-2 focus-visible:ring-teal-300/50",
    active: "bg-teal-100 ring-2 ring-teal-300/50",
    dot: "bg-teal-500/80",
  },
  community: {
    base: "bg-orange-50 border-orange-200 text-orange-700",
    hover: "hover:bg-orange-100",
    ring: "focus-visible:ring-2 focus-visible:ring-orange-300/50",
    active: "bg-orange-100 ring-2 ring-orange-300/50",
    dot: "bg-orange-500/80",
  },
  __default: {
    base: "bg-slate-50 border-slate-200 text-slate-700",
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

const LIVE_UPDATES: string[] = [
  "Preview edition is live — thank you for testing",
  "AI-Verified badges will appear on verified stories",
  "New categories and story panels are rolling out",
];

const TRENDING: string[] = [
  "Breaking",
  "Sports",
  "Gold rates",
  "Fuel Prices",
  "Weather",
  "Gujarat",
  "Markets",
  "Tech & AI",
  "Education",
];

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

  breakingMode: "auto" as "auto" | "on" | "off",
  liveTickerOn: true,
  liveTvOn: true,
  liveTvEmbedUrl: "",
  showPreviewNotice: true,
  showBreakingWhenEmpty: true,
  liveSpeedSec: 24,
  breakingSpeedSec: 18,

  // module toggles (UI only)
  showCategoryStrip: true,
  showTrendingStrip: true,
  showExploreCategories: true,
  showLiveTvCard: true,
  showQuickTools: true,
  showSnapshots: true,
  showAppPromo: true,
  showFooter: true,
};

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
  if (!["auto", "on", "off"].includes(p.breakingMode)) p.breakingMode = DEFAULT_PREFS.breakingMode;

  p.liveTickerOn = !!p.liveTickerOn;
  p.liveTvOn = !!p.liveTvOn;
  p.showPreviewNotice = !!p.showPreviewNotice;
  p.showBreakingWhenEmpty = !!p.showBreakingWhenEmpty;
  p.liveTvEmbedUrl = typeof p.liveTvEmbedUrl === "string" ? p.liveTvEmbedUrl : "";

  p.liveSpeedSec = clampNum(p.liveSpeedSec, 10, 60, DEFAULT_PREFS.liveSpeedSec);
  p.breakingSpeedSec = clampNum(p.breakingSpeedSec, 10, 60, DEFAULT_PREFS.breakingSpeedSec);

  p.showCategoryStrip = !!p.showCategoryStrip;
  p.showTrendingStrip = !!p.showTrendingStrip;
  p.showExploreCategories = !!p.showExploreCategories;
  p.showLiveTvCard = !!p.showLiveTvCard;
  p.showQuickTools = !!p.showQuickTools;
  p.showSnapshots = !!p.showSnapshots;
  p.showAppPromo = !!p.showAppPromo;
  p.showFooter = !!p.showFooter;

  // Remove deprecated category direction from persisted prefs
  if ((p as any).catFlow !== undefined) delete (p as any).catFlow;

  return p;
}

function getBreakingItems(prefs: any) {
  if (prefs.breakingMode === "off") return [];
  if (prefs.breakingMode === "on") return BREAKING_DEMO;
  return BREAKING_FROM_BACKEND;
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
  useEffect(() => {
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

function ToggleRow({ theme, title, sub, value, onToggle }: any) {
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
        onClick={onToggle}
        className="relative h-7 w-12 rounded-full border transition"
        style={{ background: value ? theme.accent : theme.chip, borderColor: theme.border }}
        aria-label={`Toggle ${title}`}
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
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
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
        <span className="hidden md:inline">Style</span>
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

function LanguagePicker({ theme, value, onChange }: any) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: any) => {
      const el = wrapRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const options = ["English", "Hindi", "Gujarati"];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border"
        style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
      >
        <span className="hidden md:inline">Language</span>
        <span className="font-extrabold">{value}</span>
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
                const active = o === value;
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      onChange(o);
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
                    <span>{o}</span>
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

function TickerBar({ theme, kind, items, onViewAll, speedSec }: any) {
  const label = kind === "breaking" ? "BREAKING NEWS" : "LIVE UPDATES";

  const safeItems =
    kind === "live"
      ? items?.length
        ? items
        : ["No updates right now — stay tuned"]
      : items?.length
        ? items
        : ["No breaking news right now — stay tuned"];

  const text = (safeItems?.length ? safeItems : [""]).join("  •  ");

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
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold text-white border"
                style={{ borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.10)" }}
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
                <div className="np-tickerTrack" style={{ animationDuration: `${speedSec || 24}s` }}>
                  <div className="np-tickerSeq whitespace-nowrap text-sm font-semibold text-white">
                    <span className="pr-10">{text}</span>
                  </div>
                  <div className="np-tickerSeq whitespace-nowrap text-sm font-semibold text-white">
                    <span className="pr-10">{text}</span>
                  </div>
                </div>
              </div>

              <button type="button" onClick={onViewAll} className="text-xs font-semibold text-white/95 hover:underline flex-none relative z-10">
                View all
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendingStrip({ theme, onPick }: any) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
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
              <Flame className="h-4 w-4" style={{ color: theme.live }} /> Trending
            </span>

            <div className="np-no-scrollbar w-full overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="inline-flex items-center gap-2 pr-4">
                {TRENDING.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onPick(t)}
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold border"
                    style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
                  >
                    {t}
                  </button>
                ))}
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
  const cats = useMemo(() => [...CATEGORIES], []);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ down: false, startX: 0, startLeft: 0, moved: false, blockUntil: 0 });

  useEffect(() => {
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

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
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
                const t = CATEGORY_THEME[c.key] || CATEGORY_THEME.__default;
                const href = CATEGORY_ROUTES[c.key as string];
                const content = (
                  <div
                    className={cx(
                      "inline-flex items-center gap-2 whitespace-nowrap h-9 rounded-full border shadow-[0_1px_0_rgba(0,0,0,0.04)] px-3 text-xs font-semibold transition-all duration-200 focus-visible:outline-none",
                      t.base,
                      t.hover,
                      t.ring,
                      active && t.active
                    )}
                  >
                    <c.Icon className="h-4 w-4" />
                    {c.label}
                    {active ? <span className={cx("ml-1.5 inline-block h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden="true" /> : null}
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
  const cats = useMemo(() => getCats(), []);

  return (
    <Surface theme={theme} className="p-4">
      <div className="text-sm font-extrabold" style={{ color: theme.text }}>
        Explore Categories
      </div>
      <div className="mt-1 text-xs" style={{ color: theme.sub }}>
        Tap to filter
      </div>

      <div className="mt-4 grid gap-3">
        {cats.map((c: any) => {
          const active = c.key === activeKey;
          const href = CATEGORY_ROUTES[c.key as string];
          const content = (
            <div
              className={cx(
                "flex items-center gap-3 rounded-3xl border px-4 py-4 text-left transition hover:opacity-[0.98]"
              )}
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
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border"
                style={{ background: theme.chip, borderColor: theme.border }}
              >
                <c.Icon className="h-5 w-5" />
              </span>

              <span className="flex-1 min-w-0">
                <span className="block text-sm font-extrabold truncate">{c.label}</span>
                {c.badge ? (
                  <span
                    className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold border"
                    style={{
                      background: theme.mode === "dark" ? "rgba(56,189,248,0.12)" : "rgba(37,99,235,0.10)",
                      borderColor: theme.mode === "dark" ? "rgba(56,189,248,0.30)" : "rgba(37,99,235,0.22)",
                      color: theme.text,
                    }}
                  >
                    {c.badge}
                  </span>
                ) : null}
              </span>

              <ArrowRight
                className="h-4 w-4"
                style={{
                  color: theme.muted,
                }}
              />
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

function TopBanner({ theme }: any) {
  return (
    <Surface theme={theme} className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold" style={{ color: theme.text }}>
              Spotlight
            </div>
            <div className="text-xs" style={{ color: theme.sub }}>
              Space for a featured promo / sponsor banner (optional)
            </div>
          </div>
          <span className="rounded-full px-3 py-1 text-xs font-semibold border" style={{ background: theme.chip, borderColor: theme.border, color: theme.text }}>
            728×90
          </span>
        </div>

        <div
          className="mt-4 rounded-3xl border"
          style={{
            borderColor: theme.border,
            background:
              theme.mode === "dark"
                ? "linear-gradient(135deg, rgba(56,189,248,0.15), rgba(167,139,250,0.10))"
                : "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.10))",
          }}
        >
          <div className="flex h-[110px] items-center justify-center text-xs font-semibold" style={{ color: theme.sub }}>
            Banner / Promo Slot (no e-paper)
          </div>
        </div>
      </div>
    </Surface>
  );
}

function FeaturedCard({ theme, item, onToast }: any) {
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

        <div className="mt-3 text-xl sm:text-2xl font-black tracking-tight" style={{ color: theme.text }}>
          {item.title}
        </div>
        <div className="mt-1 text-sm" style={{ color: theme.sub }}>
          {item.desc}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button theme={theme} variant="solid" onClick={() => onToast("Open featured story (planned)")}>
            Read <ArrowRight className="h-4 w-4" />
          </Button>
          <Button theme={theme} variant="soft" onClick={() => onToast("Watch / Listen (planned)")}>
            <Play className="h-4 w-4" /> Watch
          </Button>
        </div>
      </div>
    </Surface>
  );
}

function FeedList({ theme, title, items, onOpen }: any) {
  return (
    <Surface theme={theme} className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold" style={{ color: theme.text }}>
            {title}
          </div>
          <div className="text-xs" style={{ color: theme.sub }}>
            Fresh updates
          </div>
        </div>
        <Button theme={theme} variant="soft" onClick={() => onOpen("viewall")}>
          View all
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
            <div className="mt-2 text-base font-extrabold" style={{ color: theme.text }}>
              {f.title}
            </div>
            <div className="mt-1 text-sm" style={{ color: theme.sub }}>
              {f.desc}
            </div>
          </button>
        ))}
      </div>
    </Surface>
  );
}

function LiveTVWidget({ theme, prefs, setPrefs, onToast }: any) {
  if (!prefs.liveTvOn) return null;

  const hasUrl = !!prefs.liveTvEmbedUrl?.trim();

  return (
    <Surface theme={theme} className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-extrabold" style={{ color: theme.text }}>
            Live TV
          </div>
          <div className="text-xs" style={{ color: theme.sub }}>
            Partner channel (toggle from Admin later)
          </div>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-extrabold border text-white" style={{ background: theme.live, borderColor: "rgba(255,255,255,0.18)" }}>
          LIVE
        </span>
      </div>

      <div className="mt-3 rounded-3xl border overflow-hidden" style={{ borderColor: theme.border, background: theme.surface2 }}>
        <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
          {hasUrl ? (
            <iframe
              title="News Pulse Live TV"
              src={prefs.liveTvEmbedUrl}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold" style={{ color: theme.sub }}>
              Add Live TV embed URL in Settings (demo)
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <Button theme={theme} variant="soft" className="w-full justify-start" onClick={() => onToast("Live TV full page (planned)")}>
          <Play className="h-4 w-4" /> Open Live TV
        </Button>
        <Button theme={theme} variant="ghost" className="w-full justify-start" onClick={() => setPrefs((p: any) => ({ ...p, liveTvOn: false }))}>
          <X className="h-4 w-4" /> Turn OFF widget
        </Button>
      </div>
    </Surface>
  );
}

function QuickToolsCard({ theme, onToast }: any) {
  return (
    <Surface theme={theme} className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-extrabold" style={{ color: theme.text }}>
            Quick tools
          </div>
          <div className="text-xs" style={{ color: theme.sub }}>
            Useful features (growing)
          </div>
        </div>
        <Bell className="h-5 w-5" style={{ color: theme.muted }} />
      </div>

      <div className="mt-3 grid gap-2">
        <Button theme={theme} variant="soft" className="w-full justify-start" onClick={() => onToast("AI Explainer (planned)")}>
          <Sparkles className="h-4 w-4" /> AI Explainer
        </Button>
        <Button theme={theme} variant="soft" className="w-full justify-start" onClick={() => onToast("Swipe-to-Listen (planned)")}>
          <Play className="h-4 w-4" /> Swipe-to-Listen
        </Button>
        <Button theme={theme} variant="soft" className="w-full justify-start" onClick={() => onToast("Viral Videos (planned)")}>
          <Video className="h-4 w-4" /> Viral Videos
        </Button>
      </div>
    </Surface>
  );
}

function SnapshotsCard({ theme }: any) {
  return (
    <Surface theme={theme} className="p-4">
      <div className="text-sm font-extrabold" style={{ color: theme.text }}>
        Snapshots
      </div>
      <div className="mt-1 text-xs" style={{ color: theme.sub }}>
        Small trending utilities
      </div>

      <div className="mt-3 grid gap-2">
        {[
          { k: "Weather", v: "27°C • Cloudy" },
          { k: "Markets", v: "Stable" },
          { k: "Gold", v: "₹ — (api)" },
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

function PreferencesDrawer({ theme, open, onClose, prefs, setPrefs, onToast }: any) {
  return (
    <Drawer open={open} onClose={onClose} theme={theme} title="Settings">
      <div className="space-y-4">
        

        <div className="rounded-3xl border p-4" style={{ background: theme.surface2, borderColor: theme.border }}>
          <div className="text-sm font-extrabold" style={{ color: theme.text }}>
            Home layout modules
          </div>
          <div className="mt-2 text-sm" style={{ color: theme.sub }}>
            Turn sections ON/OFF (Founder-style control).
          </div>

          <div className="mt-3 grid gap-2">
            <ToggleRow theme={theme} title="Category strip" sub="Top horizontal categories bar" value={prefs.showCategoryStrip} onToggle={() => setPrefs((p: any) => ({ ...p, showCategoryStrip: !p.showCategoryStrip }))} />
            <ToggleRow theme={theme} title="Trending strip" sub="Trending chips row" value={prefs.showTrendingStrip} onToggle={() => setPrefs((p: any) => ({ ...p, showTrendingStrip: !p.showTrendingStrip }))} />
            <ToggleRow theme={theme} title="Explore Categories" sub="Left sidebar category list" value={prefs.showExploreCategories} onToggle={() => setPrefs((p: any) => ({ ...p, showExploreCategories: !p.showExploreCategories }))} />
            <ToggleRow theme={theme} title="Live TV card" sub="Left sidebar Live TV widget" value={prefs.showLiveTvCard} onToggle={() => setPrefs((p: any) => ({ ...p, showLiveTvCard: !p.showLiveTvCard }))} />
            <ToggleRow theme={theme} title="Quick tools" sub="Left sidebar quick tools buttons" value={prefs.showQuickTools} onToggle={() => setPrefs((p: any) => ({ ...p, showQuickTools: !p.showQuickTools }))} />
            <ToggleRow theme={theme} title="Snapshots" sub="Left sidebar snapshot cards" value={prefs.showSnapshots} onToggle={() => setPrefs((p: any) => ({ ...p, showSnapshots: !p.showSnapshots }))} />
            <ToggleRow theme={theme} title="App promo section" sub="‘Take News Pulse Everywhere’ block" value={prefs.showAppPromo} onToggle={() => setPrefs((p: any) => ({ ...p, showAppPromo: !p.showAppPromo }))} />
            <ToggleRow theme={theme} title="Footer" sub="Full footer with quick links" value={prefs.showFooter} onToggle={() => setPrefs((p: any) => ({ ...p, showFooter: !p.showFooter }))} />
          </div>
        </div>

        <div className="rounded-3xl border p-4" style={{ background: theme.surface2, borderColor: theme.border }}>
          <div className="text-sm font-extrabold" style={{ color: theme.text }}>
            Live Updates ticker
          </div>
          <div className="mt-2 text-sm" style={{ color: theme.sub }}>
            Keep the Live Updates ticker ON/OFF and control its speed.
          </div>

          <div className="mt-3 flex gap-2">
            <Button theme={theme} variant={prefs.liveTickerOn ? "solid" : "soft"} onClick={() => setPrefs((p: any) => ({ ...p, liveTickerOn: true }))}>
              ON
            </Button>
            <Button theme={theme} variant={!prefs.liveTickerOn ? "solid" : "soft"} onClick={() => setPrefs((p: any) => ({ ...p, liveTickerOn: false }))}>
              OFF
            </Button>
          </div>

          <div className="mt-4 rounded-2xl border px-3 py-3" style={{ background: theme.surface, borderColor: theme.border }}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold" style={{ color: theme.muted }}>
                Speed (seconds per loop)
              </div>
              <div className="text-xs font-extrabold" style={{ color: theme.text }}>
                {prefs.liveSpeedSec}s
              </div>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={2}
              value={prefs.liveSpeedSec}
              onChange={(e) => setPrefs((p: any) => ({ ...p, liveSpeedSec: Number(e.target.value) }))}
              className="mt-2 w-full"
              aria-label="Live updates ticker speed"
            />
            <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: theme.sub }}>
              <span>Faster</span>
              <span>Slower</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border p-4" style={{ background: theme.surface2, borderColor: theme.border }}>
          <div className="text-sm font-extrabold" style={{ color: theme.text }}>
            Breaking News ticker
          </div>
          <div className="mt-2 text-sm" style={{ color: theme.sub }}>
            Auto uses backend. Force ON lets you test even if backend is empty.
          </div>

          <div className="mt-3 grid gap-2">
            {[
              { key: "auto", label: "Auto (backend)", sub: "Shows backend items" },
              { key: "on", label: "Force ON (demo)", sub: "Use demo breaking items" },
              { key: "off", label: "OFF", sub: "Hide Breaking ticker" },
            ].map((o: any) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setPrefs((p: any) => ({ ...p, breakingMode: o.key }))}
                className="flex items-start justify-between gap-3 rounded-3xl border p-3 text-left"
                style={{ background: theme.surface, borderColor: theme.border }}
              >
                <div>
                  <div className="text-sm font-extrabold" style={{ color: theme.text }}>
                    {o.label}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: theme.sub }}>
                    {o.sub}
                  </div>
                </div>
                {prefs.breakingMode === o.key ? <Check className="h-5 w-5" style={{ color: theme.accent }} /> : null}
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-2xl border p-3" style={{ background: theme.surface, borderColor: theme.border }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-extrabold" style={{ color: theme.text }}>
                  Show when empty
                </div>
                <div className="text-[11px]" style={{ color: theme.sub }}>
                  Keep the red bar visible with a placeholder message.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPrefs((p: any) => ({ ...p, showBreakingWhenEmpty: !p.showBreakingWhenEmpty }))}
                className="relative h-7 w-12 rounded-full border transition"
                style={{ background: prefs.showBreakingWhenEmpty ? theme.accent : theme.chip, borderColor: theme.border }}
                aria-label="Toggle show breaking ticker when empty"
              >
                <span
                  className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full"
                  style={{
                    background: "rgba(255,255,255,0.92)",
                    left: prefs.showBreakingWhenEmpty ? "calc(100% - 22px)" : "4px",
                    transition: "left 220ms ease",
                  }}
                />
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border px-3 py-3" style={{ background: theme.surface, borderColor: theme.border }}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold" style={{ color: theme.muted }}>
                Speed (seconds per loop)
              </div>
              <div className="text-xs font-extrabold" style={{ color: theme.text }}>
                {prefs.breakingSpeedSec}s
              </div>
            </div>
            <input
              type="range"
              min={10}
              max={60}
              step={2}
              value={prefs.breakingSpeedSec}
              onChange={(e) => setPrefs((p: any) => ({ ...p, breakingSpeedSec: Number(e.target.value) }))}
              className="mt-2 w-full"
              aria-label="Breaking ticker speed"
            />
            <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: theme.sub }}>
              <span>Faster</span>
              <span>Slower</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border p-4" style={{ background: theme.surface2, borderColor: theme.border }}>
          <div className="text-sm font-extrabold" style={{ color: theme.text }}>
            Live TV widget
          </div>
          <div className="mt-2 text-sm" style={{ color: theme.sub }}>
            Toggle widget and set embed URL (demo).
          </div>

          <div className="mt-3 flex gap-2">
            <Button theme={theme} variant={prefs.liveTvOn ? "solid" : "soft"} onClick={() => setPrefs((p: any) => ({ ...p, liveTvOn: true }))}>
              ON
            </Button>
            <Button theme={theme} variant={!prefs.liveTvOn ? "solid" : "soft"} onClick={() => setPrefs((p: any) => ({ ...p, liveTvOn: false }))}>
              OFF
            </Button>
          </div>

          <div className="mt-3 rounded-2xl border p-3" style={{ background: theme.surface, borderColor: theme.border }}>
            <div className="text-xs font-semibold" style={{ color: theme.muted }}>
              Embed URL
            </div>
            <input
              value={prefs.liveTvEmbedUrl}
              onChange={(e) => setPrefs((p: any) => ({ ...p, liveTvEmbedUrl: e.target.value }))}
              placeholder="https://… (iframe src)"
              className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
              style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            theme={theme}
            variant="ghost"
            onClick={() => {
              setPrefs(DEFAULT_PREFS);
              onToast("Settings reset to default");
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
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-10 pt-2">
      <Surface theme={theme} className="overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6">
              <div className="text-4xl sm:text-5xl font-black leading-[1.05]" style={{ color: theme.text }}>
                Take{" "}
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
                Everywhere
              </div>

              <div className="mt-4 text-sm sm:text-base" style={{ color: theme.sub }}>
                Download our mobile app and never miss a story. Available on all platforms with exclusive features.
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onToast("App Store link (planned)")}
                  className="rounded-3xl px-5 py-4 text-sm font-extrabold border transition hover:opacity-[0.98] inline-flex items-center gap-2"
                  style={{
                    background: theme.mode === "dark" ? "rgba(0,0,0,0.55)" : "#0b1220",
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <BookOpen className="h-5 w-5" />
                  App Store
                </button>

                <button
                  type="button"
                  onClick={() => onToast("Google Play link (planned)")}
                  className="rounded-3xl px-5 py-4 text-sm font-extrabold border transition hover:opacity-[0.98] inline-flex items-center gap-2"
                  style={{
                    background: `linear-gradient(90deg, rgba(16,185,129,0.95), ${theme.accent} 60%)`,
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  <Play className="h-5 w-5" />
                  Google Play
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-6 text-sm" style={{ color: theme.sub }}>
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4" style={{ color: theme.accent2 }} /> 4.8 Rating
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" style={{ color: theme.accent }} /> 1M+ Downloads
                </span>
                <span className="inline-flex items-center gap-2">
                  <Globe className="h-4 w-4" style={{ color: theme.accent }} /> Available in 3 languages
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

                  <div className="text-center text-2xl sm:text-3xl font-black">Mobile App Preview</div>
                  <div className="mt-2 text-center text-sm text-white/90 font-semibold">Experience News Pulse on the go</div>

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-8 text-sm font-semibold text-white/95">
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Analytics
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Bell className="h-4 w-4" /> Notifications
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <BookOpen className="h-4 w-4" /> Offline Reading
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-center text-xs" style={{ color: theme.sub }}>
                (UI preview only — app links will be connected after launch)
              </div>
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}

function SiteFooter({ theme, onToast }: any) {
  const footerBg =
    theme.mode === "dark"
      ? "linear-gradient(180deg, rgba(10,14,35,0.95) 0%, rgba(7,10,24,0.98) 100%)"
      : "linear-gradient(180deg, rgba(10,14,35,0.92) 0%, rgba(7,10,24,0.98) 100%)";

  return (
    <div className="mt-6" style={{ background: footerBg }}>
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="text-3xl font-black text-white">
              News <span style={{ color: theme.accent2 }}>Pulse</span>
            </div>
            <div className="mt-3 text-sm text-white/80 leading-relaxed">
              Your trusted source for breaking news, in-depth analysis, and stories that matter. Delivering truth with integrity since our inception.
            </div>

            <div className="mt-6 flex items-center gap-3">
              {[
                { label: "Community", icon: Users },
                { label: "Videos", icon: Video },
                { label: "Live", icon: Radio },
                { label: "World", icon: Globe },
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
              Quick Links
            </div>
            <div className="mt-4 grid gap-3 text-sm text-white/85">
              {["About Us", "Editorial Policy", "Privacy Policy", "Terms of Service", "Contact", "Careers", "Community Reporter", "Journalist Desk"].map((t) => (
                <button key={t} type="button" onClick={() => onToast(`${t} (planned)`)} className="text-left hover:underline">
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="text-lg font-extrabold" style={{ color: theme.accent2 }}>
              Business
            </div>
            <div className="mt-4 grid gap-3 text-sm text-white/85">
              {["Advertise With Us", "Media Kit", "Partnerships", "RSS Feeds", "API Access", "Licensing"].map((t) => (
                <button key={t} type="button" onClick={() => onToast(`${t} (planned)`)} className="text-left hover:underline">
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          <div className="text-xs text-white/70">© 2025 News Pulse. All rights reserved. | Powered by Innovation</div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-white/80">
            <span className="inline-flex items-center gap-2">
              <Globe className="h-4 w-4" /> Available in 3 languages
            </span>
            <span className="inline-flex items-center gap-2">
              <Video className="h-4 w-4" /> Mobile & Web
            </span>
            <span className="inline-flex items-center gap-2">
              <Check className="h-4 w-4" /> Secure & Private
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UiPreviewV145() {
  const [prefs, setPrefs] = useState<any>(DEFAULT_PREFS);
  const theme = useMemo(() => getTheme(prefs.themeId), [prefs.themeId]);
  const { externalFetch } = usePublicMode();

  const [activeCatKey, setActiveCatKey] = useState<string>("breaking");
  const [toast, setToast] = useState<string>("");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [viewAllKind, setViewAllKind] = useState<"live" | "breaking">("live");

  // Real data hooks
  const regional = useRegionalPulse("gujarat");
  const youth = useYouthPulse();

  // load local prefs
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(PREF_KEY) : null;
    if (!raw) return;
    const parsed = safeJsonParse(raw);
    if (!parsed) return;
    setPrefs(normalizePrefs(parsed));
  }, []);

  // ✅ (optional) load global settings from backend (admin-controlled)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const base = (process as any)?.env?.NEXT_PUBLIC_API_URL || "";
        const url = base ? `${String(base).replace(/\/$/, "")}/api/site-settings/public` : "/api/site-settings/public";

        const res = await fetch(url, { credentials: "include" });
        const data = await res.json().catch(() => null);

        if (cancelled) return;
        if (!res.ok || !data?.ok || !data?.settings) return;

        const s = data.settings || {};

        // admin settings override global modules; keep user theme/lang
        setPrefs((prev: any) => {
          const merged = normalizePrefs({ ...prev, ...s });
          merged.themeId = prev.themeId;
          merged.lang = prev.lang;
          return merged;
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // save local prefs
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREF_KEY, JSON.stringify(normalizePrefs(prefs)));
  }, [prefs]);

  const breakingItems = getBreakingItems(prefs);
  const showBreaking = prefs.breakingMode !== "off" && (breakingItems.length > 0 || prefs.showBreakingWhenEmpty);
  const onToast = (m: string) => setToast(m);

  return (
    <div className="relative w-full overflow-x-hidden overflow-hidden" style={{ minHeight: "100vh", background: theme.bg }}>
      <style jsx global>{`
        html, body { height: 100%; }
        body { overflow-x: hidden; scrollbar-gutter: stable; }
        .np-no-scrollbar::-webkit-scrollbar { display: none; }
        .np-no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes np-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .np-tickerTrack { display: flex; width: max-content; will-change: transform; animation-name: np-marquee; animation-timing-function: linear; animation-iteration-count: infinite; }
        .np-tickerSeq { flex-shrink: 0; }
        .np-marqueeWrap:hover .np-tickerTrack { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .np-tickerTrack { animation: none !important; transform: none !important; }
        }
      `}</style>

      {/* TOP HEADER */}
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 pt-4">
        <Surface theme={theme} className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <IconButton theme={theme} onClick={() => setMobileLeftOpen(true)} label="Menu">
                <Menu className="h-5 w-5" />
              </IconButton>

              <div className="min-w-0">
                <div className="text-sm font-black tracking-tight" style={{ color: theme.text }}>
                  News <span style={{ color: theme.accent }}>Pulse</span>
                </div>
                <div className="text-[11px] font-semibold" style={{ color: theme.sub }}>
                  Your Pulse on the World's Latest News
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <Button theme={theme} variant="soft" onClick={() => onToast("Home (planned)")}>
                <Home className="h-4 w-4" /> Home
              </Button>
              <Button theme={theme} variant="soft" onClick={() => onToast("Viral Videos (planned)")}>
                <Video className="h-4 w-4" /> Videos
              </Button>
              <Button theme={theme} variant="soft" onClick={() => onToast("Search (planned)")}>
                <Search className="h-4 w-4" /> Search
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <LanguagePicker theme={theme} value={prefs.lang} onChange={(v: string) => setPrefs((p: any) => ({ ...p, lang: v }))} />
              <ThemePicker theme={theme} themeId={prefs.themeId} setThemeId={(id: string) => setPrefs((p: any) => ({ ...p, themeId: id }))} />

              <IconButton theme={theme} onClick={() => setSettingsOpen(true)} label="Settings">
                <Settings className="h-5 w-5" />
              </IconButton>

              <Button theme={theme} variant="solid" onClick={() => onToast("Login (planned)")}>
                <LogIn className="h-4 w-4" /> Login
              </Button>
            </div>
          </div>

          {prefs.showPreviewNotice ? (
            <div className="mt-3 rounded-2xl border px-3 py-2 text-xs font-semibold" style={{ background: theme.surface2, borderColor: theme.border, color: theme.sub }}>
              Preview UI only (no backend wiring here). Design is safe to integrate into real home page next.
            </div>
          ) : null}
        </Surface>
      </div>

      {/* CATEGORY STRIP */}
      {prefs.showCategoryStrip ? (
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
      ) : null}

      {/* TICKERS: Combined premium module wrapper with BREAKING above LIVE */}
      <div className="mt-0 w-full max-w-full">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-black/10 bg-white/80 backdrop-blur-md shadow-sm ring-1 ring-black/5 overflow-hidden p-2 flex flex-col gap-2">
          {showBreaking ? (
            <div className="w-full min-w-0">
              <TickerBar
                theme={theme}
                kind="breaking"
                items={breakingItems}
                speedSec={prefs.breakingSpeedSec}
                onViewAll={() => {
                  setViewAllKind("breaking");
                  setViewAllOpen(true);
                }}
              />
            </div>
          ) : null}

          {prefs.liveTickerOn ? (
            <div className="w-full min-w-0">
              <TickerBar
                theme={theme}
                kind="live"
                items={LIVE_UPDATES}
                speedSec={prefs.liveSpeedSec}
                onViewAll={() => {
                  setViewAllKind("live");
                  setViewAllOpen(true);
                }}
              />
            </div>
          ) : null}
          </div>
        </div>
      </div>

      {/* TRENDING */}
      {(prefs.showTrendingStrip && externalFetch) ? <TrendingStrip theme={theme} onPick={(t: string) => onToast(`Trending: ${t}`)} /> : null}

      {/* MAIN GRID */}
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-10 pt-4">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr_360px] 2xl:grid-cols-[380px_1fr_380px]">
          {/* LEFT */}
          <div className="grid gap-4">
            {prefs.showExploreCategories ? (
              <ExploreCategoriesPanel
                theme={theme}
                prefs={prefs}
                activeKey={activeCatKey}
                onPick={(k: string) => {
                  setActiveCatKey(k);
                  onToast(`Category: ${k}`);
                }}
              />
            ) : null}

            {prefs.showLiveTvCard ? <LiveTVWidget theme={theme} prefs={prefs} setPrefs={setPrefs} onToast={onToast} /> : null}
            {prefs.showQuickTools ? <QuickToolsCard theme={theme} onToast={onToast} /> : null}
            {prefs.showSnapshots ? <SnapshotsCard theme={theme} /> : null}
          </div>

          {/* CENTER */}
          <div className="grid gap-4">
            <TopBanner theme={theme} />
            <FeaturedCard theme={theme} item={FEATURED[0]} onToast={onToast} />
          </div>

          {/* RIGHT */}
          <div className="grid gap-4">
            <FeedList theme={theme} title="Latest" items={FEED} onOpen={(id: string) => onToast(id === "viewall" ? "View all latest (planned)" : `Open story: ${id}`)} />

            {/* Regional preview */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: theme.surface2, borderColor: theme.border }}>
              <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: theme.border }}>
                <div className="text-sm font-extrabold" style={{ color: theme.text }}>Regional preview</div>
                <a href="/regional" className="text-xs font-semibold" style={{ color: theme.accent }}>View all →</a>
              </div>
              <div className="p-3 grid gap-2">
                {(regional.news.slice(0, 3)).map((a: any, idx: number) => (
                  <a key={String(a.id || idx)} href={'#'} className="rounded-xl border px-3 py-2 text-sm hover:opacity-95" style={{ background: theme.surface, borderColor: theme.border, color: theme.text }}>
                    {a.title}
                  </a>
                ))}
                {regional.loading && !regional.news.length ? (
                  <div className="rounded-xl border px-3 py-7 animate-pulse" style={{ background: theme.surface, borderColor: theme.border }} />
                ) : null}
              </div>
            </div>

            {/* Youth Pulse trending */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: theme.surface2, borderColor: theme.border }}>
              <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: theme.border }}>
                <div className="text-sm font-extrabold" style={{ color: theme.text }}>Youth Pulse trending</div>
                <a href="/youth-pulse" className="text-xs font-semibold" style={{ color: theme.accent2 }}>View all →</a>
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
        </div>
      </div>

      {/* APP PROMO + FOOTER */}
      {prefs.showAppPromo ? <AppPromoSection theme={theme} onToast={onToast} /> : null}
      {prefs.showFooter ? <SiteFooter theme={theme} onToast={onToast} /> : null}

      {/* DRAWERS */}
      <PreferencesDrawer theme={theme} open={settingsOpen} onClose={() => setSettingsOpen(false)} prefs={prefs} setPrefs={setPrefs} onToast={onToast} />

      <Drawer open={mobileLeftOpen} onClose={() => setMobileLeftOpen(false)} theme={theme} title="Menu" side="left">
        <div className="grid gap-3">
          <Button theme={theme} variant="soft" className="w-full justify-start" onClick={() => onToast("Home (planned)")}>
            <Home className="h-4 w-4" /> Home
          </Button>
          <Button theme={theme} variant="soft" className="w-full justify-start" onClick={() => onToast("Viral Videos (planned)")}>
            <Video className="h-4 w-4" /> Videos
          </Button>
          <Button theme={theme} variant="soft" className="w-full justify-start" onClick={() => onToast("Search (planned)")}>
            <Search className="h-4 w-4" /> Search
          </Button>

          <div className="h-px" style={{ background: theme.border }} />

          <div className="text-xs font-extrabold" style={{ color: theme.sub }}>
            Categories
          </div>

          <div className="grid gap-1">
            {getCats().map((c: any) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setActiveCatKey(c.key);
                  setMobileLeftOpen(false);
                  onToast(`Category: ${c.label}`);
                }}
                className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold border"
                style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border" style={{ background: theme.chip, borderColor: theme.border }}>
                  <c.Icon className="h-4 w-4" />
                </span>
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Drawer>

      <Drawer open={viewAllOpen} onClose={() => setViewAllOpen(false)} theme={theme} title={viewAllKind === "live" ? "Live Updates" : "Breaking News"}>
        <div className="grid gap-2">
          {(viewAllKind === "live" ? LIVE_UPDATES : showBreaking ? (breakingItems.length ? breakingItems : ["No breaking news right now — stay tuned"]) : []).map(
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
