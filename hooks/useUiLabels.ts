import * as React from 'react';

import { getMessagesForLang, normalizeLang, type Lang } from '../src/i18n/LanguageProvider';

type UiLabelsState = {
  ok: boolean;
  labels: Record<string, string>;
};

function getFromPath(obj: any, keyPath: string): string | undefined {
  if (!obj || !keyPath) return undefined;
  const parts = keyPath.split('.').filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function localFallback(lang: Lang, key: string): string {
  const dict = getMessagesForLang(lang);
  const v = getFromPath(dict as any, key);
  if (typeof v === 'string') return v;

  const enDict = getMessagesForLang('en');
  const fb = getFromPath(enDict as any, key);
  return typeof fb === 'string' ? fb : key;
}

function normalizePayload(payload: any): UiLabelsState {
  if (!payload || typeof payload !== 'object') return { ok: false, labels: {} };
  const rawLabels: any = (payload as any).labels ?? (payload as any).data ?? (payload as any).result;
  const labels: Record<string, string> = {};

  if (rawLabels && typeof rawLabels === 'object' && !Array.isArray(rawLabels)) {
    for (const [k, v] of Object.entries(rawLabels)) {
      const key = String(k || '').trim();
      const val = String(v ?? '').trim();
      if (key && val) labels[key] = val;
    }
  }

  return { ok: Boolean((payload as any).ok) || Object.keys(labels).length > 0, labels };
}

/**
 * Loads backend-provided UI labels for the current language.
 * - Fetches: GET /public/ui-labels?lang=<lang>
 * - Falls back to local i18n dictionary keys if the API fails.
 */
export function useUiLabels(lang: Lang) {
  const effectiveLang = normalizeLang(lang);
  const [remote, setRemote] = React.useState<UiLabelsState>({ ok: false, labels: {} });

  React.useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`/public/ui-labels?lang=${encodeURIComponent(effectiveLang)}`, {
          method: 'GET',
          headers: { Accept: 'application/json', 'Cache-Control': 'no-store' },
          cache: 'no-store',
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (controller.signal.aborted) return;

        if (!res.ok || !json) {
          setRemote({ ok: false, labels: {} });
          return;
        }
        setRemote(normalizePayload(json));
      } catch {
        if (controller.signal.aborted) return;
        setRemote({ ok: false, labels: {} });
      }
    })();

    return () => controller.abort();
  }, [effectiveLang]);

  const label = React.useCallback(
    (key: string) => {
      const k = String(key || '').trim();
      if (!k) return '';
      const v = remote.labels[k];
      if (typeof v === 'string' && v.trim()) return v;
      return localFallback(effectiveLang, k);
    },
    [effectiveLang, remote.labels]
  );

  return {
    ok: remote.ok,
    labels: remote.labels,
    label,
  };
}
