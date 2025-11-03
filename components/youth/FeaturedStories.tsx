import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { YouthStory } from '../../utils/youthData';

type Props = {
  stories: YouthStory[];
};

export default function FeaturedStories({ stories }: Props) {
  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">🔥 Trending in Youth Pulse</h2>
          <p className="mt-1 text-gray-600 dark:text-gray-300">Fresh picks for curious minds.</p>
        </div>
        <Link href="/news" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          View all →
        </Link>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stories.map((s) => (
          <article
            key={s.id}
            className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition"
          >
            <div className="relative aspect-[16/9] bg-gray-100 dark:bg-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.image}
                alt={s.title}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  if (target.src.includes('/images/placeholder-16x9.svg')) return;
                  target.src = '/images/placeholder-16x9.svg';
                }}
              />
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                <span>#{s.category}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500 dark:text-gray-400">{s.date}</span>
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
