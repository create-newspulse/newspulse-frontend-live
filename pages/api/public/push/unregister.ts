import type { NextApiRequest, NextApiResponse } from 'next';

import { proxyPublicPushRequest } from '../../../../lib/publicPushProxy';

export default async function publicPushUnregisterHandler(req: NextApiRequest, res: NextApiResponse) {
  return proxyPublicPushRequest(req, res, '/api/public/push/unregister', ['DELETE', 'POST']);
}