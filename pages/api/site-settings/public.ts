import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { promises as fs } from 'fs';

type SiteSettings = {
  catFlow: 'ltr' | 'rtl';
  showExploreCategories: boolean;
  showCategoryStrip: boolean;
  showTrendingStrip: boolean;
  showLiveTvCard: boolean;
  showQuickTools: boolean;
  showSnapshots: boolean;
  showAppPromo: boolean;
  showFooter: boolean;
};

const DEFAULT_SETTINGS: SiteSettings = {
  catFlow: 'ltr',
  showExploreCategories: true,
  showCategoryStrip: true,
  showTrendingStrip: true,
  showLiveTvCard: false,
  showQuickTools: true,
  showSnapshots: true,
  showAppPromo: true,
  showFooter: true,
};

const settingsPath = path.join(process.cwd(), 'data', 'site-settings.json');

async function readSettings(): Promise<SiteSettings> {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    // Coerce and validate catFlow
    const catFlow = parsed.catFlow;
    const fixedCatFlow: 'ltr' | 'rtl' = catFlow === 'rtl' ? 'rtl' : 'ltr';
    return { ...DEFAULT_SETTINGS, ...parsed, catFlow: fixedCatFlow };
  } catch (err: any) {
    // If missing, initialize with defaults
    if (err?.code === 'ENOENT') {
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
      return DEFAULT_SETTINGS;
    }
    throw err;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const settings = await readSettings();
    // Optional: mild cache for public settings
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json({ ok: true, settings });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to load settings' });
  }
}

