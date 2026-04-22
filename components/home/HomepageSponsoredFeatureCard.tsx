import Link from 'next/link';

import { ArrowRight } from 'lucide-react';

import type { HomepageSponsoredFeature } from '../../lib/publicSponsoredFeature';
import { TopStoryImage } from '../../src/components/story/StoryImage';

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
  const content = (
    <div
      className="group overflow-hidden rounded-[30px] border shadow-[0_24px_64px_-44px_rgba(15,23,42,0.36)] transition hover:translate-y-[-1px]"
      style={{ background: theme.surface, borderColor: theme.border }}
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-6" style={{ borderColor: theme.border }}>
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Sponsored Feature</div>
          <div className="truncate text-sm font-semibold" style={{ color: theme.text }}>
            Presented with {feature.sponsorName}
          </div>
        </div>
        <div className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700" style={{ borderColor: 'rgba(245,158,11,0.24)', background: 'rgba(255,251,235,0.92)' }}>
          Partner
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <TopStoryImage storyId={feature.linkedArticleId || feature.linkedArticleSlug || feature.headline} src={feature.imageSrc} alt={feature.headline} />

        <h2 className="mt-5 text-[1.55rem] font-extrabold leading-[1.18] tracking-[-0.015em] sm:text-[1.75rem]" style={{ color: theme.text }}>
          {feature.headline}
        </h2>

        <p className="mt-4 text-[15px] leading-7" style={{ color: theme.sub }}>
          {feature.shortSummary}
        </p>

        {feature.sponsorDisclosure ? (
          <div
            className="mt-5 rounded-[22px] border px-4 py-3 text-sm leading-6"
            style={{
              borderColor: 'rgba(245,158,11,0.22)',
              background: theme.mode === 'dark' ? 'rgba(120,53,15,0.18)' : 'rgba(255,251,235,0.88)',
              color: theme.sub,
            }}
          >
            {feature.sponsorDisclosure}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4" style={{ borderColor: theme.border }}>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            Homepage partner placement
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition group-hover:bg-amber-800">
            {feature.ctaLabel} <ArrowRight className="h-4 w-4" />
          </div>
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