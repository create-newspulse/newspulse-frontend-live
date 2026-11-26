import type { NextApiRequest, NextApiResponse } from 'next';
import { profileAction } from '../../../../../lib/reporterPortalAuth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return profileAction('confirm-change', req, res);
}
