import { ExternalLink, Play, Radio } from "lucide-react";
import type { ScenicMediaItem } from "../../data/inspirationHubContent";
import { useI18n } from "../../src/i18n/LanguageProvider";

type Props = {
  items: ScenicMediaItem[];
  videoEmbedUrl?: string | null;
};

export default function DroneTVSection({ items, videoEmbedUrl }: Props) {
  const { t } = useI18n();
  const featured = items[0];
  const secondary = items.slice(1);
  const showSettingsFallback = videoEmbedUrl === null;
  const showSettingsVideo = typeof videoEmbedUrl === "string" && videoEmbedUrl.trim().length > 0;
  const showFallbackCards = !showSettingsVideo;

  if (!featured) return null;

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/82 shadow-[0_30px_80px_-52px_rgba(15,23,42,0.24)] backdrop-blur-sm">
      <div className="border-b border-slate-200/70 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              <Radio className="h-4 w-4 text-teal-600" />
              {t("inspirationHub.page.drone.eyebrow")}
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">
              {t("inspirationHub.page.drone.title")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-[15px]">
              {t("inspirationHub.page.drone.description")}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">
            <Play className="h-3.5 w-3.5" />
            {t("inspirationHub.page.drone.supportedBadge")}
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.9fr)]">
        {showSettingsVideo ? (
          <article className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/92 p-4 shadow-[0_26px_60px_-44px_rgba(15,23,42,0.34)] xl:col-span-2 sm:p-5">
            <div className="relative overflow-hidden rounded-[24px] border border-slate-200/70 bg-black shadow-[0_20px_48px_-38px_rgba(15,23,42,0.56)]">
              <div className="pointer-events-none absolute left-4 top-4 z-10 sm:left-5 sm:top-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/55 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white backdrop-blur-sm">
                  {t("inspirationHub.page.drone.liveEmbedBadge")}
                </div>
              </div>

              <div className="pointer-events-none absolute right-4 top-4 z-10 sm:right-5 sm:top-5">
                <div className="rounded-full border border-white/15 bg-slate-950/45 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm">
                  {t("inspirationHub.page.drone.lazyLoadedBadge")}
                </div>
              </div>

              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
                <iframe
                  title={t("inspirationHub.page.drone.iframeTitle")}
                  src={videoEmbedUrl}
                  className="absolute inset-0 h-full w-full bg-black"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200/70 bg-white px-4 py-4 text-slate-700 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{t("inspirationHub.page.drone.publishedLabel")}</div>
                  <div className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                    {t("inspirationHub.page.drone.publishedDescription")}
                  </div>
                </div>

                <a
                  href={featured.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  {t("inspirationHub.page.drone.openSourceCta")}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </article>
        ) : null}

        {showSettingsFallback ? (
          <article className="rounded-[28px] border border-slate-200/70 bg-slate-50 px-5 py-5 text-sm leading-6 text-slate-600 xl:col-span-2 sm:px-6">
            {t("inspirationHub.page.drone.disabledNotice")}
          </article>
        ) : null}

        {showFallbackCards ? (
          <>
            <article className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-slate-950 shadow-[0_26px_60px_-44px_rgba(15,23,42,0.56)]">
              <div className="relative aspect-[16/9] overflow-hidden">
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(circle at 18% 18%, ${featured.accentFrom}, transparent 28%), radial-gradient(circle at 82% 20%, ${featured.accentTo}, transparent 36%), linear-gradient(180deg, rgba(7,18,28,1) 0%, rgba(12,36,46,1) 44%, rgba(12,29,34,1) 100%)`,
                  }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.56))]" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm">
                    {featured.mood}
                  </div>
                  <h3 className="mt-4 max-w-xl text-2xl font-black tracking-tight text-white sm:text-3xl">
                    {featured.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200">
                    {featured.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 text-white/88 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                  <span className="rounded-full border border-white/15 px-2.5 py-1">{featured.duration}</span>
                  <span className="rounded-full border border-white/15 px-2.5 py-1">{t("inspirationHub.page.drone.fallbackBadge")}</span>
                </div>

                <a
                  href={featured.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  {featured.ctaLabel}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </article>

            <div className="grid gap-4">
              {secondary.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[26px] border border-slate-200/70 bg-white/88 p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.22)]"
                >
                  <div
                    className="rounded-[22px] p-4"
                    style={{
                      background: `linear-gradient(160deg, ${item.accentFrom}, ${item.accentTo} 52%, rgba(255,255,255,0.92) 100%)`,
                    }}
                  >
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-600">{item.mood}</div>
                    <div className="mt-2 text-xl font-black tracking-tight text-slate-950">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.duration}</div>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition hover:text-sky-800"
                    >
                      {item.ctaLabel}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </article>
              ))}

              <div className="rounded-[26px] border border-slate-200/70 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                {t("inspirationHub.page.drone.fallbackPolicyNote")}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
