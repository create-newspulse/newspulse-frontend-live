/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { buildSocialImageUrl, normalizeSocialImageSource, parseArticleSocialImage } from '../../lib/articleSocialImage';
import { withArticleSocialImage } from '../../lib/articleSocialImage.server';
import { buildArticleSeoMetadata } from '../../lib/seo';

const jpeg = readFileSync(join(process.cwd(), 'public', 'brand', 'news-pulse-social.jpg'));
const originalFetch = global.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
let sequence = 0;
const story = () => ({
  _id: `social-${++sequence}`, status: 'published', language: 'en', category: 'national',
  title: 'Public headline', summary: 'Public summary', slug: 'public-headline',
  coverImageUrl: `https://res.cloudinary.com/fixture/image/upload/v1/news/cover-${sequence}.png`,
});
const imageResponse = (bytes = jpeg, headers: Record<string, string> = {}) =>
  new Response(Uint8Array.from(bytes), { headers: { 'Content-Type': 'image/jpeg', ...headers } });

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => imageResponse());
  global.fetch = fetchMock;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('serves a fully decodable, correctly described, small official branding derivative', async () => {
  const image = sharp(jpeg);
  expect(await image.metadata()).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
  await expect(image.raw().toBuffer()).resolves.toBeInstanceOf(Buffer);
  expect(jpeg.byteLength).toBeLessThan(300_000);
  const seo = buildArticleSeoMetadata({ ...story(), coverImageUrl: '' }, 'en', 'https://www.newspulse.co.in');
  expect(seo).toMatchObject({
    ogImage: 'https://www.newspulse.co.in/brand/news-pulse-social.jpg',
    ogImageType: 'image/jpeg', ogImageWidth: 1200, ogImageHeight: 630,
  });
});

test.each([
  'https://localhost/private.jpg', 'http://127.0.0.1/image.jpg',
  'https://res.cloudinary.com.evil.test/fixture/image/upload/photo.jpg',
  'https://user:secret@res.cloudinary.com/fixture/image/upload/photo.jpg',
  'https://res.cloudinary.com:8443/fixture/image/upload/photo.jpg',
  'https://res.cloudinary.com/fixture/image/fetch/https://private.test/photo.jpg',
  'https://res.cloudinary.com/fixture/image/authenticated/photo.jpg',
  'https://res.cloudinary.com/fixture/image/upload/s--signature--/photo.jpg',
  'https://res.cloudinary.com/fixture/image/upload/t_private/photo.jpg',
  'https://res.cloudinary.com/fixture/image/upload/l_fetch:private/photo.jpg',
  'https://res.cloudinary.com/fixture/image/upload/e_gen_fill/photo.jpg',
  'https://res.cloudinary.com/fixture/image/upload/c_fill,w_500/photo.jpg',
  'https://res.cloudinary.com/fixture/image/upload/photo.jpg?token=secret',
  'https://res.cloudinary.com/fixture/image/upload/https%3A%2F%2Fprivate/photo.jpg',
  'https://res.cloudinary.com/fixture/image/upload/photo.svg',
  'data:image/jpeg;base64,private', 'blob:private', '/uploads/unverified.jpg',
])('uses branding without requesting an unsupported image source: %s', async coverImageUrl => {
  const article = { ...story(), coverImageUrl };
  expect(normalizeSocialImageSource(coverImageUrl)).toBe('');
  const result = await withArticleSocialImage(article, 'en', 4000);
  expect(result.socialImage).toBeUndefined();
  expect(result.coverImageUrl).toBe(coverImageUrl);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('verifies once across concurrent requests, retains originals, and rechecks replacement/versioned covers', async () => {
  const article = story();
  const before = JSON.stringify(article);
  const [first, concurrent] = await Promise.all([
    withArticleSocialImage(article, 'en', 4000), withArticleSocialImage(article, 'en', 4000),
  ]);
  expect(first.socialImage).toEqual({
    source: article.coverImageUrl, url: buildSocialImageUrl(article.coverImageUrl, 75),
    type: 'image/jpeg', width: 1200, height: 630, bytes: jpeg.length,
  });
  expect(concurrent.socialImage).toEqual(first.socialImage);
  expect(JSON.stringify(article)).toBe(before);
  expect(first.coverImageUrl).toBe(article.coverImageUrl);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual', cache: 'no-store', method: 'GET' });
  expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty('cookie');
  expect((await withArticleSocialImage(article, 'en', 0)).socialImage).toEqual(first.socialImage);
  const replacement = { ...first, coverImageUrl: article.coverImageUrl.replace('/v1/', '/v2/') };
  const updated = await withArticleSocialImage(replacement, 'en', 4000);
  expect(updated.socialImage?.source).toBe(replacement.coverImageUrl);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const removed = await withArticleSocialImage({ ...updated, coverImage: { removed: true } }, 'en', 4000);
  expect(removed.socialImage).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('lowers quality after a measured oversized image, including a false Content-Length', async () => {
  fetchMock.mockResolvedValueOnce(imageResponse(Buffer.alloc(300_000), { 'Content-Length': '20' }));
  const article = story();
  const result = await withArticleSocialImage(article, 'en', 4000);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    buildSocialImageUrl(article.coverImageUrl, 75), buildSocialImageUrl(article.coverImageUrl, 55),
  ]);
  expect(result.socialImage?.url).toBe(buildSocialImageUrl(article.coverImageUrl, 55));
  expect(result.socialImage?.bytes).toBe(jpeg.length);
});

test('falls back after all quality levels exceed the measured byte budget', async () => {
  fetchMock.mockImplementation(async () => imageResponse(jpeg, { 'Content-Length': '300000' }));
  expect((await withArticleSocialImage(story(), 'en', 4000)).socialImage).toBeUndefined();
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[social-preview]'), { reason: 'oversized' });
});

test.each(['redirect', '404', 'wrong-mime', 'corrupt', 'wrong-dimensions'] as const)('rejects %s without breaking the article read', async scenario => {
  let response: Response;
  if (scenario === 'redirect') response = new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } });
  else if (scenario === '404') response = new Response(null, { status: 404 });
  else if (scenario === 'wrong-mime') response = imageResponse(jpeg, { 'Content-Type': 'image/png' });
  else if (scenario === 'corrupt') response = imageResponse(jpeg.subarray(0, 100));
  else response = imageResponse(await sharp(jpeg).resize(800, 420).jpeg().toBuffer());
  fetchMock.mockResolvedValueOnce(response);
  const article = story();
  expect(await withArticleSocialImage(article, 'en', 4000)).toEqual(article);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalled();
});

test('bounds a slow read within the caller deadline and retries after the short failure cache', async () => {
  jest.useFakeTimers();
  let signal: AbortSignal | null | undefined;
  fetchMock.mockImplementationOnce((_url, init) => {
    signal = init?.signal;
    return new Promise<Response>(() => {});
  });
  const article = story();
  const pending = withArticleSocialImage(article, 'en', 600);
  await jest.advanceTimersByTimeAsync(500);
  expect(await pending).toEqual(article);
  expect(signal?.aborted).toBe(true);
  expect(await withArticleSocialImage(article, 'en', 4000)).toEqual(article);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(15_000);
  expect((await withArticleSocialImage(article, 'en', 4000)).socialImage?.bytes).toBe(jpeg.length);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each([
  { status: 'draft' }, { status: 'unpublished' }, { deleted: true },
  { status: 'restricted' }, { visibility: 'private' }, { isPrivate: true },
])('never verifies private or withdrawn article images: %j', async lifecycle => {
  const article = { ...story(), ...lifecycle };
  expect((await withArticleSocialImage(article, 'en', 4000)).socialImage).toBeUndefined();
  expect(buildArticleSeoMetadata(article, 'en', 'https://www.newspulse.co.in')).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('discards supplied image claims and verifies the current source rather than an arbitrary descriptor URL', async () => {
  const article = story();
  const spoofed = {
    source: article.coverImageUrl, url: 'https://private.test/image.jpg',
    width: 1200, height: 630, type: 'image/jpeg' as const, bytes: 42,
  };
  expect(parseArticleSocialImage(spoofed)).toBeNull();
  const result = await withArticleSocialImage({ ...article, socialImage: spoofed }, 'en', 4000);
  expect(result.socialImage?.url).toBe(buildSocialImageUrl(article.coverImageUrl, 75));
  expect(fetchMock.mock.calls[0][0]).not.toBe(spoofed.url);
});
