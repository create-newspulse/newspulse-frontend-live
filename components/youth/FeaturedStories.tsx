import React from 'react';
import Link from 'next/link';
import type { YouthStory } from '../../utils/youthData';
import { StoryImage } from '../../src/components/story/StoryImage';

type Props = {
  stories: YouthStory[];
  error?: string | null;
  id?: string;
  title?: string;
  description?: string;
  emptyMessage?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export default function FeaturedStories({
  stories,
  error,
  id = 'trending',
  title = 'Latest in Youth Pulse',
  description = 'Published News Pulse stories from the Youth Pulse desk.',
  emptyMessage = 'No Youth Pulse stories are live right now.',
  ctaHref,
  ctaLabel,
}: Props) {
  return (
    <section id={id} className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">{title}</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-300">
            {error ? error : description}
          </p>
        </div>
        {ctaHref && ctaLabel ? (
          <Link href={ctaHref} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            {ctaLabel}
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stories.length === 0 ? (
          <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-5 text-sm text-gray-600 dark:text-gray-300">
            {emptyMessage}
          </div>
        ) : null}

        {stories.map((s) => (
          <article
            key={s.id}
            className="group relative rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition hover:shadow-md"
          >
            <StoryImage
              src={s.image}
              alt={s.title}
              variant="top"
              className="w-full rounded-t-2xl rounded-b-none"
            />
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                {s.editorialLabel ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {s.editorialLabel}
                  </span>
                ) : null}
                <span className="text-indigo-600">{s.categoryLabel || s.category}</span>
                {s.date ? <span className="text-gray-400">•</span> : null}
                {s.date ? <span className="text-gray-500 dark:text-gray-400">{s.date}</span> : null}
              </div>
              <h3 className="mt-2 text-lg font-bold leading-snug">{s.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-3">{s.summary}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
