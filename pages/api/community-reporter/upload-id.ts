import type { NextApiRequest, NextApiResponse } from 'next'

// Keep body parsing disabled so uploads are rejected without processing them.
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function uploadIdHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' })
  }

  // Journalist document uploads are intentionally disabled. Future re-enablement
  // belongs to the dedicated Journalist Desk verification workflow.
  return res.status(404).json({
    ok: false,
    code: 'JOURNALIST_VERIFICATION_NOT_AVAILABLE',
    message: 'Journalist verification is not currently available.',
  })
}
