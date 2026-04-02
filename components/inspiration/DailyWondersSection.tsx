import { Quote, Sparkles } from "lucide-react";
import type { QuoteItem } from "../../data/inspirationHubContent";

type Props = {
  quotes: QuoteItem[];
};

export default function DailyWondersSection({ quotes }: Props) {
  const featured = quotes[0];
  const supporting = quotes.slice(1);

  if (!featured) return null;

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/82 shadow-[0_28px_80px_-56px_rgba(15,23,42,0.22)] backdrop-blur-sm">
      <div className="border-b border-slate-200/70 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Daily Wonders
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">
          Uplifting Visual Quotes
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
          Native quote panels keep the page calm, readable, and reliable without depending on third-party embeds or empty frames.
        </p>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <article className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-[linear-gradient(160deg,rgba(254,249,195,0.82),rgba(204,251,241,0.74)_45%,rgba(255,255,255,0.96)_100%)] px-5 py-6 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.24)] sm:px-6 sm:py-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-600">
            <Quote className="h-3.5 w-3.5 text-amber-600" />
            {featured.eyebrow}
          </div>
          <p className="mt-6 max-w-2xl text-[1.45rem] font-black leading-9 tracking-tight text-slate-950 sm:text-[1.85rem] sm:leading-[2.7rem]">
            &ldquo;{featured.quote}&rdquo;
          </p>
          <p className="mt-5 max-w-xl text-sm leading-6 text-slate-600 sm:text-[15px]">
            {featured.support}
          </p>
        </article>

        <div className="grid gap-4">
          {supporting.map((quote, index) => (
            <article
              key={quote.id}
              className="rounded-[24px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.18)]"
            >
              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
                {quote.eyebrow}
              </div>
              <p className="mt-3 text-base font-bold leading-7 tracking-tight text-slate-900">
                &ldquo;{quote.quote}&rdquo;
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{quote.support}</p>
              <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Card {index + 1}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
