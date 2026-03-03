import Link from 'next/link';
import { useRouter } from 'next/router';
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

  const outerPad = variant === 'page' ? 'py-3' : 'py-2';
  const titleSize = variant === 'page' ? 'text-xl md:text-2xl' : 'text-lg md:text-xl';

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className={`mx-auto max-w-7xl px-4 md:px-6 ${outerPad}`}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-1 rounded-full bg-red-600" />
            <div className="min-w-0">
              <div className={`font-extrabold leading-tight truncate ${titleSize}`}>{iconFor(categorySlug)} {title}</div>
              {subtitle ? <div className="text-xs text-slate-600">{subtitle}</div> : null}
            </div>

            {showBrowseStates ? (
              <Link href={browseStatesHref} className="ml-2 text-sm font-semibold text-blue-600 hover:underline whitespace-nowrap">
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
                  placeholder={searchPlaceholder || `Search ${title}…`}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
