import type { BroadcastLang } from './publicBroadcast';

export type TickerChannel = 'breaking' | 'live';
export type TickerAdChannel = TickerChannel | 'both';

export type PublicTickerAd = {
  id: string;
  text: string;
  url: string | null;
  channel: TickerAdChannel;
  frequency: number;
  priority: number;
  raw: Record<string, any>;
};

export type PublicTickerAdsPayload = {
  ok: boolean;
  enabled: boolean;
  ads: PublicTickerAd[];
};

export type TickerMarqueeItem =
  | {
      id: string;
      kind: 'news';
      text: string;
    }
  | {
      id: string;
      kind: 'ad';
      text: string;
      url: string | null;
      channel: TickerAdChannel;
      frequency: number;
      priority: number;
      raw: Record<string, any>;
    };

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function pickFirstNonEmpty(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const text = String(candidate ?? '').trim();
    if (text) return text;
  }
  return null;
}

function getTranslationsRecord(item: Record<string, any>): Record<string, string> | null {
  const source = item.texts || item.translations || item.i18n || item.textByLang || item.byLang || null;
  if (!isRecord(source)) return null;

  const out: Record<string, string> = {};
  for (const key of Object.keys(source)) {
    const text = String(source[key] ?? '').trim();
    if (text) out[String(key).toLowerCase().trim()] = text;
  }
  return Object.keys(out).length ? out : null;
}

function normalizeLang(raw: unknown): BroadcastLang | null {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'en' || value === 'hi' || value === 'gu') return value as BroadcastLang;
  return null;
}

function normalizeTickerAdChannel(raw: unknown, fallback: TickerAdChannel): TickerAdChannel {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'breaking' || value === 'live' || value === 'both') return value as TickerAdChannel;
  return fallback;
}

function normalizePriority(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return 0;
  if (value === 'high') return 3;
  if (value === 'medium') return 2;
  if (value === 'low') return 1;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFrequency(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3;
  return Math.min(12, Math.max(1, Math.floor(parsed)));
}

function resolveTickerAdUrl(item: Record<string, any>): string | null {
  const url = pickFirstNonEmpty([item.targetUrl, item.clickUrl, item.url, item.href, item.link]);
  return url || null;
}

export function resolveTickerAdText(item: Record<string, any>, lang?: BroadcastLang): string | null {
  const wanted = normalizeLang(lang);
  const sourceLang = normalizeLang(item.sourceLang || item.sourceLanguage || item.lang);
  const translations = getTranslationsRecord(item);

  if (wanted && translations?.[wanted]) return translations[wanted];

  const direct = pickFirstNonEmpty([
    item.text,
    item.title,
    item.headline,
    item.message,
    item.copy,
    item.name,
    item.brandName,
    item.brand,
    item.advertiserName,
  ]);
  if (direct) return direct;

  if (translations) {
    const candidates: unknown[] = [];
    if (wanted && translations[wanted]) candidates.push(translations[wanted]);
    if (sourceLang && translations[sourceLang]) candidates.push(translations[sourceLang]);
    for (const key of ['en', 'hi', 'gu']) {
      if (translations[key]) candidates.push(translations[key]);
    }
    candidates.push(...Object.values(translations));
    return pickFirstNonEmpty(candidates);
  }

  return null;
}

function extractTickerAdsList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return [];
  if (Array.isArray(raw.ads)) return raw.ads;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.data)) return raw.data;
  if (isRecord(raw.data)) return extractTickerAdsList(raw.data);
  if (isRecord(raw.result)) return extractTickerAdsList(raw.result);
  return [];
}

export function normalizePublicTickerAds(
  raw: unknown,
  options?: { lang?: BroadcastLang; fallbackChannel?: TickerAdChannel }
): PublicTickerAdsPayload {
  const root = isRecord(raw) ? raw : null;
  const nested = root && isRecord(root.data) ? root.data : null;
  const payload = nested || root;
  const ok = typeof root?.ok === 'boolean' ? root.ok : typeof root?.success === 'boolean' ? root.success : true;
  const enabledRaw = payload && typeof payload.enabled === 'boolean' ? payload.enabled : root && typeof root.enabled === 'boolean' ? root.enabled : true;
  const enabled = enabledRaw !== false;
  const adsRaw = extractTickerAdsList(payload || raw);
  const fallbackChannel = options?.fallbackChannel || 'both';

  const ads = adsRaw
    .map((item, index) => {
      const rawItem = isRecord(item) ? item : null;
      if (!rawItem) return null;

      const text = resolveTickerAdText(rawItem, options?.lang);
      if (!text) return null;

      const rawId = pickFirstNonEmpty([rawItem._id, rawItem.id, rawItem.adId, rawItem.uuid]);
      const id = rawId || `ticker-ad-${index}`;

      return {
        id,
        text,
        url: resolveTickerAdUrl(rawItem),
        channel: normalizeTickerAdChannel(rawItem.channel || rawItem.placement || rawItem.type, fallbackChannel),
        frequency: normalizeFrequency(rawItem.frequency || rawItem.interval || rawItem.every),
        priority: normalizePriority(rawItem.priority || rawItem.weight),
        raw: rawItem,
      } satisfies PublicTickerAd;
    })
    .filter(Boolean) as PublicTickerAd[];

  ads.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.frequency !== b.frequency) return a.frequency - b.frequency;
    return a.id.localeCompare(b.id);
  });

  return { ok: ok !== false, enabled, ads: enabled ? ads : [] };
}

export function filterTickerAdsForChannel(ads: PublicTickerAd[], channel: TickerChannel): PublicTickerAd[] {
  return (ads || []).filter((ad) => ad.channel === 'both' || ad.channel === channel);
}

export function mergeTickerItemsWithAds(newsItems: string[], ads: PublicTickerAd[], channel: TickerChannel): TickerMarqueeItem[] {
  const normalizedNews = (newsItems || []).map((item) => String(item || '').trim()).filter(Boolean);
  const eligibleAds = filterTickerAdsForChannel(ads, channel);

  if (!eligibleAds.length) {
    return normalizedNews.map((text, index) => ({ id: `news-${channel}-${index}`, kind: 'news', text }));
  }

  if (!normalizedNews.length) {
    return eligibleAds.map((ad, index) => ({
      id: `${ad.id}-${index}`,
      kind: 'ad',
      text: ad.text,
      url: ad.url,
      channel: ad.channel,
      frequency: ad.frequency,
      priority: ad.priority,
      raw: ad.raw,
    }));
  }

  const merged: TickerMarqueeItem[] = [];
  let newsIndex = 0;
  let adIndex = 0;

  while (newsIndex < normalizedNews.length) {
    const currentAd = eligibleAds[adIndex % eligibleAds.length];
    const batchSize = currentAd ? normalizeFrequency(currentAd.frequency) : 3;

    for (let i = 0; i < batchSize && newsIndex < normalizedNews.length; i += 1) {
      merged.push({
        id: `news-${channel}-${newsIndex}`,
        kind: 'news',
        text: normalizedNews[newsIndex],
      });
      newsIndex += 1;
    }

    if (newsIndex < normalizedNews.length && currentAd) {
      merged.push({
        id: `${currentAd.id}-${adIndex}`,
        kind: 'ad',
        text: currentAd.text,
        url: currentAd.url,
        channel: currentAd.channel,
        frequency: currentAd.frequency,
        priority: currentAd.priority,
        raw: currentAd.raw,
      });
      adIndex += 1;
    }
  }

  return merged;
}

export function getTickerMarqueeText(items: TickerMarqueeItem[]): string {
  return (items || [])
    .map((item) => (item.kind === 'ad' ? `🟡 Ad: ${item.text}` : item.text))
    .join('  •  ');
}