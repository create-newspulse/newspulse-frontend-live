import { useEffect, useState } from 'react';
import { readTrendingTopics } from '../lib/getTrendingTopics';
import type { RouteLocale } from '../lib/localizedArticleFields';
import { subscribePublicDataRefresh } from '../lib/publicDataRefresh';
import { DEFAULT_TRENDING_TOPICS, type TrendingTopic } from '../src/config/trendingTopics';

export function useTrendingTopics(lang: RouteLocale): TrendingTopic[] {
  const [state, setState] = useState({ lang, items: DEFAULT_TRENDING_TOPICS, loaded: false });

  useEffect(() => {
    let active = true;
    let pending: AbortController | null = null;
    setState({ lang, items: DEFAULT_TRENDING_TOPICS, loaded: false });

    const refresh = async () => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      const result = await readTrendingTopics(lang, controller.signal);
      if (!active || controller.signal.aborted) return;
      setState((previous) => {
        if (!result.authoritative && previous.lang === lang && previous.loaded) return previous;
        return { lang, items: result.items, loaded: true };
      });
    };

    void refresh();
    const unsubscribe = subscribePublicDataRefresh(() => { void refresh(); });
    return () => {
      active = false;
      pending?.abort();
      unsubscribe();
    };
  }, [lang]);

  return state.lang === lang ? state.items : DEFAULT_TRENDING_TOPICS;
}
