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
const allowedOrigin = 'http://localhost:5173';

function setCors(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readSettings(): Promise<SiteSettings> {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    const catFlow = parsed.catFlow;
    const fixedCatFlow: 'ltr' | 'rtl' = catFlow === 'rtl' ? 'rtl' : 'ltr';
    return { ...DEFAULT_SETTINGS, ...parsed, catFlow: fixedCatFlow };
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
      return DEFAULT_SETTINGS;
    }
    throw err;
  }
}

async function writeSettings(next: SiteSettings): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(next, null, 2), 'utf8');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const settings = await readSettings();
      return res.status(200).json({ ok: true, settings });
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Failed to load settings' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const current = await readSettings();
      const payload = req.body || {};

      const next: SiteSettings = { ...current };

      // Validate and apply updates
      for (const [key, value] of Object.entries(payload)) {
        if (key === 'catFlow') {
          if (typeof value === 'boolean') {
            return res.status(400).json({ ok: false, error: 'catFlow must be "ltr" or "rtl" (not boolean)' });
          }
          if (value !== 'ltr' && value !== 'rtl') {
            return res.status(400).json({ ok: false, error: 'catFlow must be "ltr" or "rtl"' });
          }
          next.catFlow = value as 'ltr' | 'rtl';
        } else if (
          key === 'showExploreCategories' ||
          key === 'showCategoryStrip' ||
          key === 'showTrendingStrip' ||
          key === 'showLiveTvCard' ||
          key === 'showQuickTools' ||
          key === 'showSnapshots' ||
          key === 'showAppPromo' ||
          key === 'showFooter'
        ) {
          if (typeof value !== 'boolean') {
            return res.status(400).json({ ok: false, error: `${key} must be boolean` });
          }
          (next as any)[key] = value;
        }
        // Unknown keys are ignored silently
      }

      await writeSettings(next);
      return res.status(200).json({ ok: true, settings: next });
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Failed to update settings' });
    }
  }

  res.setHeader('Allow', 'GET,PUT,OPTIONS');
  return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
}
