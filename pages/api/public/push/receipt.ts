import type { NextApiRequest, NextApiResponse } from 'next';

import { proxyPublicPushReceiptRequest } from '../../../../lib/publicPushProxy';

export default async function publicPushReceiptHandler(req: NextApiRequest, res: NextApiResponse) {
  return proxyPublicPushReceiptRequest(req, res);
}