export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;
export const SOCIAL_IMAGE_MAX_BYTES = 300_000;
export const SOCIAL_IMAGE_FALLBACK_PATH = '/brand/news-pulse-social.jpg';
export const SOCIAL_IMAGE_QUALITIES = [75, 55, 35] as const;

export type ArticleSocialImage = {
  source: string;
  url: string;
  width: number;
  height: number;
  type: 'image/jpeg';
  bytes: number;
};

export function normalizeSocialImageSource(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048 || value.includes('\\')) return '';
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.hostname !== 'res.cloudinary.com'
      || url.port || url.username || url.password || url.search || url.hash) return '';
    const parts = url.pathname.slice(1).split('/').map(decodeURIComponent);
    if (!/^[a-z0-9_-]+$/i.test(parts[0]) || parts[1] !== 'image' || parts[2] !== 'upload' || parts.length < 4) return '';
    const asset = parts.slice(3);
    // Only public upload assets, never signed URLs, named transformations or remote-fetch layers.
    if (asset.some(part => !/^[\p{L}\p{M}\p{N}_.-]+$/u.test(part) || part === '.' || part === '..')
      || /^s--/.test(asset[0])
      || (asset.length > 1 && /^[a-z]{1,3}_/.test(asset[0]))) return '';
    const file = asset[asset.length - 1];
    if (file.includes('.') && !/\.(?:jpe?g|png|webp|avif|gif)$/i.test(file)) return '';
    url.protocol = 'https:';
    url.pathname = '/' + parts.map(encodeURIComponent).join('/');
    return url.toString();
  } catch {
    return '';
  }
}

export function isOfficialSocialImage(value: string): boolean {
  return ['/brand/news-pulse-final-logo.png', SOCIAL_IMAGE_FALLBACK_PATH].some(path =>
    value === path || value === `https://www.newspulse.co.in${path}`
  );
}

export function buildSocialImageUrl(source: string, quality: typeof SOCIAL_IMAGE_QUALITIES[number]): string {
  const normalized = normalizeSocialImageSource(source);
  if (!normalized) return '';
  const url = new URL(normalized);
  url.pathname = url.pathname.replace('/image/upload/', `/image/upload/c_pad,w_${SOCIAL_IMAGE_WIDTH},h_${SOCIAL_IMAGE_HEIGHT},b_white,f_jpg,q_${quality}/`)
    .replace(/\.(?:jpe?g|png|webp|avif|gif)$/i, '.jpg');
  return url.toString();
}

export function parseArticleSocialImage(value: unknown): ArticleSocialImage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const image = value as Record<string, unknown>;
  const source = normalizeSocialImageSource(image.source);
  if (!source || image.source !== source || typeof image.url !== 'string'
    || !SOCIAL_IMAGE_QUALITIES.some(quality => buildSocialImageUrl(source, quality) === image.url)
    || image.width !== SOCIAL_IMAGE_WIDTH || image.height !== SOCIAL_IMAGE_HEIGHT || image.type !== 'image/jpeg'
    || typeof image.bytes !== 'number' || !Number.isSafeInteger(image.bytes) || image.bytes <= 0 || image.bytes >= SOCIAL_IMAGE_MAX_BYTES) return null;
  return { source, url: image.url, width: image.width, height: image.height, type: image.type, bytes: image.bytes };
}
