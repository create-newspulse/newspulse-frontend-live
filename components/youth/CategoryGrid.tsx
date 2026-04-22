import React from 'react';
import Link from 'next/link';
import type { YouthCategory } from '../../utils/youthData';

type Props = {
  categories: YouthCategory[];
};

const TRACK_ACCENT_CLASSES: Record<string, string> = {
  'youth-pulse': 'border-t-blue-500',
  'campus-buzz': 'border-t-orange-400',
  'govt-exam-updates': 'border-t-cyan-500',
  'career-boosters': 'border-t-amber-500',
  'young-achievers': 'border-t-fuchsia-500',
  'student-voices': 'border-t-violet-500',
};

export default function CategoryGrid({ categories }: Props) {
  return (
    <section className="mt-10" id="youth-categories">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-slate-100">Tracks inside Youth Pulse</h2>
      <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
        Follow the editorial tracks News Pulse uses to organize student life, campus reporting, exam updates,
        career guidance, achievers, and moderated youth voices.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link key={cat.slug} href={`/youth-pulse/${cat.slug}`} className="group">
            <div
              className={[
                'relative h-full overflow-hidden rounded-2xl border border-slate-200 border-t-4 bg-white p-5 shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:border-slate-300 group-hover:shadow-md dark:border-gray-800 dark:bg-gray-900',
                TRACK_ACCENT_CLASSES[cat.slug] || 'border-t-blue-500',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl" aria-hidden>
                  {cat.emoji}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {cat.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-gray-300">
                    {cat.description}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
