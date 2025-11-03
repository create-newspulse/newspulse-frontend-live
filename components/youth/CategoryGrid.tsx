import React from 'react';
import Link from 'next/link';
import type { YouthCategory } from '../../utils/youthData';

type Props = {
  categories: YouthCategory[];
};

export default function CategoryGrid({ categories }: Props) {
  return (
    <section className="mt-10" id="youth-categories">
      <h2 className="text-2xl sm:text-3xl font-bold">Explore Topics</h2>
      <p className="mt-1 text-gray-600 dark:text-gray-300">Pick a track you vibe with.</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <Link key={cat.slug} href={`/youth-pulse/${cat.slug}`} className="group">
            <div
              className="relative h-full overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm hover:shadow-md transition-transform duration-200 group-hover:-translate-y-0.5"
            >
              <div
                className="absolute inset-x-0 -top-px h-1"
                style={{
                  backgroundImage: `linear-gradient(90deg, ${cat.fromHex}, ${cat.toHex})`,
                }}
              />
              <div className="flex items-start gap-3">
                <div className="text-2xl" aria-hidden>
                  {cat.emoji}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {cat.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
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
