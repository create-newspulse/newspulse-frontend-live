export type ScenicMediaItem = {
  id: string;
  title: string;
  description: string;
  duration: string;
  mood: string;
  ctaLabel: string;
  href: string;
  accentFrom: string;
  accentTo: string;
};

export type QuoteItem = {
  id: string;
  eyebrow: string;
  quote: string;
  support: string;
};

export type PositiveStoryItem = {
  id: string;
  category: string;
  title: string;
  summary: string;
  href: string;
};

export const scenicMediaItems: ScenicMediaItem[] = [
  {
    id: "coastline-reset",
    title: "Coastline Reset",
    description: "Wide coastal passes, soft horizons, and a slower rhythm for a quick mental reset.",
    duration: "12 min watch",
    mood: "Ocean calm",
    ctaLabel: "Watch on YouTube",
    href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
    accentFrom: "rgba(45,212,191,0.32)",
    accentTo: "rgba(14,165,233,0.20)",
  },
  {
    id: "forest-drift",
    title: "Forest Drift",
    description: "Tree canopy movement and gentle terrain visuals for a quieter mid-day pause.",
    duration: "8 min watch",
    mood: "Woodland ease",
    ctaLabel: "Open scenic set",
    href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
    accentFrom: "rgba(34,197,94,0.28)",
    accentTo: "rgba(16,185,129,0.18)",
  },
  {
    id: "mountain-light",
    title: "Mountain Light",
    description: "High-elevation sunrise frames and open-sky movement designed for slow breathing.",
    duration: "10 min watch",
    mood: "Sunrise stillness",
    ctaLabel: "View feature",
    href: "https://www.youtube.com/watch?v=YVYNY6ez_uw",
    accentFrom: "rgba(250,204,21,0.30)",
    accentTo: "rgba(56,189,248,0.16)",
  },
];

export const dailyWonderQuotes: QuoteItem[] = [
  {
    id: "pause",
    eyebrow: "Featured reflection",
    quote: "Pause long enough to notice what is still good, gentle, and growing around you.",
    support: "A short reminder for crowded days that need a little room again.",
  },
  {
    id: "light",
    eyebrow: "Visual reset",
    quote: "Soft light, steady breath, and one quiet thought can reset an entire afternoon.",
    support: "Keep this nearby when the pace is high and the signal is noisy.",
  },
  {
    id: "wonder",
    eyebrow: "Daily wonder",
    quote: "Wonder returns quickly when the mind is given a little room to wander without noise.",
    support: "A calm prompt for slowing down without checking out.",
  },
  {
    id: "forward",
    eyebrow: "Small momentum",
    quote: "You do not need a dramatic breakthrough to make today feel brighter than yesterday.",
    support: "Steady progress belongs here too.",
  },
];

export const positiveStoryItems: PositiveStoryItem[] = [
  {
    id: "community-kindness",
    category: "Community",
    title: "Stories that spotlight quiet acts of care and local generosity",
    summary: "Follow community-driven reporting and local human-interest coverage that leaves readers with something constructive.",
    href: "/community-reporter",
  },
  {
    id: "youth-energy",
    category: "Youth Pulse",
    title: "Young achievers, campus momentum, and the people building tomorrow",
    summary: "Explore uplifting student stories, emerging voices, and next-generation ambition already shaping the feed.",
    href: "/youth-pulse",
  },
  {
    id: "lifestyle-rhythm",
    category: "Lifestyle",
    title: "Mood-lifting reads for balance, routines, and small daily upgrades",
    summary: "Continue with lighter reading across lifestyle coverage when you want something useful, warm, and easy to scan.",
    href: "/lifestyle",
  },
];