import { useEffect, useRef } from 'react';

export function useHomeLowerAdAlignment(locale: string, hasLeftRail: boolean) {
  const leftRailRef = useRef<HTMLElement | null>(null);
  const freshStoriesRef = useRef<HTMLDivElement | null>(null);
  const lowerAdRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const leftRail = leftRailRef.current;
    const freshStories = freshStoriesRef.current;
    if (!hasLeftRail || !leftRail || !freshStories) return;

    const property = '--home-lower-ad-offset';
    let frame: number | null = null;
    const observed = new Set<Element>();

    const measure = () => {
      frame = null;
      const upperAd = leftRail.querySelector<HTMLElement>('.home-upper-ad');
      const lowerAd = leftRail.querySelector<HTMLElement>('.home-lower-ad');
      if (lowerAdRef.current !== lowerAd) {
        lowerAdRef.current?.style.removeProperty(property);
        lowerAdRef.current = lowerAd;
      }

      const targets = new Set<Element>([leftRail, freshStories]);
      if (freshStories.previousElementSibling) targets.add(freshStories.previousElementSibling);
      if (upperAd) targets.add(upperAd);
      if (lowerAd) targets.add(lowerAd);
      observed.forEach((target) => {
        if (!targets.has(target)) {
          resizeObserver?.unobserve(target);
          observed.delete(target);
        }
      });
      targets.forEach((target) => {
        if (!observed.has(target)) {
          resizeObserver?.observe(target);
          observed.add(target);
        }
      });

      if (!lowerAd) return;
      const upperBounds = upperAd?.getBoundingClientRect();
      const lowerBounds = lowerAd.getBoundingClientRect();
      const freshBounds = freshStories.getBoundingClientRect();
      if (window.innerWidth <= 1200 || !upperBounds?.height || !upperBounds.width ||
          !lowerBounds.height || !lowerBounds.width || !freshBounds.height || !freshBounds.width) {
        lowerAd.style.removeProperty(property);
        return;
      }

      const applied = Number.parseFloat(getComputedStyle(lowerAd).marginTop) || 0;
      const delta = freshBounds.bottom - (lowerBounds.bottom - applied);
      const offset = delta > 1 ? delta : 0;
      if (!offset) {
        lowerAd.style.removeProperty(property);
      } else if (Math.abs(offset - applied) > 0.25) {
        lowerAd.style.setProperty(property, `${offset}px`);
      }
    };

    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(measure);
    };
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(leftRail, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    document.fonts?.addEventListener('loadingdone', schedule);
    measure();

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', schedule);
      document.fonts?.removeEventListener('loadingdone', schedule);
      lowerAdRef.current?.style.removeProperty(property);
      lowerAdRef.current = null;
    };
  }, [locale, hasLeftRail]);

  return { leftRailRef, freshStoriesRef };
}