import path from 'path';
import { promises as fs } from 'fs';

import { getPublicApiBaseUrl } from './publicApiBase';
import {
  normalizeHomepageSponsoredFeature,
  type HomepageSponsoredFeature,
  type SupportedSponsoredFeatureLang,
} from './publicSponsoredFeature';

type ResolvePublicHomepageSponsoredFeatureOptions = {
  placement?: string;
  lang?: SupportedSponsoredFeatureLang;
  requestHeaders?: {
    cookie?: string;
    authorization?: string;
  };
};

export type ResolvePublicHomepageSponsoredFeatureResult = {
  ok: boolean;
  feature: HomepageSponsoredFeature | null;
  message: string;
};

const LOCAL_FALLBACK_PATH = path.join(process.cwd(), 'data', 'public-sponsored-feature.json');

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function isLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || '').trim());
}

export function normalizeSponsoredFeatureLang(value: unknown): SupportedSponsoredFeatureLang {
  const lang = String(value || '').trim().toLowerCase();
  return lang === 'hi' ? 'hi' : lang === 'gu' ? 'gu' : 'en';
}

async function readLocalFallbackFeature(lang: SupportedSponsoredFeatureLang): Promise<HomepageSponsoredFeature | null> {
  try {
    const raw = await fs.readFile(LOCAL_FALLBACK_PATH, 'utf8');
    const json = JSON.parse(raw);
    return normalizeHomepageSponsoredFeature(json, lang);
  } catch {
    return null;
  }
}

export async function resolvePublicHomepageSponsoredFeature(
  options: ResolvePublicHomepageSponsoredFeatureOptions = {}
): Promise<ResolvePublicHomepageSponsoredFeatureResult> {
  const placement = String(options.placement || 'homepage').trim() || 'homepage';
  const lang = normalizeSponsoredFeatureLang(options.lang);
  const base = getPublicApiBaseUrl();
  const origin = normalizeOrigin(base);

  if (!origin) {
    const feature = await readLocalFallbackFeature(lang);
    return {
      ok: Boolean(feature),
      feature,
      message: feature ? 'LOCAL_DEV_FALLBACK' : 'BACKEND_NOT_CONFIGURED',
    };
  }

  const params = new URLSearchParams();
  params.set('placement', placement);
  params.set('lang', lang);
  params.set('language', lang);
  const upstreamUrl = `${origin}/api/public/sponsored-feature?${params.toString()}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        cookie: String(options.requestHeaders?.cookie || ''),
        authorization: String(options.requestHeaders?.authorization || ''),
      },
      cache: 'no-store',
    });

    const text = await upstream.text().catch(() => '');
    const json = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        })()
      : null;

    const feature = normalizeHomepageSponsoredFeature(json, lang);
    if (feature) {
      return { ok: upstream.ok, feature, message: 'OK' };
    }

    if (isLocalOrigin(origin)) {
      const localFeature = await readLocalFallbackFeature(lang);
      if (localFeature) {
        return { ok: true, feature: localFeature, message: 'LOCAL_DEV_FALLBACK' };
      }
    }

    return { ok: upstream.ok, feature: null, message: 'NO_ACTIVE_SPONSORED_FEATURE' };
  } catch {
    const feature = isLocalOrigin(origin) ? await readLocalFallbackFeature(lang) : null;
    return {
      ok: Boolean(feature),
      feature,
      message: feature ? 'LOCAL_DEV_FALLBACK' : 'UPSTREAM_ERROR',
    };
  }
}