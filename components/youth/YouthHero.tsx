import React from 'react';

type Props = {
  onExplore: () => void;
  onSubmit: () => void;
};

export default function YouthHero({ onExplore, onSubmit }: Props) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_34%),linear-gradient(135deg,_#0f172a_0%,_#155e75_42%,_#f97316_100%)] text-white shadow-xl">
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-16 -left-20 h-72 w-72 rounded-full bg-black/10 blur-3xl" />
      <div className="absolute inset-y-0 right-0 w-1/3 bg-[linear-gradient(180deg,_rgba(255,255,255,0.10),_transparent)]" />

      <div className="relative px-6 py-14 sm:px-10 sm:py-16">
        <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-white/85">
          News Pulse Youth Desk
        </div>
        <h1 className="mt-5 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          Youth Pulse
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-white/90 sm:text-xl">
          A youth-focused News Pulse section covering student life, campus stories, government exam updates,
          career moves, young achievers, and moderated student voices.
        </p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm font-medium text-white/90">
          <span className="rounded-full bg-white/12 px-3 py-1">Campus Buzz</span>
          <span className="rounded-full bg-white/12 px-3 py-1">Govt Exam Updates</span>
          <span className="rounded-full bg-white/12 px-3 py-1">Career Boosters</span>
          <span className="rounded-full bg-white/12 px-3 py-1">Young Achievers</span>
          <span className="rounded-full bg-white/12 px-3 py-1">Student Voices</span>
        </div>

        <div className="mt-6 max-w-2xl rounded-2xl border border-white/15 bg-black/15 px-5 py-4 text-sm leading-6 text-white/90 backdrop-blur-sm">
          Submissions are reviewed by News Pulse before publication.
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            onClick={onExplore}
            className="rounded-full bg-white px-6 py-3 font-semibold text-slate-900 shadow hover:shadow-md transition active:scale-[0.98]"
          >
            Explore Tracks
          </button>
          <button
            onClick={onSubmit}
            className="rounded-full border border-white/70 px-6 py-3 font-semibold text-white hover:bg-white/10 transition"
          >
            Submit for Review
          </button>
        </div>
      </div>
    </section>
  );
}
