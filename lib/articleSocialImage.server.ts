import sharp from 'sharp';
import {
  buildSocialImageUrl, SOCIAL_IMAGE_FALLBACK_PATH, SOCIAL_IMAGE_HEIGHT, SOCIAL_IMAGE_MAX_BYTES, SOCIAL_IMAGE_QUALITIES,
  SOCIAL_IMAGE_WIDTH, type ArticleSocialImage,
} from './articleSocialImage';
import { getArticleSocialImageSources } from './seo';
import type { RouteLocale } from './localizedArticleFields';
import type { Article } from './publicNewsApi';
import { PublicReadTimeoutError, withPublicReadDeadline } from './publicReadDeadline';
import type { PreviewImageFailure } from './socialPreviewDiagnostics.server';

const cache = new Map<string, { expiresAt: number; image: ArticleSocialImage | null }>();
const inFlight = new Map<string, Promise<ArticleSocialImage | null>>();
const MAX_CACHE_ENTRIES = 256;

class ImageReadError extends Error {
  constructor(readonly reason: PreviewImageFailure) { super(reason); }
}

async function readImage(source: string, quality: typeof SOCIAL_IMAGE_QUALITIES[number], signal: AbortSignal): Promise<ArticleSocialImage> {
  const url = buildSocialImageUrl(source, quality);
  const response = await fetch(url, {
    method: 'GET', redirect: 'manual', cache: 'no-store', signal,
    headers: { Accept: 'image/jpeg', 'User-Agent': 'NewsPulse-SocialPreview/1.0' },
  });
  if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'image/jpeg') {
    await response.body?.cancel();
    throw new ImageReadError('unusable_response');
  }
  if (Number(response.headers.get('content-length')) >= SOCIAL_IMAGE_MAX_BYTES) {
    await response.body?.cancel();
    throw new ImageReadError('oversized');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ImageReadError('missing_body');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes >= SOCIAL_IMAGE_MAX_BYTES) throw new ImageReadError('oversized');
      chunks.push(next.value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const buffer = Buffer.concat(chunks);
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) throw new ImageReadError('invalid_format');
  const image = sharp(buffer, { failOn: 'warning', limitInputPixels: SOCIAL_IMAGE_WIDTH * SOCIAL_IMAGE_HEIGHT });
  const metadata = await image.metadata();
  if (metadata.format !== 'jpeg' || metadata.width !== SOCIAL_IMAGE_WIDTH || metadata.height !== SOCIAL_IMAGE_HEIGHT) {
    throw new ImageReadError('invalid_dimensions_or_format');
  }
  await image.raw().toBuffer();
  signal.throwIfAborted();
  return { source, url, width: metadata.width, height: metadata.height, type: 'image/jpeg', bytes };
}

async function verifySource(source: string, timeoutMs: number, onFailure?: (reason: PreviewImageFailure) => void): Promise<ArticleSocialImage | null> {
  const cached = cache.get(source);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.image) onFailure?.('cached_unavailable');
    return cached.image;
  }
  if (timeoutMs <= 0) throw new PublicReadTimeoutError();
  const pending = inFlight.get(source);
  if (pending) {
    const image = await withPublicReadDeadline(timeoutMs, () => pending);
    if (!image) onFailure?.('shared_unavailable');
    return image;
  }
  if (inFlight.size >= 32) {
    onFailure?.('capacity');
    console.error('[social-preview] Image verification capacity reached');
    return null;
  }
  const request = withPublicReadDeadline(timeoutMs, async signal => {
    for (const quality of SOCIAL_IMAGE_QUALITIES) {
      try {
        return await readImage(source, quality, signal);
      } catch (error) {
        if (!(error instanceof ImageReadError) || error.reason !== 'oversized') throw error;
      }
    }
    throw new ImageReadError('oversized');
  }).catch(error => {
    const reason = error instanceof PublicReadTimeoutError ? 'timeout'
      : error instanceof ImageReadError ? error.reason : 'image_read_failed';
    onFailure?.(reason);
    console.error('[social-preview] Image unavailable; using the next safe image', { reason });
    return null;
  }).then(image => {
    const oldest = cache.keys().next().value;
    if (cache.size >= MAX_CACHE_ENTRIES && oldest) cache.delete(oldest);
    const successTtl = /\/image\/upload\/v\d+\//.test(source) ? 60 * 60 * 1000 : 60_000;
    cache.set(source, { image, expiresAt: Date.now() + (image ? successTtl : 15_000) });
    return image;
  }).finally(() => { inFlight.delete(source); });
  inFlight.set(source, request);
  return request;
}

export async function withArticleSocialImage(
  article: Article, locale: RouteLocale, remainingMs: number, onFailure?: (reason: PreviewImageFailure) => void,
): Promise<Article> {
  // Leave response headroom inside the existing public-read deadline.
  const deadlineAt = performance.now() + Math.min(1500, Math.max(0, remainingMs - 100));
  for (const source of getArticleSocialImageSources(article, locale)) {
    if (source === SOCIAL_IMAGE_FALLBACK_PATH) break;
    const timeoutMs = deadlineAt - performance.now();
    try {
      const socialImage = await verifySource(source, timeoutMs, onFailure);
      if (socialImage) return { ...article, socialImage };
    } catch (error) {
      if (!(error instanceof PublicReadTimeoutError)) throw error;
      onFailure?.('timeout');
      console.error('[social-preview] Image verification deadline exhausted', { locale });
      break;
    }
  }
  const { socialImage: _unverified, ...withoutImage } = article;
  return withoutImage;
}
