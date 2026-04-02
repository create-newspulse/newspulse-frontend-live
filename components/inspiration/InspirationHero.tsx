import Link from "next/link";
import { ArrowRight, Compass, Home, Sparkles } from "lucide-react";
import { useI18n } from "../../src/i18n/LanguageProvider";
import InspirationListenButton from "./InspirationListenButton";

type Props = {
  title: string;
  subtitle: string;
  voiceText?: string;
};

export default function InspirationHero({ title, subtitle, voiceText }: Props) {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden rounded-[36px] border border-slate-200/70 bg-white/78 shadow-[0_30px_90px_-56px_rgba(15,23,42,0.30)] backdrop-blur-sm">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_52%_100%,rgba(250,204,21,0.10),transparent_32%)]" />
      <div className="relative px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-600 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-teal-600" />
            {t("inspirationHub.badge")}
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            {subtitle}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <InspirationListenButton
              text={voiceText || ""}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/85 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white"
            />
            <Link
              href="/latest"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {t("inspirationHub.hero.primaryAction")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/85 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white"
            >
              <Home className="h-4 w-4" />
              {t("inspirationHub.hero.secondaryAction")}
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: t("inspirationHub.hero.cards.scenicRelaxationLabel"),
              value: t("inspirationHub.hero.cards.scenicRelaxationValue"),
            },
            {
              label: t("inspirationHub.hero.cards.quotePanelsLabel"),
              value: t("inspirationHub.hero.cards.quotePanelsValue"),
            },
            {
              label: t("inspirationHub.hero.cards.exploreMoreLabel"),
              value: t("inspirationHub.hero.cards.exploreMoreValue"),
            },
          ].map((item) => (
            <div key={item.label} className="rounded-[24px] border border-white/70 bg-white/70 px-4 py-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                <Compass className="h-3.5 w-3.5 text-sky-600" />
                {item.label}
              </div>
              <div className="mt-2 text-lg font-black tracking-tight text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}