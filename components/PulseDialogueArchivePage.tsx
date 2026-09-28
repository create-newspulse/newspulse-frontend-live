import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { KeyStoryCard } from './category/CategoryStoryHierarchy';
import { pulseDialogueArchivePath } from '../lib/pulseDialogue';
import { safeJsonLd } from '../lib/seo';
import { useI18n } from '../src/i18n/LanguageProvider';
import type { DialogueArchiveProps } from '../server/pulseDialogueArchive';

function ContributorPhoto({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = React.useState(false);
  const imageRef = React.useRef<HTMLImageElement>(null);
  React.useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (failed) return null;
  return <img ref={imageRef} src={src} alt={name} width={96} height={96} className="h-24 w-24 shrink-0 rounded-full object-cover" onError={() => setFailed(true)} />;
}

export default function PulseDialogueArchivePage({ locale, contributor, series, kind, items, pagination, seo, error }: DialogueArchiveProps) {
  const { t } = useI18n();
  const label = (key: string) => t(`pulseDialogue.archive.${key}`);
  if (error) return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Head><title>{seo.title}</title><meta name="robots" content="noindex, nofollow" /></Head>
      <h1 className="text-2xl font-bold text-newsPulse-navy">{label('unavailable')}</h1>
      <p className="mt-3 text-newsPulse-slate">{label('tryAgain')}</p>
    </main>
  );
  const slug = contributor?.slug || series!.slug;
  const owner = series?.ownerContributor;
  const path = (page: number) => pulseDialogueArchivePath(kind, slug, locale, page);
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6">
      <Head>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:url" content={seo.canonicalUrl} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(seo.jsonLd) }} />
      </Head>
      <Link href="/pulse-dialogue" locale={locale} className="text-sm font-semibold text-newsPulse-blue hover:underline">{t('categories.pulseDialogue')}</Link>
      <header className="mt-6 flex flex-col gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-start">
        {contributor?.photoUrl ? <ContributorPhoto key={contributor.photoUrl} src={contributor.photoUrl} name={contributor.name} /> : null}
        <div className="min-w-0 flex-1 break-words">
          <h1 className="text-3xl font-bold leading-tight text-newsPulse-navy">{contributor?.name || series?.title}</h1>
          {contributor?.publicDesignation ? <p className="mt-2 text-newsPulse-slate">{contributor.publicDesignation}</p> : null}
          {contributor?.shortBio ? <p className="mt-3 max-w-3xl whitespace-pre-line leading-7 text-newsPulse-slate">{contributor.shortBio}</p> : null}
          {series?.description ? <p className="mt-3 max-w-3xl whitespace-pre-line leading-7 text-newsPulse-slate">{series.description}</p> : null}
          {owner ? <p className="mt-3 text-newsPulse-slate">
            {owner.slug ? <Link href={pulseDialogueArchivePath('contributors', owner.slug, locale)} locale={false} className="text-newsPulse-blue hover:underline">{owner.name}</Link> : owner.name}
          </p> : null}
          <p className="mt-4 font-semibold text-newsPulse-navy">{contributor?.contributionCount ?? series?.articleCount} {label(contributor ? 'contributions' : 'articles')}</p>
          <a href="#contributions" className="mt-3 inline-block text-sm font-semibold text-newsPulse-blue hover:underline">{label('viewContributions')}</a>
        </div>
      </header>
      <section id="contributions" className="scroll-mt-6 py-7" aria-labelledby="contributions-title">
        <h2 id="contributions-title" className="mb-5 text-xl font-bold text-newsPulse-navy">{t('pulseDialogue.landing.latestContributions')}</h2>
        {items.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => <KeyStoryCard key={item.id} item={item} locale={false} />)}
        </div> : <p className="py-8 text-newsPulse-slate">{label(pagination.totalPages > 0 ? 'emptyPage' : 'empty')}</p>}
        {pagination.page > 1 || pagination.hasNextPage ? <nav aria-label={label('pagination')} className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 text-sm font-semibold">
          {pagination.page > 1 ? <Link href={path(pagination.page - 1)} locale={false} className="inline-flex items-center gap-2 text-newsPulse-blue hover:underline"><ArrowLeft size={18} aria-hidden="true" />{label('previous')}</Link> : <span />}
          <span>{label('page')} {pagination.page}{pagination.totalPages > 0 ? ` / ${pagination.totalPages}` : ''}</span>
          {pagination.hasNextPage ? <Link href={path(pagination.page + 1)} locale={false} className="inline-flex items-center gap-2 text-newsPulse-blue hover:underline">{label('next')}<ArrowRight size={18} aria-hidden="true" /></Link> : <span />}
        </nav> : null}
      </section>
    </main>
  );
}