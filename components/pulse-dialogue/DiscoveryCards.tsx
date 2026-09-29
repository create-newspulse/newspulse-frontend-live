import React from 'react';
import Link from 'next/link';
import { KeyStoryCard } from '../category/CategoryStoryHierarchy';
import { pulseCardView, publicPulsePhoto, type PulseCard, type PulseContributor } from '../../lib/pulseDialogueDiscovery';
import { pulseDialogueArchivePath } from '../../lib/pulseDialogue';
import { trackDiscoveryClick, type DiscoveryEvent } from '../../lib/analytics/articleAnalytics';
import type { RouteLocale } from '../../lib/localizedArticleFields';
import { useI18n } from '../../src/i18n/LanguageProvider';

export function PulseStoryGrid({ items, locale, event }: { items: PulseCard[]; locale: RouteLocale; event?: DiscoveryEvent }) {
  const { t } = useI18n();
  return <div className="grid gap-4 sm:grid-cols-2">
    {items.map((article) => {
      const item = pulseCardView(article, locale, t);
      const click = (clickEvent: React.MouseEvent) => {
        if (event && (clickEvent.target as Element).closest('a')) trackDiscoveryClick(event, item.id, locale);
      };
      return <div key={item.id} onClick={click} onAuxClick={click}><KeyStoryCard item={item} locale={false} /></div>;
    })}
  </div>;
}

export function VoiceCard({ contributor, locale, featured = false }: { contributor: PulseContributor; locale: RouteLocale; featured?: boolean }) {
  const [failed, setFailed] = React.useState(false);
  const photo = publicPulsePhoto(contributor.photoUrl);
  React.useEffect(() => setFailed(false), [photo]);
  const track = () => trackDiscoveryClick(featured ? 'featured_voice_click' : 'contributor_profile_click', contributor.slug, locale);
  return <Link href={pulseDialogueArchivePath('contributors', contributor.slug, locale)} locale={false} onClick={track} onAuxClick={track}
    className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-newsPulse-navy hover:border-newsPulse-blue focus-visible:ring-2 focus-visible:ring-newsPulse-blue">
    {photo && !failed ? <img src={photo} alt={contributor.name} width={48} height={48} loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" onError={() => setFailed(true)} /> : null}
    <span className="min-w-0 break-words"><span className="block font-bold">{contributor.name}</span>
      {contributor.publicDesignation ? <span className="mt-1 block text-sm text-newsPulse-slate">{contributor.publicDesignation}</span> : null}</span>
  </Link>;
}