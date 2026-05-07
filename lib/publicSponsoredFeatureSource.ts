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

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

export function normalizeSponsoredFeatureLang(value: unknown): SupportedSponsoredFeatureLang {
  const lang = String(value || '').trim().toLowerCase();
  return lang === 'hi' ? 'hi' : lang === 'gu' ? 'gu' : 'en';
}

export async function resolvePublicHomepageSponsoredFeature(
  options: ResolvePublicHomepageSponsoredFeatureOptions = {}
): Promise<ResolvePublicHomepageSponsoredFeatureResult> {
  const placement = String(options.placement || 'homepage').trim() || 'homepage';
  const lang = normalizeSponsoredFeatureLang(options.lang);
  const base = getPublicApiBaseUrl();
  const origin = normalizeOrigin(base);

  if (!origin) {
    return {
      ok: false,
      feature: null,
      message: 'BACKEND_NOT_CONFIGURED',
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
    if (upstream.ok && feature) {
      return { ok: upstream.ok, feature, message: 'OK' };
    }

    return { ok: upstream.ok, feature: null, message: 'NO_ACTIVE_SPONSORED_FEATURE' };
  } catch {
    return {
      ok: false,
      feature: null,
      message: 'UPSTREAM_ERROR',
    };
  }
}