import Link from 'next/link';
import { useRouter } from 'next/router';
import { Newspaper } from 'lucide-react';
import React from 'react';

export type CategoryHeaderVariant = 'page' | 'compact';

export type CategoryHeaderProps = {
  categorySlug: string;
  title: string;
  subtitle?: string;
  langPrefix: '' | '/hi' | '/gu' | '/en';
  variant?: CategoryHeaderVariant;
  showBrowseStates?: boolean;
  browseStatesLabel?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
};

function normalizePrefix(prefix: string): '' | '/hi' | '/gu' | '/en' {
  const p = String(prefix || '').trim();
  if (p === '/hi' || p === '/gu' || p === '/en') return p;
  return '';
}

function withPrefix(prefix: '' | '/hi' | '/gu' | '/en', path: string): string {
  const cleanPath = String(path || '/').startsWith('/') ? String(path || '/') : `/${path}`;
  if (!prefix) return cleanPath;
  if (cleanPath === '/') return prefix;
  return `${prefix}${cleanPath}`;
}

function categoryBasePath(categorySlug: string): string {
  const slug = String(categorySlug || '').toLowerCase().trim();
  if (!slug) return '/';

  // Regional is implemented as Gujarat landing in this repo.
  if (slug === 'regional') return '/regional/gujarat';

  return `/${slug}`;
}

function iconFor(categorySlug: string): string {
  const slug = String(categorySlug || '').toLowerCase().trim();
  switch (slug) {
    case 'national':
      return '🏛️';
    case 'regional':
      return '🗺️';
    case 'international':
      return '🌍';
    case 'business':
      return '💼';
    case 'sports':
      return '🏅';
    case 'science-technology':
      return '🧪';
    case 'entertainment':
    case 'glamour':
      return '🎬';
    case 'lifestyle':
      return '🌿';
    default:
      return '📰';
  }
}

const EDITORIAL_COPY: Record<'en' | 'hi' | 'gu', { title: string; subtitle: string; searchPlaceholder: string }> = {
  en: {
    title: 'Editorial',
    subtitle: 'In-depth Editorials and Special Stories from News Pulse.',
    searchPlaceholder: 'Search Editorials and Special Stories...',
  },
  hi: {
    title: 'संपादकीय',
    subtitle: 'न्यूज़ पल्स के गहन संपादकीय और विशेष लेख।',
    searchPlaceholder: 'संपादकीय और विशेष लेख खोजें...',
  },
  gu: {
    title: 'સંપાદકીય',
    subtitle: 'ન્યૂઝ પલ્સના વિશ્લેષણાત્મક સંપાદકીય અને વિશેષ લેખો.',
    searchPlaceholder: 'સંપાદકીય અને વિશેષ લેખો શોધો...',
  },
};

function langFromPrefix(prefix: '' | '/hi' | '/gu' | '/en'): 'en' | 'hi' | 'gu' {
  if (prefix === '/hi') return 'hi';
  if (prefix === '/gu') return 'gu';
  return 'en';
}

export default function CategoryHeader({
  categorySlug,
  title,
  subtitle,
  langPrefix,
  variant = 'compact',
  showBrowseStates = false,
  browseStatesLabel,
  showSearch = false,
  searchPlaceholder,
}: CategoryHeaderProps) {
  const router = useRouter();
  const [q, setQ] = React.useState('');

  const prefix = normalizePrefix(langPrefix);
  const basePath = categoryBasePath(categorySlug);
  const categoryHref = withPrefix(prefix, basePath);
  const browseStatesHref = withPrefix(prefix, '/national/states');
  const isEditorial = String(categorySlug || '').toLowerCase().trim() === 'editorial';
  const editorialCopy = EDITORIAL_COPY[langFromPrefix(prefix)];
  const displayTitle = isEditorial ? editorialCopy.title : title;
  const displaySubtitle = isEditorial ? editorialCopy.subtitle : subtitle;
  const displaySearchPlaceholder = isEditorial ? editorialCopy.searchPlaceholder : (searchPlaceholder || `Search ${title}…`);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = String(q || '').trim();
    if (!query) {
      router.push(categoryHref).catch(() => {});
      return;
    }

    const next = `${categoryHref}?search=${encodeURIComponent(query)}`;
    router.push(next).catch(() => {});
  };

  const outerPad = isEditorial ? 'py-3' : (variant === 'page' ? 'py-3' : 'py-2');
  const titleSize = isEditorial ? 'text-[26px] md:text-[28px]' : (variant === 'page' ? 'text-xl md:text-2xl' : 'text-lg md:text-xl');
  const accentClass = categorySlug === 'breaking' ? 'bg-newsPulse-red' : 'bg-newsPulse-blue';

  return (
    <div className="border-b border-newsPulse-slate/25 bg-newsPulse-white">
      <div className={`mx-auto max-w-7xl px-4 md:px-6 ${outerPad}`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`${isEditorial ? 'h-14' : 'h-9'} w-1 rounded-full ${accentClass}`} />
            <div className="min-w-0">
              <div className={`flex min-w-0 items-center gap-2 font-bold leading-tight text-newsPulse-navy ${titleSize}`}>
                {isEditorial ? <Newspaper className="h-6 w-6 shrink-0 text-newsPulse-blue" aria-hidden="true" /> : <span aria-hidden="true">{iconFor(categorySlug)}</span>}
                <span className="truncate">{displayTitle}</span>
              </div>
              {displaySubtitle ? <div className="mt-1 text-sm text-newsPulse-slate">{displaySubtitle}</div> : null}
            </div>

            {showBrowseStates ? (
              <Link href={browseStatesHref} className="ml-2 text-sm font-semibold text-newsPulse-blue hover:underline whitespace-nowrap">
                {browseStatesLabel || 'Browse states →'}
              </Link>
            ) : null}
          </div>

          {showSearch ? (
            <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="w-full sm:w-80">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={displaySearchPlaceholder}
                  className="w-full rounded-xl border border-newsPulse-slate/25 bg-newsPulse-white px-3 py-2 text-sm text-newsPulse-navy outline-none focus:ring-2 focus:ring-newsPulse-blue/20"
                />
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
