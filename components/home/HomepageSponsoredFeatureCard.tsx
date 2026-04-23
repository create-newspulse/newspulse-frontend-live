import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import type { HomepageSponsoredFeature } from '../../lib/publicSponsoredFeature';
import StoryImage from '../../src/components/story/StoryImage';

type HomepageSponsoredFeatureCardProps = {
  theme: {
    mode?: string;
    surface?: string;
    surface2?: string;
    border?: string;
    text?: string;
    sub?: string;
  };
  feature: HomepageSponsoredFeature;
};

export default function HomepageSponsoredFeatureCard({ theme, feature }: HomepageSponsoredFeatureCardProps) {
  const lineClamp2 = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  };

  const lineClamp3 = {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
  };

  const content = (
    <div
      className="group overflow-hidden rounded-[26px] border shadow-[0_20px_48px_-38px_rgba(15,23,42,0.28)] transition hover:translate-y-[-1px]"
      style={{ background: theme.surface, borderColor: theme.border }}
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: theme.border }}>
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Sponsored Feature</div>
          <div className="truncate text-[13px] font-semibold" style={{ color: theme.text }}>
            {feature.sponsorName}
          </div>
        </div>
        <div className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700" style={{ borderColor: 'rgba(245,158,11,0.24)', background: 'rgba(255,251,235,0.92)' }}>
          Partner
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1.55fr)_220px] sm:items-center sm:p-5">
        <div className="order-2 sm:order-1 min-w-0">
          <h2 className="text-[1.2rem] font-extrabold leading-[1.22] tracking-[-0.015em] sm:text-[1.42rem]" style={{ color: theme.text, ...lineClamp2 }}>
            {feature.headline}
          </h2>

          <p className="mt-3 text-[14px] leading-6" style={{ color: theme.sub, ...lineClamp3 }}>
            {feature.shortSummary}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-700 px-3.5 py-2 text-sm font-semibold text-white transition group-hover:bg-amber-800">
              {feature.ctaLabel} <ArrowRight className="h-4 w-4" />
            </div>
            {feature.sponsorDisclosure ? (
              <div className="min-w-0 text-[11px] font-medium leading-5 text-amber-700/90" style={lineClamp2}>
                {feature.sponsorDisclosure}
              </div>
            ) : null}
          </div>
        </div>

        <div className="order-1 sm:order-2 sm:justify-self-end">
          <StoryImage
            storyId={feature.linkedArticleId || feature.linkedArticleSlug || feature.headline}
            src={feature.imageSrc}
            alt={feature.headline}
            variant="card"
            className="max-w-full rounded-[22px] sm:w-[220px]"
          />
        </div>
      </div>
    </div>
  );

  if (feature.destinationIsExternal) {
    return (
      <a href={feature.href} target="_blank" rel="sponsored noopener noreferrer" className="block">
        {content}
      </a>
    );
  }

  return (
    <Link href={feature.href} className="block">
      {content}
    </Link>
  );
}