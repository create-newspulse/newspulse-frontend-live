import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getPublishedMonthlyComplianceReports,
  monthlyComplianceReports,
  resolveMonthlyComplianceReports,
} from '../../../data/monthlyComplianceReports';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function normalizeLoopbackBase(base: string): string {
  return String(base || '').replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1');
}

function getFallbackReports() {
  return getPublishedMonthlyComplianceReports(monthlyComplianceReports);
}

async function readJson(upstream: Response): Promise<any> {
  const text = await upstream.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default async function publicComplianceReportsHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const fallbackReports = getFallbackReports();
  const origin = normalizeLoopbackBase(normalizeOrigin(getPublicApiBaseUrl()));

  if (!origin) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, reports: fallbackReports, fallback: true });
  }

  try {
    const upstream = await fetch(`${origin}/api/public/compliance-reports`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        cookie: String(req.headers.cookie || ''),
        authorization: String(req.headers.authorization || ''),
      },
    });

    const json = await readJson(upstream);
    const reports = upstream.ok ? resolveMonthlyComplianceReports(json, monthlyComplianceReports) : fallbackReports;
    const usedFallback = !upstream.ok || reports.length === 0;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      reports: usedFallback ? fallbackReports : reports,
      fallback: usedFallback,
    });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, reports: fallbackReports, fallback: true });
  }
}