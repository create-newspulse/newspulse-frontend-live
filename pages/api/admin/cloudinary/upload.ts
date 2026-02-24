import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import fs from 'fs/promises';
import formidable, { type File as FormidableFile } from 'formidable';

const DEV_ALLOWED_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);
const PROD_ALLOWED_ORIGINS = new Set(['https://admin.newspulse.co.in']);

function isProdDeployment(): boolean {
  if (String(process.env.VERCEL_ENV || '').toLowerCase() === 'production') return true;
  const explicit = String(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '').toLowerCase();
  return explicit === 'production' || explicit === 'prod';
}

function setCors(req: NextApiRequest, res: NextApiResponse) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return;

  const allow = isProdDeployment() ? PROD_ALLOWED_ORIGINS : DEV_ALLOWED_ORIGINS;
  if (!allow.has(origin)) return;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

function cloudinarySignature(params: Record<string, string>, apiSecret: string): string {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort();
  const toSign = keys.map((k) => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

function pickFirstFile(file: FormidableFile | FormidableFile[] | undefined): FormidableFile | null {
  if (!file) return null;
  return Array.isArray(file) ? file[0] : file;
}

async function parseMultipart(req: NextApiRequest): Promise<{ fields: Record<string, any>; files: Record<string, FormidableFile> }> {
  const form = formidable({
    multiples: false,
    maxFileSize: 15 * 1024 * 1024,
    keepExtensions: true,
  });

  return await new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      const normalizedFiles: Record<string, FormidableFile> = {};
      for (const [key, value] of Object.entries(files || {})) {
        const f = pickFirstFile(value as any);
        if (f) normalizedFiles[key] = f;
      }
      resolve({ fields: fields as any, files: normalizedFiles });
    });
  });
}

function requireProdToken(req: NextApiRequest): { ok: true } | { ok: false; status: number; message: string } {
  if (!isProdDeployment()) return { ok: true };

  const expected = toStr(process.env.NEWS_PULSE_ADMIN_UPLOAD_TOKEN).trim();
  if (!expected) {
    return { ok: false, status: 500, message: 'UPLOAD_TOKEN_NOT_CONFIGURED' };
  }

  const auth = toStr(req.headers.authorization).trim();
  const got = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!got || got !== expected) {
    return { ok: false, status: 401, message: 'UNAUTHORIZED' };
  }

  return { ok: true };
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  setCors(req, res);
  noStore(res);

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST,OPTIONS');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const auth = requireProdToken(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ ok: false, message: auth.message });
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

  let parsed: { fields: Record<string, any>; files: Record<string, FormidableFile> } | null = null;
  try {
    parsed = await parseMultipart(req);
  } catch (e: any) {
    return res.status(400).json({ ok: false, message: 'INVALID_MULTIPART', error: String(e?.message || e || '') });
  }

  const folder = toStr(parsed.fields.folder || 'newspulse/cover-images').trim();
  const publicId = toStr(parsed.fields.publicId || '').trim();

  const file = parsed.files.file || parsed.files.image || parsed.files.cover;
  if (!file) {
    return res.status(400).json({ ok: false, message: 'FILE_REQUIRED', field: 'file' });
  }

  const filepath = toStr((file as any).filepath || (file as any).path).trim();
  const originalFilename = toStr((file as any).originalFilename || (file as any).name || 'upload').trim() || 'upload';
  const mimetype = toStr((file as any).mimetype || (file as any).type || 'application/octet-stream').trim();

  if (!filepath) {
    return res.status(400).json({ ok: false, message: 'INVALID_FILE' });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign: Record<string, string> = {
    folder,
    timestamp: String(timestamp),
  };
  if (publicId) paramsToSign.public_id = publicId;

  const signature = cloudinarySignature(paramsToSign, apiSecret);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;

  try {
    const buffer = await fs.readFile(filepath);

    const formData = new FormData();
    formData.set('file', new Blob([buffer], { type: mimetype }), originalFilename);
    formData.set('api_key', apiKey);
    formData.set('timestamp', String(timestamp));
    formData.set('signature', signature);
    formData.set('folder', folder);
    if (publicId) formData.set('public_id', publicId);

    const upstream = await fetch(uploadUrl, { method: 'POST', body: formData });
    const json = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        message: 'CLOUDINARY_UPLOAD_FAILED',
        status: upstream.status,
        error: json,
      });
    }

    return res.status(200).json({
      ok: true,
      url: json?.secure_url || json?.url,
      publicId: json?.public_id,
      width: json?.width,
      height: json?.height,
      bytes: json?.bytes,
      format: json?.format,
      folder: json?.folder || folder,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, message: 'UPLOAD_ERROR', error: String(e?.message || e || '') });
  } finally {
    // Cleanup formidable temp file.
    try {
      await fs.unlink(filepath);
    } catch {
      // ignore
    }
  }
}
