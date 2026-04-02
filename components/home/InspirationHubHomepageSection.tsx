import React from "react";
import Link from "next/link";
import { ArrowRight, Leaf, Play, Sparkles } from "lucide-react";
import inspirationData from "../../data/inspiration.json";
import { sanitizeEmbedUrl } from "../../src/lib/publicSettings";

type InspirationHubHomepageSectionProps = {
  theme: any;
  href: string;
};

const DAILY_WONDERS_QUOTES = [
  {
    id: "pause",
    label: "Featured reflection",
    quote: "Pause long enough to notice what is still good, gentle, and growing around you.",
  },
  {
    id: "light",
    label: "Visual reset",
    quote: "Soft light, steady breath, and one quiet thought can reset an entire afternoon.",
  },
  {
    id: "wonder",
    label: "Daily wonder",
    quote: "Wonder returns quickly when the mind is given a little room to wander without noise.",
  },
];

export default function InspirationHubHomepageSection({ theme, href }: InspirationHubHomepageSectionProps) {
  const sections = Array.isArray((inspirationData as any)?.sections) ? (inspirationData as any).sections : [];
  const drone = sections.find((item: any) => item?.id === "drone-tv") || null;
  const wonders = sections.find((item: any) => item?.id === "daily-wonders") || null;
  const embedUrl = sanitizeEmbedUrl(drone?.videoUrl);
  const hasEmbed = !!embedUrl;

  const featuredQuote = DAILY_WONDERS_QUOTES[0];
  const supportingQuotes = DAILY_WONDERS_QUOTES.slice(1);

  return (
    <section
      className="overflow-hidden rounded-[32px] border shadow-[0_30px_80px_-56px_rgba(15,23,42,0.42)]"
      style={{ background: theme.surface2, borderColor: theme.border }}
    >
      <div
        className="border-b px-4 py-5 sm:px-6"
        style={{
          borderColor: theme.border,
          background:
            theme.mode === "dark"
              ? "linear-gradient(135deg, rgba(45,212,191,0.16), rgba(56,189,248,0.10) 58%, rgba(250,204,21,0.06) 100%)"
              : "linear-gradient(135deg, rgba(20,184,166,0.10), rgba(14,165,233,0.08) 58%, rgba(250,204,21,0.08) 100%)",
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border"
                style={{ borderColor: theme.border, background: theme.surface, color: theme.text }}
              >
                <Leaf className="h-4 w-4" />
              </span>
              Calm viewing
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-[2rem]" style={{ color: theme.text }}>
              Inspiration Hub
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 sm:text-[15px]" style={{ color: theme.sub }}>
              Explore scenic relaxation videos, uplifting stories, and visual quotes to refresh your mind.
            </p>
          </div>

          <Link
            href={href}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition hover:opacity-[0.98]"
            style={{ color: theme.text, borderColor: theme.border, background: theme.surface }}
          >
            Open Inspiration Hub <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-stretch">
        <div
          className="overflow-hidden rounded-[28px] border shadow-[0_24px_56px_-40px_rgba(15,23,42,0.38)]"
          style={{ borderColor: theme.border, background: theme.surface }}
        >
          <div className="flex items-start justify-between gap-3 border-b px-4 py-4 sm:px-5" style={{ borderColor: theme.border }}>
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
                DroneTV
              </div>
              <h3 className="mt-2 text-xl font-black tracking-tight sm:text-2xl" style={{ color: theme.text }}>
                Scenic Nature Relaxation
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: theme.sub }}>
                A slower, immersive visual space designed for scenic pauses and low-noise viewing.
              </p>
            </div>

            <div
              className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ color: theme.text, borderColor: theme.border, background: theme.surface2 }}
            >
              <Play className="h-3.5 w-3.5" />
              {hasEmbed ? "Auto-embed ready" : "Safe placeholder"}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div
              className="relative overflow-hidden rounded-[26px] border shadow-[0_18px_44px_-34px_rgba(15,23,42,0.55)]"
              style={{ borderColor: theme.border, background: theme.mode === "dark" ? "#06121a" : "#dff6f3" }}
            >
              <div className="relative w-full pt-[60%]">
                {hasEmbed ? (
                  <iframe
                    title={String(drone?.title || "DroneTV scenic relaxation")}
                    src={embedUrl}
                    className="absolute inset-0 h-full w-full"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div className="absolute inset-0 overflow-hidden">
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          theme.mode === "dark"
                            ? "radial-gradient(circle at 20% 18%, rgba(45,212,191,0.22), transparent 28%), radial-gradient(circle at 82% 20%, rgba(56,189,248,0.20), transparent 34%), linear-gradient(180deg, rgba(6,18,26,1) 0%, rgba(9,32,44,1) 45%, rgba(7,26,34,1) 100%)"
                            : "radial-gradient(circle at 18% 18%, rgba(45,212,191,0.28), transparent 28%), radial-gradient(circle at 82% 20%, rgba(14,165,233,0.24), transparent 34%), linear-gradient(180deg, rgba(233,249,246,1) 0%, rgba(217,241,243,1) 50%, rgba(233,246,252,1) 100%)",
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 h-[45%] bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.42))]" />
                    <div className="absolute inset-x-6 bottom-6">
                      <div className="max-w-md rounded-[24px] border px-4 py-4 backdrop-blur-md" style={{ borderColor: "rgba(255,255,255,0.16)", background: "rgba(15,23,42,0.18)", color: "#f8fafc" }}>
                        <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/80">Scenic placeholder</div>
                        <div className="mt-2 text-xl font-black tracking-tight">Immersive relaxation view</div>
                        <div className="mt-2 text-sm leading-6 text-white/80">
                          Embed is not wired right now, so this module stays lightweight with a calm visual placeholder.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.56))]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/90" style={{ borderColor: "rgba(255,255,255,0.18)", background: "rgba(15,23,42,0.26)" }}>
                      Scenic stream
                    </div>
                    <div className="mt-3 text-lg font-black tracking-tight text-white sm:text-xl">
                      {String(drone?.title || "DroneTV – Scenic Nature Relaxation")}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm leading-6" style={{ color: theme.sub }}>
                {String(drone?.note || "A calm, scenic video lane designed to load safely and stay visually premium.")}
              </p>
              <Link
                href={href}
                className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold"
                style={{ color: theme.accent }}
              >
                View more calm content <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-[28px] border shadow-[0_22px_52px_-40px_rgba(15,23,42,0.34)]"
          style={{ borderColor: theme.border, background: theme.surface }}
        >
          <div className="border-b px-4 py-4 sm:px-5" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
              <Sparkles className="h-4 w-4" />
              Daily Wonders
            </div>
            <h3 className="mt-2 text-xl font-black tracking-tight" style={{ color: theme.text }}>
              Uplifting Visual Quotes
            </h3>
            <p className="mt-2 text-sm leading-6" style={{ color: theme.sub }}>
              A quote-led companion panel built for reflection instead of another repeated news-card grid.
            </p>
          </div>

          <div className="grid gap-3 p-4 sm:p-5">
            <div
              className="overflow-hidden rounded-[26px] border px-5 py-6"
              style={{
                borderColor: theme.border,
                background:
                  theme.mode === "dark"
                    ? "linear-gradient(160deg, rgba(250,204,21,0.10), rgba(45,212,191,0.08) 45%, rgba(255,255,255,0.04) 100%)"
                    : "linear-gradient(160deg, rgba(254,249,195,0.82), rgba(204,251,241,0.72) 45%, rgba(255,255,255,0.94) 100%)",
              }}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
                {featuredQuote.label}
              </div>
              <p className="mt-4 text-[1.2rem] font-black leading-8 tracking-tight sm:text-[1.35rem]" style={{ color: theme.text }}>
                &ldquo;{featuredQuote.quote}&rdquo;
              </p>
              <div className="mt-5 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: theme.sub }}>
                {String(wonders?.title || "Daily Wonders")}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {supportingQuotes.map((quote) => (
                <article
                  key={quote.id}
                  className="rounded-[22px] border px-4 py-4 shadow-[0_16px_36px_-32px_rgba(15,23,42,0.28)]"
                  style={{ borderColor: theme.border, background: theme.surface2 }}
                >
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
                    {quote.label}
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6" style={{ color: theme.text }}>
                    &ldquo;{quote.quote}&rdquo;
                  </p>
                </article>
              ))}
            </div>

            <div
              className="rounded-[22px] border px-4 py-4 text-sm leading-6"
              style={{ borderColor: theme.border, background: theme.surface2, color: theme.sub }}
            >
              {String(wonders?.note || "Visual inspiration and calm moments.")}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}