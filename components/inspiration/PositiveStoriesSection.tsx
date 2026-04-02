import Link from "next/link";
import { ArrowRight, HeartHandshake } from "lucide-react";
import type { PositiveStoryItem } from "../../data/inspirationHubContent";

type Props = {
  items: PositiveStoryItem[];
};

export default function PositiveStoriesSection({ items }: Props) {
  if (!items.length) return null;

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200/70 bg-white/82 shadow-[0_28px_76px_-56px_rgba(15,23,42,0.20)] backdrop-blur-sm">
      <div className="border-b border-slate-200/70 px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
          <HeartHandshake className="h-4 w-4 text-rose-500" />
          Positive Stories
        </div>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-[2rem]">
          Keep exploring uplifting coverage
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[15px]">
          Continue into feel-good reporting and human-interest reading without dropping into a dead end.
        </p>
      </div>

      <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group rounded-[26px] border border-slate-200/70 bg-white/92 p-5 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_52px_-36px_rgba(15,23,42,0.22)]"
          >
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">
              {item.category}
            </div>
            <h3 className="mt-4 text-xl font-black tracking-tight text-slate-950">
              {item.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {item.summary}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 transition group-hover:text-sky-800">
              Explore this section <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}