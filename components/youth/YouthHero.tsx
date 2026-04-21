import React from 'react';

type Props = {
  onExplore: () => void;
  onGoToSubmissionForm: () => void;
};

export default function YouthHero({ onExplore, onGoToSubmissionForm }: Props) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_32%),radial-gradient(circle_at_78%_24%,_rgba(125,211,252,0.24),_transparent_28%),linear-gradient(138deg,_#0b132b_0%,_#12386b_48%,_#f97360_100%)] text-white shadow-[0_28px_80px_-34px_rgba(15,23,42,0.45)]">
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-200/20 blur-3xl" />
      <div className="absolute -bottom-16 -left-20 h-72 w-72 rounded-full bg-orange-200/15 blur-3xl" />
      <div className="absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(180deg,_rgba(255,255,255,0.14),_transparent)]" />

      <div className="relative px-6 py-11 sm:px-10 sm:py-12">
        <div className="inline-flex rounded-full border border-white/25 bg-white/12 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          News Pulse Youth Vertical
        </div>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          Youth Pulse
        </h1>
        <p className="mt-3 max-w-3xl text-lg leading-8 text-white/92 sm:text-xl">
          News Pulse&apos;s editorial home for the next generation&apos;s ideas, achievements, concerns, momentum,
          and youth-relevant reporting across campus life, careers, exams, innovation, and civic change.
        </p>

        <p className="mt-3 max-w-2xl text-base leading-7 text-sky-50/88 sm:text-lg">
          Built as a living public vertical first, Youth Pulse highlights published reporting, credible youth voices,
          and moderated contributions that earn their place on the News Pulse desk.
        </p>

        <div className="mt-5 flex flex-wrap gap-3 text-sm font-medium text-white/95">
          <span className="rounded-full border border-white/16 bg-slate-950/20 px-3 py-1.5 backdrop-blur-sm">Campus Buzz</span>
          <span className="rounded-full border border-white/16 bg-slate-950/20 px-3 py-1.5 backdrop-blur-sm">Govt Exam Updates</span>
          <span className="rounded-full border border-white/16 bg-slate-950/20 px-3 py-1.5 backdrop-blur-sm">Career Boosters</span>
          <span className="rounded-full border border-white/16 bg-slate-950/20 px-3 py-1.5 backdrop-blur-sm">Young Achievers</span>
          <span className="rounded-full border border-white/16 bg-slate-950/20 px-3 py-1.5 backdrop-blur-sm">Student Voices</span>
        </div>

        <div className="mt-5 max-w-3xl rounded-2xl border border-white/16 bg-slate-950/18 px-5 py-3 text-sm leading-6 text-sky-50/92 backdrop-blur-sm">
          Published Youth Pulse stories are selected, edited, and reviewed by News Pulse. Contributions are open,
          but editorial value leads the experience.
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            onClick={onExplore}
            className="rounded-full bg-white px-6 py-3 font-semibold text-slate-950 shadow-[0_14px_30px_-18px_rgba(15,23,42,0.55)] hover:bg-slate-50 hover:shadow-[0_18px_36px_-18px_rgba(15,23,42,0.58)] transition active:scale-[0.98]"
          >
            Explore Tracks
          </button>
          <button
            onClick={onGoToSubmissionForm}
            className="rounded-full border border-white/30 bg-white/8 px-6 py-3 font-semibold text-white hover:bg-white/14 transition backdrop-blur-sm"
          >
            Go to Submission Form
          </button>
        </div>
      </div>
    </section>
  );
}
