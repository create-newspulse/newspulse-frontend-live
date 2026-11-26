import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  // The versioned community writer does not implement the Youth Desk contract.
  return res.status(503).json({ ok: false, code: 'YOUTH_INTAKE_UNAVAILABLE', message: 'Youth Pulse submissions are temporarily closed.' });
}
