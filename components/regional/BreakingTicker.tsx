import Link from 'next/link';
import React, { useId, useMemo } from 'react';
import { useI18n } from '../../src/i18n/LanguageProvider';

function classNames(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

export type BreakingTickerItem = {
  _id: string;
  title?: string;
  category?: any;
  tags?: any;
  createdAt?: string;
  publishedAt?: string;
};

export type BreakingTickerProps = {
  items: BreakingTickerItem[];
  variant?: 'breaking' | 'live';
  emptyText?: string;
  className?: string;
};

function normalizeTag(t: unknown): string {
  return String(t || '').trim().toLowerCase();
}

function toTagList(tags: any): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(normalizeTag).filter(Boolean);
  if (typeof tags === 'string') {
    return tags
      .split(/[;,|]/g)
      .map((s) => normalizeTag(s))
      .filter(Boolean);
  }
  return [];
}

export default function BreakingTicker({
  items,
  variant = 'breaking',
  emptyText = 'No breaking news right now — stay tuned',
  className,
}: BreakingTickerProps) {
  const { lang } = useI18n();
  const tickerLang = lang === 'gu' ? 'gu' : lang === 'hi' ? 'hi' : 'en';
  const id = useId().replace(/:/g, '');

  const safeItems = useMemo(() => {
    if (items && items.length) return items;
    return [];
  }, [items]);

  const messages = useMemo(() => {
    if (!safeItems.length) return [emptyText];
    return safeItems.map((it) => {
      const title = String(it?.title || '').trim();
      if (title) return title;

      const tags = toTagList(it?.tags);
      return tags.length ? tags[0] : 'Update';
    });
  }, [emptyText, safeItems]);

  // Duplicate list to get a seamless loop.
  const loop = useMemo(() => messages.concat(messages), [messages]);

  const isBreaking = variant === 'breaking';
  const label = isBreaking ? 'BREAKING' : 'LIVE';
  const viewAllHref = '/breaking';

  return (
    <div
      className={classNames(
        'border-b text-white',
        isBreaking ? 'border-red-700 bg-red-600' : 'border-slate-700 bg-slate-900',
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-white" />
          <span className="text-xs font-black tracking-widest">{label}</span>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div className={classNames(`np-marquee-${id}`, 'flex gap-10 text-sm font-medium')}
          >
            {loop.map((t, i) => (
              <span key={`${id}-${i}`} className="tickerText whitespace-nowrap" lang={tickerLang}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <Link
          href={viewAllHref}
          className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25"
        >
          View all
        </Link>
      </div>

      <style>{`
        .np-marquee-${id} { width: max-content; animation: np-marquee-${id} 22s linear infinite; }
        @keyframes np-marquee-${id} { from { transform: translateX(0);} to { transform: translateX(-50%);} }
      `}</style>
    </div>
  );
}
