import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicSettings, parsePublicSettingsKeys } from '../../../lib/publicSettings';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const keys = parsePublicSettingsKeys(req.query.keys);
    const settings = await getPublicSettings(keys);
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({ ok: true, settings });
  } catch {
    return res.status(500).json({ ok: false, message: 'SETTINGS_LOAD_FAILED' });
  }
}
