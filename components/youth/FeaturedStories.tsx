import React from 'react';
import Link from 'next/link';
import type { YouthStory } from '../../features/youthPulse/types';
import { StoryImage } from '../../src/components/story/StoryImage';
import { buildNewsUrl } from '../../lib/newsRoutes';

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
          <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-slate-100">{title}</h2>
          <p className="mt-1 text-slate-600 dark:text-gray-300">
            {error ? error : description}
          </p>
        </div>
        {ctaHref && ctaLabel ? (
          <Link href={ctaHref} className="text-sm font-medium text-teal-700 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200">
            {ctaLabel}
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stories.length === 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            {emptyMessage}
          </div>
        ) : null}

        {stories.map((s) => {
          const fallbackHref = String(s.id || '').trim()
            ? buildNewsUrl({ id: String(s.id), slug: s.slug || String(s.id), lang: s.language })
            : '';
          const href = String(s.href || fallbackHref).trim();
          const cardBody = (
            <>
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
                  <span className="text-teal-700 dark:text-teal-300">{s.categoryLabel || s.category}</span>
                  {s.date ? <span className="text-slate-300">•</span> : null}
                  {s.date ? <span className="text-slate-500 dark:text-gray-400">{s.date}</span> : null}
                </div>
                <h3 className="mt-2 text-lg font-bold leading-snug text-slate-950 dark:text-slate-100">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-gray-300 line-clamp-3">{s.summary}</p>
              </div>
            </>
          );

          return (
            <article
              key={s.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
            >
              {href ? (
                <Link
                  href={href}
                  className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                  aria-label={`Open article: ${s.title}`}
                >
                  {cardBody}
                </Link>
              ) : (
                <div className="h-full" aria-disabled="true">
                  {cardBody}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
