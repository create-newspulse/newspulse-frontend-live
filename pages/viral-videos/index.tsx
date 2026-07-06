import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import { Play } from 'lucide-react';

import { COVER_PLACEHOLDER_SRC } from '../../lib/coverImages';
import { fetchServerPublicFounderToggles } from '../../lib/publicFounderToggles';
import { getPublicViralVideoPosterUrl, normalizePublicViralVideosPayload, resolvePublicViralVideoPlayback, type PublicViralVideo } from '../../lib/publicViralVideos';
import { useI18n } from '../../src/i18n/LanguageProvider';

type Props = {
  messages: any;
  locale: string;
  initialItems: PublicViralVideo[];
  initialError: string;
};

type VideoDateSection = {
  key: string;
  label: string;
  items: PublicViralVideo[];
  previous?: boolean;
};

function detailHref(video: PublicViralVideo): string {
  return `/viral-videos/${encodeURIComponent(video.slug || video.id)}`;
}

function handlePosterError(event: React.SyntheticEvent<HTMLImageElement>) {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug('[ViralVideoLibraryPage] poster failed to load:', event.currentTarget.src);
  }
  if (event.currentTarget.src.endsWith(COVER_PLACEHOLDER_SRC)) return;
  event.currentTarget.src = COVER_PLACEHOLDER_SRC;
}

function readText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(readText).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return [record.slug, record.key, record.name, record.title, record.label, record.type, record.category]
      .map(readText)
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

function normalizeFilterValue(value: unknown): string {
  return readText(value)
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '-')
    .replace(/-videos?$/, '');
}

function isPublishedViralVideo(video: PublicViralVideo): boolean {
  const raw = video.raw || {};
  const type = normalizeFilterValue(raw.type);
  const category = normalizeFilterValue(raw.category || raw.categoryName || video.category);
  return video.status === 'published' && (type === 'viral' || category === 'viral');
}

function getDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKeyFromDate(date: Date): string {
  return getDateKey(date.toISOString());
}

function formatDate(value: string): string {
  if (!value || value === 'unknown') return 'Unknown Date';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Unknown Date';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatVideoDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function groupVideosByPublishedDate(items: PublicViralVideo[]): VideoDateSection[] {
  const now = new Date();
  const todayKey = dateKeyFromDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = dateKeyFromDate(yesterday);
  const todayItems: PublicViralVideo[] = [];
  const yesterdayItems: PublicViralVideo[] = [];
  const previousByDate = new Map<string, PublicViralVideo[]>();

  items.forEach((video) => {
    const key = getDateKey(video.publishedAt);
    if (key === todayKey) {
      todayItems.push(video);
      return;
    }
    if (key === yesterdayKey) {
      yesterdayItems.push(video);
      return;
    }
    const previousItems = previousByDate.get(key) || [];
    previousItems.push(video);
    previousByDate.set(key, previousItems);
  });

  const sections: VideoDateSection[] = [];
  if (todayItems.length) sections.push({ key: 'today', label: 'Today', items: todayItems });
  if (yesterdayItems.length) sections.push({ key: 'yesterday', label: 'Yesterday', items: yesterdayItems });

  Array.from(previousByDate.entries()).forEach(([key, previousItems]) => {
    sections.push({ key, label: formatDate(key), items: previousItems, previous: true });
  });

  return sections;
}

function LoadingSkeletonCards() {
  return (
    <section className="py-7" aria-label="Loading viral videos">
      <div className="mb-4 h-7 w-28 rounded bg-white/10" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="overflow-hidden rounded-lg border border-white/10 bg-white/7">
            <div className="aspect-[9/16] animate-pulse bg-white/10" />
            <div className="space-y-3 p-3.5">
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="h-4 w-full rounded bg-white/12" />
              <div className="h-4 w-2/3 rounded bg-white/12" />
              <div className="h-3 w-5/6 rounded bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const featureToggles = await fetchServerPublicFounderToggles();

  if (featureToggles.viralVideosFrontendEnabled === false) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const locale = (ctx.locale || 'en') as string;
  const { getMessages } = await import('../../lib/getMessages');
  const messages = await getMessages(locale);
  let initialItems: PublicViralVideo[] = [];
  let initialError = '';

  try {
    const host = String(ctx.req.headers.host || '').trim();
    const protocolHeader = String(ctx.req.headers['x-forwarded-proto'] || '').split(',')[0]?.trim();
    const protocol = protocolHeader || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
    if (!host) throw new Error('Missing request host');

    const response = await fetch(`${protocol}://${host}/api/viral-videos?period=all`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    const normalized = normalizePublicViralVideosPayload(payload);

    if (!response.ok || normalized.ok === false) {
      initialError = 'Unable to load viral videos right now. Please try again later.';
    } else if (normalized.settings.frontendEnabled !== false) {
      initialItems = normalized.items.filter(isPublishedViralVideo);
    }
  } catch {
    initialError = 'Unable to load viral videos right now. Please try again later.';
  }

  return {
    props: {
      messages,
      locale,
      initialItems,
      initialError,
    },
  };
};

export default function ViralVideoLibraryPage({ initialItems, initialError }: Props) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<PublicViralVideo[]>(initialItems);
  const [loaded, setLoaded] = React.useState(true);
  const [error, setError] = React.useState<string | null>(initialError || null);
  const title = t('categories.viralVideos') || 'Viral Videos';
  const groupedSections = React.useMemo(() => groupVideosByPublishedDate(items), [items]);

  React.useEffect(() => {
    const controller = new AbortController();

    (async () => {
      const response = await fetch('/api/viral-videos?period=all', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      const normalized = normalizePublicViralVideosPayload(payload);

      if (!response.ok || normalized.ok === false) {
        setItems([]);
        setError('Unable to load viral videos right now. Please try again later.');
        return;
      }

      const libraryItems = normalized.settings.frontendEnabled === false
        ? []
        : normalized.items.filter(isPublishedViralVideo);
      setItems(libraryItems);
      setError(null);
      setLoaded(true);
    })().catch(() => {
      if (controller.signal.aborted) return;
      setItems([]);
      setError('Unable to load viral videos right now. Please try again later.');
      setLoaded(true);
    });

    return () => controller.abort();
  }, []);

  const renderVideoCard = (video: PublicViralVideo) => {
    const posterSrc = getPublicViralVideoPosterUrl(video) || COVER_PLACEHOLDER_SRC;
    const playback = resolvePublicViralVideoPlayback(video);
    const dateLabel = formatVideoDate(video.publishedAt);

    return (
      <Link key={video.id} href={detailHref(video)} className="group overflow-hidden rounded-lg border border-white/10 bg-white/7 text-white shadow-[0_18px_42px_-34px_rgba(0,0,0,0.95)] transition hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
        <div className="relative aspect-[9/16] overflow-hidden bg-[#111318]">
          <img src={posterSrc} alt={video.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" loading="lazy" decoding="async" onError={handlePosterError} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.24)_0%,rgba(2,6,23,0.06)_38%,rgba(2,6,23,0.86)_100%)]" />
          <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white shadow-xl ring-1 ring-white/30 backdrop-blur transition group-hover:scale-105 group-hover:bg-white/26" aria-hidden="true">
            <Play className="ml-0.5 h-6 w-6 fill-current" />
          </span>
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/72">
            <span>News Pulse</span>
            <span>{playback.mode === 'direct' ? 'Video' : playback.mode === 'youtube' ? 'YouTube' : 'Clip'}</span>
          </div>
        </div>
        <div className="p-3.5">
          {dateLabel ? <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/42">{dateLabel}</div> : null}
          <h2 className="line-clamp-2 text-base font-black leading-snug text-white">{video.title}</h2>
          {video.summary ? <p className="mt-2 line-clamp-2 text-sm font-medium leading-5 text-white/56">{video.summary}</p> : null}
        </div>
      </Link>
    );
  };

  return (
    <>
      <Head>
        <title>{`${title} | ${t('brand.name')}`}</title>
      </Head>

      <main className="relative min-h-screen overflow-hidden bg-[#111214] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0)_22%,rgba(0,0,0,0.28)_100%)]" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-10 pt-5 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/46">News Pulse</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-white sm:text-4xl">{title}</h1>
            </div>
            <p className="max-w-md text-sm font-semibold leading-6 text-white/62 sm:text-right">Videos uploaded and approved by News Pulse.</p>
          </header>

          {error ? (
            <div className="mx-auto mt-10 w-full max-w-2xl rounded-lg border border-white/12 bg-white/8 p-6 text-center">
              <div className="text-base font-black text-white">{error}</div>
            </div>
          ) : !loaded ? (
            <LoadingSkeletonCards />
          ) : items.length === 0 ? (
            <div className="mx-auto mt-10 w-full max-w-2xl rounded-lg border border-white/12 bg-white/8 p-6 text-center">
              <div className="text-base font-black text-white">No viral videos uploaded yet. Please check back soon.</div>
            </div>
          ) : (
            <section className="py-7">
              {groupedSections.map((section, sectionIndex) => (
                <div key={section.key} className={sectionIndex === 0 ? '' : 'mt-10'}>
                  {section.previous && groupedSections[sectionIndex - 1]?.previous !== true ? (
                    <h2 className="mb-5 text-2xl font-black tracking-normal text-white">Previous Viral Videos</h2>
                  ) : null}
                  <h3 className="mb-4 text-xl font-black tracking-normal text-white">{section.label}</h3>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {section.items.map(renderVideoCard)}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
