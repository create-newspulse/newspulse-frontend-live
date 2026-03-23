import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';

import type { Article } from '../lib/publicNewsApi';
import {
  buildBasePayload,
  computeSource,
  getOrCreateSessionId,
  getOrCreateVisitorId,
  normalizeLang,
  postAnalyticsEvent,
  shouldTrackClientAnalytics,
  touchSessionActivity,
  type ArticleAnalyticsLang,
} from '../lib/analytics/articleAnalytics';

type UseArticleAnalyticsArgs = {
  article: Article | null;
  slug: string;
  lang: ArticleAnalyticsLang;
  isPendingTranslation?: boolean;
};

const HEARTBEAT_INTERVAL_MS = 15000; // 10–15s requirement
const ACTIVE_GRACE_MS = 30000; // consider "active" if interacted in last 30s

function isDraftOrPreviewArticle(article: Article | null): boolean {
  if (!article) return true;
  const status = String((article as any)?.status || (article as any)?.state || '').toLowerCase().trim();
  if (status === 'draft' || status === 'preview' || status === 'unpublished' || status === 'deleted') return true;

  const flags = ['isDraft', 'draft', 'preview', 'isPreview', 'unpublished', 'isPublished', 'published'];
  for (const key of flags) {
    const v = (article as any)?.[key];
    if (v === true && (key === 'isDraft' || key === 'draft' || key === 'preview' || key === 'isPreview' || key === 'unpublished')) return true;
    if (v === false && (key === 'isPublished' || key === 'published')) return true;
  }

  // If backend provides an explicit preview flag.
  const visibility = String((article as any)?.visibility || '').toLowerCase().trim();
  if (visibility === 'draft' || visibility === 'preview') return true;

  return false;
}

function scheduleNonBlocking(fn: () => void) {
  try {
    if (typeof window === 'undefined') return;
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(() => {
        try {
          fn();
        } catch {
          // ignore
        }
      }, { timeout: 2000 });
      return;
    }
  } catch {
    // ignore
  }

  setTimeout(() => {
    try {
      fn();
    } catch {
      // ignore
    }
  }, 800);
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function computeScrollDepthPct(): number {
  try {
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const viewH = window.innerHeight || doc.clientHeight || 0;
    const scrollH = doc.scrollHeight || 0;
    if (!scrollH) return 0;
    return clampPct(((scrollTop + viewH) / scrollH) * 100);
  } catch {
    return 0;
  }
}

export function useArticleAnalytics({ article, slug, lang, isPendingTranslation }: UseArticleAnalyticsArgs) {
  const router = useRouter();

  const articleId = String(article?._id || '').trim();
  const normalizedLang = useMemo(() => normalizeLang((article as any)?.language || lang), [article, lang]);

  const identityRef = useRef<{ visitorId: string; sessionId: string } | null>(null);
  const viewSentRef = useRef<boolean>(false);
  const engagedSentRef = useRef<boolean>(false);
  const firedMilestonesRef = useRef<Set<number>>(new Set());
  const maxScrollDepthRef = useRef<number>(0);

  const readTimeSecRef = useRef<number>(0);
  const lastHeartbeatAtRef = useRef<number>(0);
  const lastInteractionAtRef = useRef<number>(0);
  const isFocusedRef = useRef<boolean>(true);

  const storageKeyPrefix = useMemo(() => {
    // keep stable per article; sessionId is resolved lazily
    return articleId ? `np_article_session_${articleId}` : '';
  }, [articleId]);

  useEffect(() => {
    // Reset per-article session state when navigating.
    viewSentRef.current = false;
    engagedSentRef.current = false;
    firedMilestonesRef.current = new Set();
    maxScrollDepthRef.current = 0;
    readTimeSecRef.current = 0;
    lastHeartbeatAtRef.current = Date.now();
    lastInteractionAtRef.current = Date.now();

    // New article => clear identity cache to ensure fresh sessionId evaluation.
    identityRef.current = null;
  }, [articleId, normalizedLang, slug]);

  useEffect(() => {
    if (!articleId) return;
    if (!router.isReady) return;

    const isPreview = Boolean((router as any)?.isPreview) ||
      Boolean((router.query as any)?.preview) ||
      Boolean((router.query as any)?.draft) ||
      Boolean((router.query as any)?.__preview);

    if (isPendingTranslation) return;
    if (isPreview) return;
    if (isDraftOrPreviewArticle(article)) return;

    const allowLocalhost = process.env.NODE_ENV === 'test';
    if (!shouldTrackClientAnalytics({ isPreview, allowLocalhost })) return;

    const ensureIdentity = () => {
      if (identityRef.current) return identityRef.current;
      const visitorId = getOrCreateVisitorId();
      const { sessionId } = getOrCreateSessionId();
      identityRef.current = { visitorId, sessionId };
      return identityRef.current;
    };

    const source = computeSource({ query: router.query as any });

    const buildCommon = () => {
      const { visitorId, sessionId } = ensureIdentity();
      touchSessionActivity();
      return buildBasePayload({ visitorId, sessionId, language: normalizedLang, source });
    };

    const alreadySentInTab = () => {
      try {
        if (typeof window === 'undefined') return false;
        const ss = window.sessionStorage;
        if (!ss) return false;
        const { sessionId } = ensureIdentity();
        const key = `${storageKeyPrefix}:view:${sessionId}`;
        return ss.getItem(key) === '1';
      } catch {
        return false;
      }
    };

    const markSentInTab = () => {
      try {
        if (typeof window === 'undefined') return;
        const ss = window.sessionStorage;
        if (!ss) return;
        const { sessionId } = ensureIdentity();
        const key = `${storageKeyPrefix}:view:${sessionId}`;
        ss.setItem(key, '1');
      } catch {
        // ignore
      }
    };

    const sendViewIfNeeded = () => {
      if (viewSentRef.current) return;
      if (alreadySentInTab()) {
        viewSentRef.current = true;
        return;
      }

      const base = buildCommon();
      const category = String((article as any)?.category || '').trim();
      const safeSlug = String(slug || (article as any)?.slug || '').trim();

      scheduleNonBlocking(() => {
        void postAnalyticsEvent('article-view', {
          ...base,
          articleId,
          slug: safeSlug,
          category,
        });
      });

      viewSentRef.current = true;
      markSentInTab();
    };

    const sendScrollMilestone = (milestonePct: 25 | 50 | 75 | 100, scrollDepthPct: number) => {
      const base = buildCommon();
      const safeSlug = String(slug || (article as any)?.slug || '').trim();

      scheduleNonBlocking(() => {
        void postAnalyticsEvent('scroll-milestone', {
          ...base,
          articleId,
          slug: safeSlug,
          milestonePct,
          scrollDepthPct: Math.round(scrollDepthPct),
        });
      });
    };

    const sendEngagedRead = (scrollDepthPct: number) => {
      if (engagedSentRef.current) return;
      engagedSentRef.current = true;

      const base = buildCommon();
      const safeSlug = String(slug || (article as any)?.slug || '').trim();

      scheduleNonBlocking(() => {
        void postAnalyticsEvent('engaged-read', {
          ...base,
          articleId,
          slug: safeSlug,
          readTimeSec: Math.max(0, Math.floor(readTimeSecRef.current)),
          scrollDepthPct: Math.round(scrollDepthPct),
        });
      });
    };

    const sendHeartbeat = () => {
      const base = buildCommon();
      const safeSlug = String(slug || (article as any)?.slug || '').trim();

      scheduleNonBlocking(() => {
        void postAnalyticsEvent('article-heartbeat', {
          ...base,
          articleId,
          slug: safeSlug,
          readTimeSec: Math.max(0, Math.floor(readTimeSecRef.current)),
        });
      });
    };

    const isActiveNow = () => {
      try {
        if (document.hidden) return false;
        if (!isFocusedRef.current) return false;
        const last = lastInteractionAtRef.current || 0;
        return (Date.now() - last) <= ACTIVE_GRACE_MS;
      } catch {
        return false;
      }
    };

    // Fire view once page is stable-ish.
    sendViewIfNeeded();

    // Interaction tracking
    const noteInteraction = () => {
      lastInteractionAtRef.current = Date.now();
      touchSessionActivity();
    };

    const handleFocus = () => {
      isFocusedRef.current = true;
      noteInteraction();
    };

    const handleBlur = () => {
      isFocusedRef.current = false;
    };

    const maybeFireEngaged = (depth: number) => {
      if (engagedSentRef.current) return;
      const hasTime = readTimeSecRef.current >= 15;
      const hasScroll = depth >= 50;
      if (hasTime && hasScroll) sendEngagedRead(depth);
    };

    let scrollThrottle: ReturnType<typeof setTimeout> | null = null;
    const handleScroll = () => {
      noteInteraction();
      if (scrollThrottle) return;
      scrollThrottle = setTimeout(() => {
        scrollThrottle = null;
        const depth = computeScrollDepthPct();
        if (depth > maxScrollDepthRef.current) maxScrollDepthRef.current = depth;

        const milestones: Array<25 | 50 | 75 | 100> = [25, 50, 75, 100];
        for (const m of milestones) {
          if (depth >= m && !firedMilestonesRef.current.has(m)) {
            firedMilestonesRef.current.add(m);
            sendScrollMilestone(m, depth);
          }
        }

        maybeFireEngaged(depth);
      }, 250);
    };

    // Heartbeat timer
    let interval: ReturnType<typeof setInterval> | null = null;
    lastHeartbeatAtRef.current = Date.now();

    interval = setInterval(() => {
      const ts = Date.now();
      const active = isActiveNow();
      const deltaSec = Math.max(0, Math.round((ts - (lastHeartbeatAtRef.current || ts)) / 1000));

      if (active) {
        readTimeSecRef.current += deltaSec;
        sendHeartbeat();
        // engaged-read check in case user hit 50% earlier
        maybeFireEngaged(maxScrollDepthRef.current);
      }

      // If inactive, do not accumulate time; reset the baseline
      lastHeartbeatAtRef.current = ts;
    }, HEARTBEAT_INTERVAL_MS);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', noteInteraction, { passive: true });
    window.addEventListener('keydown', noteInteraction);
    window.addEventListener('touchstart', noteInteraction, { passive: true });
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      try {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('mousemove', noteInteraction);
        window.removeEventListener('keydown', noteInteraction);
        window.removeEventListener('touchstart', noteInteraction);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
      } catch {
        // ignore
      }

      if (scrollThrottle) {
        clearTimeout(scrollThrottle);
        scrollThrottle = null;
      }

      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
  }, [article, articleId, isPendingTranslation, normalizedLang, router, slug, storageKeyPrefix]);
}
