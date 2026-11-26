import type { NextApiRequest, NextApiResponse } from 'next';
import { loginAction } from '../../../lib/reporterPortalAuth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return loginAction('verify-login-otp', req, res);
}
