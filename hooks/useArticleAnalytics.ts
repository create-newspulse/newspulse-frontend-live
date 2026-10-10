import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

import type { Article } from '../lib/publicNewsApi';
import {
  buildBasePayload,
  clearAnalyticsMemory,
  computeSource,
  getOrCreateSessionId,
  getOrCreateVisitorId,
  hasQueuedArticleView,
  markArticleViewQueued,
  normalizeLang,
  postAnalyticsEvent,
  shouldTrackClientAnalytics,
  touchSessionActivity,
  type ArticleAnalyticsLang,
  type ArticleViewEventPayload,
  type EngagedReadEventPayload,
  type HeartbeatEventPayload,
  type ScrollMilestoneEventPayload,
} from '../lib/analytics/articleAnalytics';
import { useOptionalCookieConsent } from '../src/consent/CookieConsentProvider';
import { hasStoredConsentForCategory } from '../src/consent/cookieConsent';

type UseArticleAnalyticsArgs = {
  article: Article | null;
  slug: string;
  lang: ArticleAnalyticsLang;
  isPendingTranslation?: boolean;
};

const HEARTBEAT_INTERVAL_MS = 15000; // 10–15s requirement
const ACTIVE_GRACE_MS = 30000; // consider "active" if interacted in last 30s

type PublicationFlag = 'isDraft' | 'draft' | 'preview' | 'isPreview' | 'unpublished' | 'isPublished' | 'published';
type PublicationState = Partial<Record<PublicationFlag | 'status' | 'state' | 'visibility', unknown>>;
type AnalyticsPayload = ArticleViewEventPayload | EngagedReadEventPayload | HeartbeatEventPayload | ScrollMilestoneEventPayload;
type AnalyticsEvent = 'article-view' | 'engaged-read' | 'article-heartbeat' | 'scroll-milestone';
type Identity = { visitorId: string; sessionId: string };
type TrackerState = Identity & {
  articleId: string;
  slug: string;
  language: ArticleAnalyticsLang;
  readTimeMs: number;
  queuedReadTimeSec: number;
  engagedQueued: boolean;
  milestones: Set<number>;
  maxScrollDepth: number;
};

function isDraftOrPreviewArticle(article: (Article & PublicationState) | null): boolean {
  if (!article) return true;
  const status = String(article.status || article.state || '').toLowerCase().trim();
  if (status === 'draft' || status === 'preview' || status === 'unpublished' || status === 'deleted') return true;

  const flags: PublicationFlag[] = ['isDraft', 'draft', 'preview', 'isPreview', 'unpublished', 'isPublished', 'published'];
  for (const key of flags) {
    const v = article[key];
    if (v === true && (key === 'isDraft' || key === 'draft' || key === 'preview' || key === 'isPreview' || key === 'unpublished')) return true;
    if (v === false && (key === 'isPublished' || key === 'published')) return true;
  }

  // If backend provides an explicit preview flag.
  const visibility = String(article.visibility || '').toLowerCase().trim();
  if (visibility === 'draft' || visibility === 'preview') return true;

  return false;
}

function scheduleNonBlocking(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    try {
      const id = window.requestIdleCallback(fn, { timeout: 2000 });
      return () => {
        if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(id);
      };
    } catch {
      console.warn('[analytics] Idle scheduling unavailable; using a timer.');
    }
  }

  const id = setTimeout(fn, 800);
  return () => clearTimeout(id);
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
  const consent = useOptionalCookieConsent();
  const hasAnalyticsConsent = consent ? consent.categories.analytics : hasStoredConsentForCategory('analytics');
  const consentRecord = consent?.consent;
  const articleId = String(article?._id || '').trim();
  const safeSlug = String(slug || article?.slug || '').trim();
  const normalizedLang = normalizeLang(article?.language || lang);
  const category = String(article?.category || '').trim();
  const isPreview = Boolean(router.isPreview || router.query.preview || router.query.draft || router.query.__preview);
  const eligible = !isPendingTranslation && !isDraftOrPreviewArticle(article);
  const source = computeSource({ query: router.query });
  const { isReady, events: routeEvents } = router;
  const stateRef = useRef<TrackerState | null>(null);

  useEffect(() => {
    if (!hasAnalyticsConsent) {
      stateRef.current = null;
      return;
    }
    if (!articleId || !isReady || !eligible) return;

    const allowLocalhost = process.env.NODE_ENV === 'test';
    if (!shouldTrackClientAnalytics({ isPreview, allowLocalhost })) return;

    const readIdentity = (): Identity => ({
      visitorId: getOrCreateVisitorId(),
      sessionId: getOrCreateSessionId().sessionId,
    });
    const createState = (identity: Identity): TrackerState => ({
      ...identity,
      articleId,
      slug: safeSlug,
      language: normalizedLang,
      readTimeMs: 0,
      queuedReadTimeSec: 0,
      engagedQueued: false,
      milestones: new Set(),
      maxScrollDepth: 0,
    });
    const identity = readIdentity();
    if (!identity.visitorId || !identity.sessionId) return;
    const previous = stateRef.current;
    let state = previous && previous.articleId === articleId && previous.slug === safeSlug &&
      previous.language === normalizedLang && previous.visitorId === identity.visitorId &&
      previous.sessionId === identity.sessionId ? previous : createState(identity);
    stateRef.current = state;

    let disposed = false;
    let paused = false;
    let visible = !document.hidden;
    let focused = true;
    let lastAccountedAt = Date.now();
    let lastInteractionAt = lastAccountedAt;
    let scrollThrottle: ReturnType<typeof setTimeout> | null = null;
    let pendingScrollDepth: number | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    const pendingEvents = new Map<() => void, () => void>();
    const pageUrl = window.location.href;
    const referrer = document.referrer;

    const buildCommon = () => ({
      ...buildBasePayload({ visitorId: state.visitorId, sessionId: state.sessionId, language: normalizedLang, source }),
      url: pageUrl,
      referrer,
      articleId,
      slug: safeSlug,
    });

    const queueEvent = (event: AnalyticsEvent, payload: AnalyticsPayload): boolean => {
      if (!hasStoredConsentForCategory('analytics')) return false;
      const snapshot = Object.freeze({ ...payload });
      const send = () => {
        const cancel = pendingEvents.get(send);
        if (!cancel) return;
        pendingEvents.delete(send);
        cancel();
        void postAnalyticsEvent(event, snapshot);
      };
      pendingEvents.set(send, () => {});
      const cancel = scheduleNonBlocking(send);
      if (pendingEvents.has(send)) pendingEvents.set(send, cancel);
      return true;
    };

    const flushPendingEvents = () => {
      for (const send of Array.from(pendingEvents.keys())) send();
    };

    const sendViewIfNeeded = () => {
      if (hasQueuedArticleView(articleId, state.sessionId)) return;
      if (queueEvent('article-view', { ...buildCommon(), category })) {
        markArticleViewQueued(articleId, state.sessionId);
      }
    };

    const accountReadTime = (at = Date.now()) => {
      if (!paused && visible && focused) {
        const activeUntil = Math.min(at, lastInteractionAt + ACTIVE_GRACE_MS);
        state.readTimeMs += Math.max(0, activeUntil - lastAccountedAt);
      }
      lastAccountedAt = at;
    };

    const maybeFireEngaged = (depth: number) => {
      if (state.engagedQueued || state.readTimeMs < 15_000 || depth < 50) return;
      state.engagedQueued = queueEvent('engaged-read', {
        ...buildCommon(),
        readTimeSec: Math.floor(state.readTimeMs / 1000),
        scrollPercent: Math.round(depth),
      });
    };

    const sendHeartbeat = () => {
      const delta = Math.floor(state.readTimeMs / 1000) - state.queuedReadTimeSec;
      if (delta <= 0) return;
      if (queueEvent('article-heartbeat', { ...buildCommon(), readTimeSec: delta })) {
        // Reserve queued seconds so exit finalization cannot count them again.
        state.queuedReadTimeSec += delta;
      }
    };

    const evaluatePendingScroll = () => {
      if (scrollThrottle !== null) clearTimeout(scrollThrottle);
      scrollThrottle = null;
      if (pendingScrollDepth === null) return;
      const depth = pendingScrollDepth;
      pendingScrollDepth = null;
      state.maxScrollDepth = Math.max(state.maxScrollDepth, depth);
      for (const milestone of [25, 50, 75, 100] as const) {
        if (depth >= milestone && !state.milestones.has(milestone) &&
          queueEvent('scroll-milestone', { ...buildCommon(), milestone, scrollPercent: Math.round(depth) })) {
          state.milestones.add(milestone);
        }
      }
      maybeFireEngaged(depth);
    };

    const finalize = () => {
      accountReadTime();
      evaluatePendingScroll();
      maybeFireEngaged(state.maxScrollDepth);
      sendHeartbeat();
      flushPendingEvents();
    };

    const canContinue = () => {
      if (disposed) return false;
      if (hasStoredConsentForCategory('analytics')) return true;
      dispose();
      return false;
    };

    const noteInteraction = () => {
      if (!canContinue()) return;
      const at = Date.now();
      accountReadTime(at);
      // Resolve expiry before any activity touch can extend the old session.
      const next = readIdentity();
      if (next.sessionId !== state.sessionId || next.visitorId !== state.visitorId) {
        finalize();
        state = createState(next);
        stateRef.current = state;
        sendViewIfNeeded();
      }
      lastInteractionAt = at;
      lastAccountedAt = at;
    };

    const handleFocus = () => {
      noteInteraction();
      focused = true;
    };

    const handleBlur = () => {
      if (!canContinue()) return;
      accountReadTime();
      focused = false;
    };

    const pause = () => {
      if (!canContinue()) return;
      finalize();
      paused = true;
    };

    const resume = () => {
      noteInteraction();
      paused = false;
      visible = !document.hidden;
    };

    const handleVisibility = () => {
      if (!canContinue()) return;
      if (document.hidden) {
        finalize();
        visible = false;
      } else {
        noteInteraction();
        visible = true;
      }
    };

    const handleScroll = () => {
      if (!canContinue() || paused) return;
      noteInteraction();
      // Capture this document's depth before a route swap can replace its DOM.
      pendingScrollDepth = computeScrollDepthPct();
      if (scrollThrottle !== null) return;
      scrollThrottle = setTimeout(() => {
        if (canContinue()) {
          accountReadTime();
          evaluatePendingScroll();
        }
      }, 250);
    };

    sendViewIfNeeded();
    interval = setInterval(() => {
      if (!canContinue() || paused) return;
      const before = state.readTimeMs;
      const at = Date.now();
      accountReadTime(at);
      if (state.readTimeMs > before && at - lastInteractionAt <= ACTIVE_GRACE_MS) touchSessionActivity();
      sendHeartbeat();
      maybeFireEngaged(state.maxScrollDepth);
    }, HEARTBEAT_INTERVAL_MS);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', noteInteraction, { passive: true });
    window.addEventListener('keydown', noteInteraction);
    window.addEventListener('touchstart', noteInteraction, { passive: true });
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', handleVisibility);
    routeEvents?.on('routeChangeStart', pause);
    routeEvents?.on('routeChangeComplete', resume);
    routeEvents?.on('routeChangeError', resume);

    function dispose() {
      if (disposed) return;
      if (hasStoredConsentForCategory('analytics')) {
        finalize();
      } else {
        for (const cancel of pendingEvents.values()) cancel();
        pendingEvents.clear();
        stateRef.current = null;
        clearAnalyticsMemory();
      }
      disposed = true;
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', noteInteraction);
      window.removeEventListener('keydown', noteInteraction);
      window.removeEventListener('touchstart', noteInteraction);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('pageshow', resume);
      document.removeEventListener('visibilitychange', handleVisibility);
      routeEvents?.off('routeChangeStart', pause);
      routeEvents?.off('routeChangeComplete', resume);
      routeEvents?.off('routeChangeError', resume);

      if (scrollThrottle !== null) clearTimeout(scrollThrottle);
      if (interval !== null) clearInterval(interval);
    }

    return dispose;
  }, [articleId, safeSlug, normalizedLang, category, source, eligible, isPreview, isReady, routeEvents, hasAnalyticsConsent, consentRecord]);
}
