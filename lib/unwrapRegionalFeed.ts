export type RegionalFeedPayload = any;
import { resolveArticleSlug } from './articleSlugs';

export function filterRegionalFeedItems(items: any[], keepItem: (item: any) => boolean): any[] {
  const input = Array.isArray(items) ? items : [];
  if (!input.length) return input;

  let changed = false;
  const out: any[] = [];

  for (const item of input) {
    if (!keepItem(item)) {
      changed = true;
      continue;
    }
    out.push(item);
  }

  return changed ? out : input;
}

export function filterRegionalFeedPayload(
  payload: RegionalFeedPayload,
  keepItem: (item: any) => boolean
): RegionalFeedPayload {
  if (!payload) return payload;
  if (Array.isArray(payload)) return filterRegionalFeedItems(payload, keepItem);
  if (typeof payload !== 'object') return payload;

  const arrayKeys = ['items', 'stories', 'articles', 'news', 'result'] as const;
  let out: any = payload;
  let changed = false;

  for (const k of arrayKeys) {
    const cur = (payload as any)[k];
    if (Array.isArray(cur)) {
      const nextItems = filterRegionalFeedItems(cur, keepItem);
      if (nextItems !== cur) {
        if (!changed) out = { ...(payload as any) };
        out[k] = nextItems;
        if (typeof out.total === 'number') out.total = nextItems.length;
        if (typeof out.count === 'number') out.count = nextItems.length;
        changed = true;
      }
    }
  }

  if ((payload as any).data && typeof (payload as any).data === 'object') {
    const nextData = filterRegionalFeedPayload((payload as any).data, keepItem);
    if (nextData !== (payload as any).data) {
      if (!changed) out = { ...(payload as any) };
      out.data = nextData;
      changed = true;
    }
  }

  return changed ? out : payload;
}

function isExplicitlyUnpublished(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  if (item.isPublished === false) return true;
  if (item.published === false) return true;
  if (typeof item.status === 'string') {
    const s = item.status.toLowerCase().trim();
    if (s === 'draft' || s === 'unpublished' || s === 'inactive') return true;
  }
  return false;
}

export function dedupeRegionalFeedItems(items: any[], langInput: unknown): any[] {
  const input = Array.isArray(items) ? items : [];
  if (!input.length) return input;

  const seen = new Set<string>();
  const out: any[] = [];
  let changed = false;

  for (const item of input) {
    if (isExplicitlyUnpublished(item)) {
      changed = true;
      continue;
    }

    const key = String(resolveArticleSlug(item, langInput) || '').trim().toLowerCase();
    if (key) {
      if (seen.has(key)) {
        changed = true;
        continue;
      }
      seen.add(key);
    }

    out.push(item);
  }

  return changed ? out : input;
}

export function dedupeRegionalFeedPayload(payload: RegionalFeedPayload, langInput: unknown): RegionalFeedPayload {
  if (!payload) return payload;
  if (Array.isArray(payload)) return dedupeRegionalFeedItems(payload, langInput);
  if (typeof payload !== 'object') return payload;

  const arrayKeys = ['items', 'stories', 'articles', 'news', 'result'] as const;
  let out: any = payload;
  let changed = false;

  for (const k of arrayKeys) {
    const cur = (payload as any)[k];
    if (Array.isArray(cur)) {
      const nextItems = dedupeRegionalFeedItems(cur, langInput);
      if (nextItems !== cur) {
        if (!changed) out = { ...(payload as any) };
        out[k] = nextItems;
        if (typeof out.total === 'number') out.total = nextItems.length;
        if (typeof out.count === 'number') out.count = nextItems.length;
        changed = true;
      }
    }
  }

  if ((payload as any).data && typeof (payload as any).data === 'object') {
    const nextData = dedupeRegionalFeedPayload((payload as any).data, langInput);
    if (nextData !== (payload as any).data) {
      if (!changed) out = { ...(payload as any) };
      out.data = nextData;
      changed = true;
    }
  }

  return changed ? out : payload;
}

export function unwrapRegionalFeedItems(payload: RegionalFeedPayload): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const directCandidates = [
    payload.items,
    payload.stories,
    payload.articles,
    payload.news,
    payload.result,
  ];

  for (const c of directCandidates) {
    if (Array.isArray(c)) return c;
  }

  // Common backend shape: { ok, success, status, data: { items: [...] } }
  if (payload.data) return unwrapRegionalFeedItems(payload.data);

  return [];
}
