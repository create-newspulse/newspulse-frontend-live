export type RegionalFeedPayload = any;

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
