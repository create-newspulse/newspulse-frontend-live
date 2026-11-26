import type { NextApiRequest, NextApiResponse } from 'next';
import { profileAction } from '../../../../../lib/reporterPortalAuth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return profileAction('request-change', req, res);
}
