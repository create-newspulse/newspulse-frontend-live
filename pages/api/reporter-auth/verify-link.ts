import type { NextApiRequest, NextApiResponse } from 'next';
import { noStore } from '../../../lib/reporterAuthProxy';

// Old locally signed links are not a Backend authentication mechanism.
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  noStore(res);
  return res.status(410).json({ ok: false, code: 'USE_EMAIL_CODE' });
}
