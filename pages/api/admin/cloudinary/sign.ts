import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const DEV_ALLOWED_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

function setCors(req: NextApiRequest, res: NextApiResponse) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return;

  const isProdDeployment =
    String(process.env.VERCEL_ENV || '').toLowerCase() === 'production' ||
    ['prod', 'production'].includes(String(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '').toLowerCase());

  // Only allow cross-origin access from the local admin dev server.
  if (isProdDeployment) return;
  if (!DEV_ALLOWED_ORIGINS.has(origin)) return;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function toStr(v: unknown): string {
  return typeof v === 'string' ? v : String(v || '');
}

function pickBody(req: NextApiRequest): any {
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}

function cloudinarySignature(params: Record<string, string>, apiSecret: string): string {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort();
  const toSign = keys.map((k) => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(req, res);
  noStore(res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const cloudName = toStr(process.env.CLOUDINARY_CLOUD_NAME).trim();
  const apiKey = toStr(process.env.CLOUDINARY_API_KEY).trim();
  const apiSecret = toStr(process.env.CLOUDINARY_API_SECRET).trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({
      ok: false,
      message: 'CLOUDINARY_NOT_CONFIGURED',
      missing: {
        CLOUDINARY_CLOUD_NAME: !cloudName,
        CLOUDINARY_API_KEY: !apiKey,
        CLOUDINARY_API_SECRET: !apiSecret,
      },
    });
  }

  const input = req.method === 'POST' ? pickBody(req) : (req.query as any);
  const folder = toStr(input?.folder || 'newspulse/cover-images').trim();
  const publicId = toStr(input?.publicId || '').trim();
  const uploadPreset = toStr(input?.uploadPreset || '').trim();

  // Timestamp must be an integer (seconds) for Cloudinary signature.
  const timestamp = Math.floor(Date.now() / 1000);

  // Only include parameters we expect the client to send.
  const paramsToSign: Record<string, string> = {
    folder,
    timestamp: String(timestamp),
  };
  if (publicId) paramsToSign.public_id = publicId;
  if (uploadPreset) paramsToSign.upload_preset = uploadPreset;

  const signature = cloudinarySignature(paramsToSign, apiSecret);

  return res.status(200).json({
    ok: true,
    cloudName,
    apiKey,
    timestamp,
    signature,
    folder,
    publicId: publicId || undefined,
  });
}
