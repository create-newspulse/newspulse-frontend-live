"use client";

import React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Flame,
  MapPin,
  Flag,
  Globe,
  Briefcase,
  Cpu,
  Trophy,
  Leaf,
  Sparkles,
  BookOpen,
  PenLine,
  GraduationCap,
  Users,
  Video,
  ArrowRight,
} from "lucide-react";

import { usePublicFounderToggles } from "../hooks/usePublicFounderToggles";

const NAV = [
  { href: "/breaking", label: "Breaking", subtitle: "Latest urgent updates", icon: Flame, tone: "breaking", toneKey: "breaking" },
  { href: "/regional/gujarat", label: "Regional", subtitle: "Gujarat districts and cities", icon: MapPin, tone: "regional", toneKey: "regional" },
  { href: "/national", label: "National", subtitle: "India-wide coverage", icon: Flag, tone: "national", toneKey: "national" },
  { href: "/international", label: "International", subtitle: "Global top stories", icon: Globe, tone: "international", toneKey: "international" },
  { href: "/business", label: "Business", subtitle: "Markets and economy", icon: Briefcase, tone: "business", toneKey: "business" },
  { href: "/science-technology", label: "Science & Technology", subtitle: "Innovation and tech", icon: Cpu, tone: "tech", toneKey: "tech" },
  { href: "/sports", label: "Sports", subtitle: "Matches and results", icon: Trophy, tone: "sports", toneKey: "sports" },
  { href: "/lifestyle", label: "Lifestyle", subtitle: "Health, style and living", icon: Leaf, tone: "lifestyle", toneKey: "lifestyle" },
  { href: "/glamour", label: "Glamour", subtitle: "Bollywood and celebrity buzz", icon: Sparkles, tone: "glamour", toneKey: "glamour" },
  { href: "/web-stories", label: "Web Stories", subtitle: "Quick visual stories", icon: BookOpen, tone: "stories", toneKey: "stories" },
  { href: "/viral-videos", label: "Viral Videos", subtitle: "Trending clips and viral moments", icon: Video, tone: "viral", toneKey: "viral" },
  { href: "/editorial", label: "Editorial", subtitle: "Opinions, analysis and insight", icon: PenLine, tone: "editorial", toneKey: "editorial" },
  { href: "/youth-pulse", label: "Youth Pulse", subtitle: "Students, careers and youth trends", icon: GraduationCap, tone: "youth", toneKey: "youth", badge: "NEW" },
  { href: "/inspiration-hub", label: "Inspiration Hub", subtitle: "Positive stories and motivation", icon: Sparkles, tone: "youth", toneKey: "inspiration" },
  { href: "/community-reporter", label: "Community Reporter", subtitle: "Public voices and local reports", icon: Users, tone: "community", toneKey: "community" },
] as const;

type CardTone = {
  wrap: string;
  iconWrap: string;
  text: string;
  arrow: string;
  activeRing: string;
  leftBar: string;
};

const TONE: Record<string, CardTone> = {
  breaking: {
    wrap: "bg-newsPulse-red/10 border-newsPulse-red/25 hover:bg-newsPulse-red/15",
    iconWrap: "bg-newsPulse-red/10 border-newsPulse-red/25 text-newsPulse-red",
    text: "text-newsPulse-red",
    arrow: "text-newsPulse-red",
    activeRing: "ring-newsPulse-red/30",
    leftBar: "bg-newsPulse-red",
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
    wrap: "bg-newsPulse-blue/10 border-newsPulse-blue/25 hover:bg-newsPulse-blue/15",
    iconWrap: "bg-newsPulse-blue/10 border-newsPulse-blue/25 text-newsPulse-blue",
    text: "text-newsPulse-blue",
    arrow: "text-newsPulse-blue",
    activeRing: "ring-newsPulse-blue/30",
    leftBar: "bg-newsPulse-blue",
  },
  business: {
    wrap: "bg-violet-50 border-violet-200 hover:bg-violet-50/80",
    iconWrap: "bg-violet-100 border-violet-200 text-violet-700",
    text: "text-violet-800",
    arrow: "text-violet-500",
    activeRing: "ring-violet-200",
    leftBar: "bg-violet-500",
  },
  tech: {
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
  stories: {
    wrap: "bg-yellow-50 border-yellow-200 hover:bg-yellow-50/80",
    iconWrap: "bg-yellow-100 border-yellow-200 text-yellow-800",
    text: "text-yellow-900",
    arrow: "text-yellow-700",
    activeRing: "ring-yellow-200",
    leftBar: "bg-yellow-500",
  },
  viral: {
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

const DEFAULT_TONE: CardTone = {
  wrap: "bg-neutral-50 border-neutral-200 hover:bg-neutral-50/80",
  iconWrap: "bg-neutral-100 border-neutral-200 text-neutral-700",
  text: "text-neutral-800",
  arrow: "text-neutral-500",
  activeRing: "ring-neutral-200",
  leftBar: "bg-neutral-400",
};

// ⬇️ IMPORTANT: each item must have a `toneKey` that matches keys above
// Example:
// { href:"/breaking", label:"Breaking", icon:Flame, toneKey:"breaking" }

export function ExploreCategories({ pathname = "/" }: { pathname?: string }) {
  const { toggles } = usePublicFounderToggles();
  const navItems = React.useMemo(
    () => (toggles.communityReporterClosed ? NAV.filter((item) => item.href !== "/community-reporter") : NAV),
    [toggles.communityReporterClosed]
  );

  return (
    <section className="overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_18px_44px_-36px_rgba(15,23,42,0.25)]">
      <div className="border-b border-slate-200/80 bg-gradient-to-br from-blue-50/80 via-violet-50/70 to-white px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-black tracking-tight text-slate-950">Explore Categories</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Tap to filter</div>
          </div>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600">
            News Desk
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:p-5">
        {navItems.map((item) => {
          const t = TONE[(item as any).toneKey] ?? DEFAULT_TONE;
          const active = pathname.startsWith(item.href);
          const Icon = (item as any).icon as LucideIcon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "group relative flex min-h-[78px] items-start gap-3 rounded-[24px] border px-4 py-3.5 transition duration-200 sm:min-h-[82px]",
                "bg-white/90 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.36)] hover:-translate-y-[1px]",
                active ? `border-black/20 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.42)] ring-2 ${t.activeRing}` : "border-black/10 hover:border-black/15",
              ].join(" ")}
            >
              {/* left color bar */}
              <span className={["absolute left-0 top-3 bottom-3 w-1 rounded-full", t.leftBar].join(" ")} />

              {/* icon bubble */}
              <span className={["mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border", t.iconWrap].join(" ")}>
                <Icon className="w-5 h-5" />
              </span>

              <span className="min-w-0 flex-1 self-stretch pr-2">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className={["min-w-0 truncate text-[15px] font-bold leading-tight tracking-tight", t.text].join(" ")}>{item.label}</span>
                {(item as any).badge ? (
                  <span
                    className={[
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.16em]",
                      "bg-white/70 border-black/10",
                      t.text,
                    ].join(" ")}
                  >
                    {(item as any).badge}
                  </span>
                ) : null}
                </span>
                <span className="mt-1 block text-[12px] font-medium leading-[1.35] text-slate-600">{(item as any).subtitle}</span>
              </span>

              <ArrowRight className={["ml-auto mt-0.5 h-5 w-5 shrink-0 self-center", t.arrow].join(" ")} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default ExploreCategories;
