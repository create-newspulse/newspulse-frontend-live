import React from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { getPulseDialogueMetadata, pulseDialogueArchivePath } from '../../lib/pulseDialogue';
import { readPulse, uniquePulseStories, type PulseCard, type PulsePage } from '../../lib/pulseDialogueDiscovery';
import { trackDiscoveryClick } from '../../lib/analytics/articleAnalytics';
import type { RouteLocale } from '../../lib/localizedArticleFields';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { PulseStoryGrid } from './DiscoveryCards';

const NO_EXCLUDED_STORIES: PulseCard[] = [];

export default function RelatedContributions({ article, locale, excludedStories = NO_EXCLUDED_STORIES }: { article: PulseCard; locale: RouteLocale; excludedStories?: PulseCard[] }) {
  const { t } = useI18n();
  const metadata = getPulseDialogueMetadata(article);
  const contributor = metadata?.profileAvailable ? metadata.contributorSlug : '';
  const series = metadata && typeof (article.pulseDialogue as any)?.seriesSlug === 'string' ? (article.pulseDialogue as any).seriesSlug : '';
  const sentinel = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const [groups, setGroups] = React.useState<{ contributor: PulseCard[]; series: PulseCard[] }>({ contributor: [], series: [] });
  React.useEffect(() => {
    if (!contributor && !series) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '400px' });
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [contributor, series]);
  React.useEffect(() => {
    if (!visible || (!contributor && !series)) return;
    const controller = new AbortController();
    const load = (kind: string, slug: string) => slug
      ? readPulse<PulsePage<PulseCard>>(`${kind}/${encodeURIComponent(slug)}/articles`, locale, { page: '1', limit: '4' }, controller.signal)
      : Promise.resolve(null);
    setFailed(false);
    Promise.allSettled([load('contributors', contributor), load('series', series)]).then(([voices, columns]) => {
      if (controller.signal.aborted) return;
      const excluded = [article, ...excludedStories];
      setGroups((previous) => {
        const voiceItems = voices.status === 'fulfilled' ? uniquePulseStories(voices.value?.items || [], excluded).slice(0, 3) : voices.reason?.status === 404 ? [] : previous.contributor;
        const seriesItems = columns.status === 'fulfilled' ? uniquePulseStories(columns.value?.items || [], [...excluded, ...voiceItems]).slice(0, 3) : columns.reason?.status === 404 ? [] : previous.series;
        return { contributor: voiceItems, series: seriesItems };
      });
      setFailed([voices, columns].some((result) => result.status === 'rejected' && result.reason?.status !== 404));
    });
    return () => controller.abort();
  }, [visible, contributor, series, locale, revision, article, excludedStories]);
  if (!contributor && !series) return null;
  return <div ref={sentinel} className="mt-6">
    {(['contributor', 'series'] as const).map((kind) => groups[kind].length ? <section key={kind} aria-label={t(`pulseDialogue.discovery.${kind === 'contributor' ? 'moreContributor' : 'moreSeries'}`)} className="border-t border-slate-200 py-5">
      <h2 className="mb-4 text-xl font-bold text-newsPulse-navy"><Link href={pulseDialogueArchivePath(kind === 'contributor' ? 'contributors' : 'series', kind === 'contributor' ? contributor : series, locale)} locale={false}
        onClick={() => trackDiscoveryClick(kind === 'contributor' ? 'contributor_profile_click' : 'series_click', kind === 'contributor' ? contributor : series, locale)} className="hover:underline">
        {t(`pulseDialogue.discovery.${kind === 'contributor' ? 'moreContributor' : 'moreSeries'}`)}</Link></h2>
      <PulseStoryGrid items={groups[kind]} locale={locale} />
    </section> : null)}
    {failed ? <button type="button" onClick={() => setRevision((value) => value + 1)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-newsPulse-navy"><RefreshCw size={16} />{t('pulseDialogue.discovery.retry')}</button> : null}
  </div>;
}