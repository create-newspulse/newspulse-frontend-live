import React from 'react';

type Props = {
  onExplore: () => void;
  onSubmit: () => void;
};

export default function YouthHero({ onExplore, onSubmit }: Props) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-xl">
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-16 -left-20 h-72 w-72 rounded-full bg-black/10 blur-3xl" />

      <div className="relative px-6 py-16 sm:px-10 sm:py-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">🎓 Youth Pulse</h1>
        <p className="mt-3 text-lg sm:text-xl text-white/90">
          Your daily pulse on student life, exams & achievers.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onExplore}
            className="rounded-full bg-white text-indigo-700 px-6 py-3 font-semibold shadow hover:shadow-md transition active:scale-[0.98]"
          >
            🔥 Explore Topics
          </button>
          <button
            onClick={onSubmit}
            className="rounded-full border border-white/70 px-6 py-3 font-semibold text-white hover:bg-white/10 transition"
          >
            📝 Submit Your Story
          </button>
        </div>
      </div>
    </section>
  );
}
