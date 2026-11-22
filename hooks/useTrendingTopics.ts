import { useEffect, useState } from 'react';
import { mergeTrendingTopics, readTrendingTopics } from '../lib/getTrendingTopics';
import type { RouteLocale } from '../lib/localizedArticleFields';
import { subscribePublicDataRefresh } from '../lib/publicDataRefresh';
import { DEFAULT_TRENDING_TOPICS, type TrendingTopic } from '../src/config/trendingTopics';

export function useTrendingTopics(lang: RouteLocale): TrendingTopic[] {
  const [state, setState] = useState({ lang, items: DEFAULT_TRENDING_TOPICS, shortcuts: DEFAULT_TRENDING_TOPICS, loaded: false });

  useEffect(() => {
    let active = true;
    let pending: AbortController | null = null;
    setState({ lang, items: DEFAULT_TRENDING_TOPICS, shortcuts: DEFAULT_TRENDING_TOPICS, loaded: false });

    const refresh = async () => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      const result = await readTrendingTopics(lang, controller.signal);
      if (!active || controller.signal.aborted) return;
      setState((previous) => {
        if (result.legacyOnlyFallback) {
          const shortcuts = previous.lang === lang ? previous.shortcuts : DEFAULT_TRENDING_TOPICS;
          const editorial = result.items.filter((topic) => topic.source === 'editorial');
          return { lang, items: mergeTrendingTopics(editorial, shortcuts), shortcuts, loaded: true };
        }
        if (!result.authoritative && previous.lang === lang && previous.loaded) return previous;
        return { lang, items: result.items, shortcuts: result.shortcutSnapshot ?? result.items.filter((topic) => !topic.source), loaded: true };
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
