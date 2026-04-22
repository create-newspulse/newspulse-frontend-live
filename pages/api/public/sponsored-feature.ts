import type { NextApiRequest, NextApiResponse } from 'next';

import {
  type HomepageSponsoredFeature,
} from '../../../lib/publicSponsoredFeature';
import {
  normalizeSponsoredFeatureLang,
  resolvePublicHomepageSponsoredFeature,
} from '../../../lib/publicSponsoredFeatureSource';

type SponsoredFeatureResponse = {
  ok: boolean;
  feature: HomepageSponsoredFeature | null;
  message?: string;
};

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<SponsoredFeatureResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, feature: null, message: 'METHOD_NOT_ALLOWED' });
  }

  noStore(res);

  const placement = String(req.query.placement || 'homepage').trim() || 'homepage';
  const lang = normalizeSponsoredFeatureLang(req.query.lang || req.query.language);
  const result = await resolvePublicHomepageSponsoredFeature({
    placement,
    lang,
    requestHeaders: {
      cookie: String(req.headers.cookie || ''),
      authorization: String(req.headers.authorization || ''),
    },
  });

  return res.status(200).json(result);
}