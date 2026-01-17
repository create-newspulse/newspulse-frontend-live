import {
  fetchPublicBroadcast,
  type BroadcastLang,
  type PublicBroadcast,
} from '../../lib/publicBroadcast';

export type UiLangCode = BroadcastLang;

/**
 * PHASE 1: Fetch language-resolved ticker items via same-origin /admin-api.
 * - Uses `cache: "no-store"` under the hood.
 * - Returns a normalized broadcast shape.
 * - Fail-open: returns an empty broadcast object on errors.
 */
export async function fetchPublicBroadcastByLang(
  lang: UiLangCode,
  options?: { signal?: AbortSignal }
): Promise<PublicBroadcast> {
  return fetchPublicBroadcast({ lang, signal: options?.signal });
}
