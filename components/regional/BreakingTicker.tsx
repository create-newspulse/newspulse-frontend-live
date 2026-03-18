import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useId, useMemo } from 'react';
import { usePublicTickerAds } from '../../hooks/usePublicTickerAds';
import { useI18n } from '../../src/i18n/LanguageProvider';
import { usePublicSettings } from '../../src/context/PublicSettingsContext';
import {
  mergeTickerItemsWithAds,
  type TickerMarqueeItem,
} from '../../lib/publicTickerAds';
import { isSafeMode } from '../../utils/safeMode';

type TickerRenderItem =
  | { id: string; type: 'news'; message: string }
  | { id: string; type: 'ad'; message: string; url: string | null };

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
  /** Backend speed in seconds (will be clamped to a safe range). */
  speedSeconds?: number;
};

function clampSeconds(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(300, Math.max(10, n));
}

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
  emptyText,
  className,
  speedSeconds,
}: BreakingTickerProps) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const { settings } = usePublicSettings();
  const tickerLang = lang === 'gu' ? 'gu' : lang === 'hi' ? 'hi' : 'en';
  const id = useId().replace(/:/g, '');
  const SAFE_MODE = isSafeMode();

  const isBreaking = variant === 'breaking';
  const maxVisibleItems = isBreaking ? 12 : 15;

  const safeItems = useMemo(() => {
    if (items && items.length) return items.slice(0, maxVisibleItems);
    return [];
  }, [items, maxVisibleItems]);

  const messages = useMemo(() => {
    const effectiveEmpty = emptyText || (variant === 'live' ? t('home.noLiveUpdates') : t('home.noBreaking'));
    if (!safeItems.length) return [effectiveEmpty];
    return safeItems.map((it) => {
      const title = String(it?.title || '').trim();
      if (title) return title;

      const tags = toTagList(it?.tags);
      return tags.length ? tags[0] : t('home.updateFallback');
    });
  }, [emptyText, safeItems, t, variant]);

  const tickerAds = usePublicTickerAds({
    lang: tickerLang,
    channel: variant,
    enabled: !SAFE_MODE,
    refreshIntervalMs: 15_000,
  });

  const mergedItems: TickerMarqueeItem[] = useMemo(() => {
    // Keep the normal ticker list unchanged when there are no real items.
    if (!safeItems.length) {
      return (messages || []).map((text, index) => ({
        id: `news-${variant}-${index}`,
        kind: 'news',
        text: String(text || '').trim(),
      }));
    }

    return mergeTickerItemsWithAds(messages, tickerAds.ads, variant);
  }, [messages, safeItems.length, tickerAds.ads, variant]);

  const renderItems: TickerRenderItem[] = useMemo(
    () =>
      (mergedItems || [])
        .map((item) => {
          if (item.kind === 'ad') {
            return {
              id: item.id,
              type: 'ad',
              message: item.text,
              url: item.url,
            } satisfies TickerRenderItem;
          }

          return {
            id: item.id,
            type: 'news',
            message: item.text,
          } satisfies TickerRenderItem;
        })
        .filter((item) => String(item.message || '').trim() !== ''),
    [mergedItems]
  );

  const label = isBreaking ? t('home.breakingNews') : t('home.liveUpdates');
  const viewAllHref = (() => {
    const raw = String(router.asPath || '/');
    const beforeHash = raw.split('#')[0] || '/';
    const pathPart = (beforeHash.split('?')[0] || '/').trim() || '/';
    const p = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
    const m = p.match(/^\/(en|hi|gu)(?=\/|$)/i);
    const prefix = m ? `/${String(m[1] || '').toLowerCase()}` : '';
    const tab = isBreaking ? 'breaking' : 'live';
    return `${prefix}/breaking?tab=${encodeURIComponent(tab)}`;
  })();

  const fallbackSpeed = isBreaking ? 18 : 24;
  const settingsSpeed = (() => {
    const tickers: any = (settings as any)?.tickers;
    const rawTicker = isBreaking ? tickers?.breaking : tickers?.live;
    return rawTicker?.speedSec ?? rawTicker?.speedSeconds;
  })();
  const baseDurationSec = clampSeconds(speedSeconds ?? settingsSpeed, fallbackSpeed);

  const textForSizing = useMemo(
    () =>
      (renderItems || [])
        .map((item) => (item.type === 'ad' ? `🟡 Ad: ${item.message}` : item.message))
        .join('  •  '),
    [renderItems]
  );
  const targetCharsPerSec = isBreaking ? 9 : 8;
  const autoDurationSec = Math.ceil(Math.max(1, textForSizing.length) / targetCharsPerSec);
  const durationSec = clampSeconds(Math.max(baseDurationSec, autoDurationSec, fallbackSpeed), fallbackSpeed);

  // Force restart of marquee when duration/lang/items change.
  const restartKey = useMemo(() => {
    const s = `${variant}|${tickerLang}|${durationSec}|${textForSizing}`;
    let h = 5381;
    for (let i = 0; i < s.length; i += 1) h = (h * 33) ^ s.charCodeAt(i);
    return `${variant}-${tickerLang}-${durationSec}-${(h >>> 0).toString(16)}`;
  }, [durationSec, textForSizing, tickerLang, variant]);

  return (
    <div
      className={classNames(
        'border-b text-white',
        isBreaking ? 'border-red-700 bg-red-600' : 'border-slate-700 bg-slate-900',
        'np-marqueeWrap',
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-white" />
          <span className="tickerLabel text-xs font-semibold tracking-widest" lang={tickerLang}>{label}</span>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div key={restartKey} className="np-tickerTrack" style={{ animationDuration: `${durationSec}s` }}>
            <div className="np-tickerSeq flex items-center gap-10 text-sm font-medium">
              {renderItems.map((item, i) => (
                <span
                  key={`${id}-a-${item.id}-${i}`}
                  className="tickerText whitespace-nowrap"
                  lang={tickerLang}
                  data-type={item.type}
                >
                  {item.type === 'ad' ? (
                    item.url ? (
                      <a href={item.url} target="_blank" rel="sponsored noopener noreferrer" className="hover:underline">
                        {`🟡 Ad: ${item.message}`}
                      </a>
                    ) : (
                      <>{`🟡 Ad: ${item.message}`}</>
                    )
                  ) : (
                    item.message
                  )}
                </span>
              ))}
            </div>
            <div className="np-tickerSeq flex items-center gap-10 text-sm font-medium">
              {renderItems.map((item, i) => (
                <span
                  key={`${id}-b-${item.id}-${i}`}
                  className="tickerText whitespace-nowrap"
                  lang={tickerLang}
                  data-type={item.type}
                >
                  {item.type === 'ad' ? (
                    item.url ? (
                      <a href={item.url} target="_blank" rel="sponsored noopener noreferrer" className="hover:underline">
                        {`🟡 Ad: ${item.message}`}
                      </a>
                    ) : (
                      <>{`🟡 Ad: ${item.message}`}</>
                    )
                  ) : (
                    item.message
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Link
          href={viewAllHref}
          className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25"
        >
          {t('common.viewAll')}
        </Link>
      </div>
    </div>
  );
}
