import React from 'react';
import Link from 'next/link';
import type { YouthStory } from '../../features/youthPulse/types';
import { StoryImage } from '../../src/components/story/StoryImage';
import { buildNewsUrl } from '../../lib/newsRoutes';

type Props = {
  stories: YouthStory[];
};

function getStoryHref(story: YouthStory): string {
  const explicitHref = String(story.href || '').trim();
  if (explicitHref) return explicitHref;

  const id = String(story.id || '').trim();
  if (!id) return '#';
  return buildNewsUrl({ id, slug: story.slug || id, lang: story.language });
}

export default function YouthSpotlight({ stories }: Props) {
  const usableStories = stories.filter(Boolean);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    if (!usableStories.length) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((current) => Math.min(current, usableStories.length - 1));
  }, [usableStories.length]);

  if (!usableStories.length) return null;

  const activeStory = usableStories[activeIndex];
  const href = getStoryHref(activeStory);
  const canPaginate = usableStories.length > 1;

  const goPrev = () => {
    setActiveIndex((current) => (current === 0 ? usableStories.length - 1 : current - 1));
  };

  const goNext = () => {
    setActiveIndex((current) => (current === usableStories.length - 1 ? 0 : current + 1));
  };

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-800 dark:text-cyan-300">
            Youth Pulse Spotlight
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-slate-100">
            A premium editorial read from the Youth Pulse desk
          </h2>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            A standout Youth Pulse story across campus reporting, civic momentum, innovation, careers, culture, or youth achievement.
          </p>
        </div>
        {canPaginate ? (
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={goPrev}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              aria-label="Previous spotlight story"
            >
              ←
            </button>
            <button
              type="button"
              onClick={goNext}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              aria-label="Next spotlight story"
            >
              →
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_right,_rgba(125,211,252,0.16),_transparent_24%),linear-gradient(140deg,_#0f172a_0%,_#102a56_52%,_#1f4c7a_100%)] text-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.5)] dark:border-slate-800">
        <div className="grid gap-0 lg:grid-cols-[1.6fr_1fr]">
          <Link
            href={href}
            className="group relative block overflow-hidden border-b border-white/10 lg:border-b-0 lg:border-r focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-inset"
          >
            <StoryImage
              src={activeStory.image}
              alt={activeStory.title}
              variant="top"
              className="h-full min-h-[260px] w-full rounded-none lg:min-h-[420px]"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,_rgba(15,23,42,0.08)_0%,_rgba(15,23,42,0.02)_38%,_rgba(15,23,42,0.42)_100%)]" />
            <div className="pointer-events-none absolute left-5 top-5 sm:left-6 sm:top-6">
              <div className="inline-flex rounded-full border border-white/20 bg-slate-950/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/92 backdrop-blur-sm">
                Youth Pulse Spotlight
              </div>
            </div>
          </Link>

          <div className="flex min-w-0 flex-col justify-between p-6 sm:p-8 lg:p-9">
            <div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wide text-sky-100/74">
                {activeStory.editorialLabel ? <span>{activeStory.editorialLabel}</span> : null}
                <span>{activeStory.categoryLabel || activeStory.category}</span>
                {activeStory.date ? <span>{activeStory.date}</span> : null}
              </div>
              <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl xl:text-[2.1rem] xl:leading-[1.08]">
                {activeStory.title}
              </h3>
              <p className="mt-4 text-sm leading-6 text-sky-50/88 sm:text-base sm:leading-7">
                {activeStory.summary || 'A standout Youth Pulse story selected to bring depth, prestige, and momentum to the vertical.'}
              </p>
            </div>

            <div className="mt-7">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href={href}
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  Read story
                </Link>
                <p className="max-w-md text-sm leading-6 text-sky-100/68">
                  Youth Pulse is an editorial vertical first: reported, curated, and selected for public credibility.
                </p>
              </div>

              {canPaginate ? (
                <div className="mt-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {usableStories.map((story, index) => {
                      const isActive = index === activeIndex;
                      return (
                        <button
                          key={String(story.id)}
                          type="button"
                          onClick={() => setActiveIndex(index)}
                          className={[
                            'h-2.5 rounded-full transition',
                            isActive ? 'w-8 bg-white' : 'w-2.5 bg-white/40 hover:bg-white/65',
                          ].join(' ')}
                          aria-label={`Go to spotlight story ${index + 1}`}
                          aria-pressed={isActive}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 sm:hidden">
                    <button
                      type="button"
                      onClick={goPrev}
                      className="rounded-full border border-white/16 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/16"
                      aria-label="Previous spotlight story"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="rounded-full border border-white/16 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/16"
                      aria-label="Next spotlight story"
                    >
                      →
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}