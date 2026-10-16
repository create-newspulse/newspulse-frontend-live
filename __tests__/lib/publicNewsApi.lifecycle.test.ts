/** @jest-environment node */

import { fetchPublicNewsById, fetchPublicNewsGroup, parsePublicNewsArticle, parsePublicNewsGroupItems } from '../../lib/publicNewsApi';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY } from '../../lib/localizedArticleFields';
import { resolveCoverImageUrl } from '../../lib/coverImages';
import { buildArticleSeoMetadata, getArticleCanonicalUrl } from '../../lib/seo';
import { getArticleAuthorDesignation, getArticleAuthorName, getArticleReadingTime, getImageAltText, getImageCaption, getImageCredit } from '../../lib/editorialDisplay';
import { getPulseDialogueMetadata } from '../../lib/pulseDialogue';
import { resolveSponsoredContentMeta } from '../../lib/sponsoredContent';

jest.mock('../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://backend.test',
}));

const story = { _id: 'article-1', language: 'en', status: 'published', title: 'Story', content: '<p>Body</p>' };
const originalFetch = global.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test.each([
  [], { items: [] }, { articles: [] }, { data: [] }, { result: [] },
  { data: { items: [] } }, { data: { articles: [] } },
])('recognizes authoritative empty group shape %j', (payload) => {
  expect(parsePublicNewsGroupItems(payload)).toEqual([]);
});

test.each([
  null, {}, '', { items: null }, { items: [null] }, { items: [{}] },
  { items: [{ _id: ' ' }] }, { ok: false, items: [] },
  { success: false, items: [] }, { error: 'private failure', items: [] },
  { data: { ok: false, items: [] } },
])('does not misclassify invalid group payload %j as authoritative empty', (payload) => {
  expect(parsePublicNewsGroupItems(payload)).toBeNull();
});

test.each(['en', 'hi', 'gu'])('uses the existing ID and group endpoints with %s and no-store', async (language) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: story })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [story] })));
  const controller = new AbortController();
  expect((await fetchPublicNewsById({ id: story._id, language, signal: controller.signal })).article).toEqual(story);
  expect((await fetchPublicNewsGroup({ translationGroupId: 'group-1', language, signal: controller.signal })).items).toEqual([story]);
  expect(String(fetchMock.mock.calls[0][0])).toBe(`http://backend.test/api/public/news/article-1?lang=${language}&language=${language}`);
  expect(String(fetchMock.mock.calls[1][0])).toBe(`http://backend.test/api/public/news/group/group-1?lang=${language}&language=${language}`);
  for (const [, init] of fetchMock.mock.calls) {
    expect(init).toMatchObject({ cache: 'no-store', signal: controller.signal });
  }
});

test.each([{}, null, { article: null }, { ok: false, article: story }])('malformed article success %j is not an invented 404', async (payload) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload)));
  const result = await fetchPublicNewsById({ id: story._id });
  expect(result.article).toBeNull();
  expect(result.error).toBeTruthy();
  expect(result.status).toBeUndefined();
});

test.each([404, 410, 429, 500, 503])('keeps HTTP %s separate from invalid success and never exposes private error bodies', async (status) => {
  const response = new Response('private upstream diagnostics', { status });
  const readBody = jest.spyOn(response, 'json');
  fetchMock.mockResolvedValue(response);
  const detail = await fetchPublicNewsById({ id: story._id });
  const group = await fetchPublicNewsGroup({ translationGroupId: 'group-1' });
  expect(detail).toMatchObject({ article: null, status, error: `API ${status}` });
  expect(group).toMatchObject({ items: [], status, error: `API ${status}` });
  expect(readBody).not.toHaveBeenCalled();
});

test.each(['network', 'JSON', 'invalid shape'])('%s failure is explicit for both article and group reads', async (stage) => {
  if (stage === 'network') fetchMock.mockRejectedValue(new Error('private network diagnostics'));
  else fetchMock.mockImplementation(async () => new Response(stage === 'JSON' ? 'not JSON' : '{}'));
  const detail = await fetchPublicNewsById({ id: story._id });
  const group = await fetchPublicNewsGroup({ translationGroupId: 'group-1' });
  expect(detail.article).toBeNull();
  expect(detail.error).toBeTruthy();
  expect(detail.status).toBeUndefined();
  expect(group.items).toEqual([]);
  expect(group.error).toBeTruthy();
  expect(JSON.stringify([detail, group])).not.toContain('private');
});

test('does not filter out lifecycle tombstones before the caller can reconcile them', async () => {
  const withdrawn = { ...story, status: 'draft', isDeleted: true };
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: withdrawn })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [withdrawn] })));
  expect((await fetchPublicNewsById({ id: story._id })).article).toEqual(withdrawn);
  expect((await fetchPublicNewsGroup({ translationGroupId: 'group-1' })).items).toEqual([withdrawn]);
});

test.each([
  { _id: story._id },
  { ...story, deletedAt: { unexpected: true } },
  { ...story, deletedAt: 'not a date' },
  { ...story, archivedAt: [] },
  { ...story, isDeleted: 'false' },
  { ...story, published: 'true' },
  { ...story, publishedAt: 'not a date' },
  { ...story, status: { value: 'published' } },
  { ...story, updatedAt: {} },
  { ...story, syncVersion: {} },
  { ...story, sourceLang: {} },
  { ...story, error: 'synthetic-private-diagnostic' },
  { ...story, errors: ['synthetic-private-diagnostic'] },
  { ...story, translations: { hi: { error: 'synthetic-private-diagnostic' } } },
  { ...story, translationStatus: { hi: { status: 'APPROVED' } } },
])('rejects an untrusted lifecycle record without inventing absence: %j', async (record) => {
  expect(parsePublicNewsArticle({ article: record })).toBeNull();
  expect(parsePublicNewsGroupItems({ items: [story, record] })).toBeNull();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: record })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [record] })));
  const detail = await fetchPublicNewsById({ id: story._id });
  const group = await fetchPublicNewsGroup({ translationGroupId: 'group-1' });
  expect(detail).toMatchObject({ article: null, error: 'Invalid article response' });
  expect(detail.status).toBeUndefined();
  expect(group).toMatchObject({ items: [], error: 'Invalid translation group response' });
  expect(JSON.stringify([detail, group])).not.toContain('synthetic-private');
});

test.each([
  { _id: 'legacy', publishedAt: '2025-01-01T00:00:00.000Z' },
  { _id: 'legacy', isPublished: true, deletedAt: null, archivedAt: '' },
  { _id: 'legacy', published: false },
  { _id: 'legacy', state: 'published' },
  { _id: 'legacy', status: 'draft' },
  { _id: 'legacy', deleted: true },
  { _id: 'legacy', archivedAt: '2025-01-01T00:00:00.000Z' },
])('retains legitimate legacy lifecycle markers without requiring a group or modern metadata: %j', (record) => {
  expect(parsePublicNewsArticle({ article: record })).toEqual(record);
  expect(parsePublicNewsGroupItems({ items: [record] })).toEqual([record]);
});

test('projects only public render/lifecycle fields, including nested localized and byline fields', () => {
  const record = {
    ...story,
    category: { slug: 'national', name: 'National', secret: 'synthetic-private-category' },
    seo: { metaDescription: 'Public description', internalUrl: 'synthetic-private-url' },
    translations: {
      hi: {
        title: 'Localized title', content: '<p>Localized body</p>', status: 'APPROVED',
        debug: 'synthetic-private-translation',
      },
    },
    authorByline: {
      enabled: true,
      snapshot: { name: 'Public author', shortBio: 'Public bio', token: 'synthetic-private-token' },
    },
    transport: { requestId: 'synthetic-private-request' },
  };
  const safe = parsePublicNewsArticle({ article: record, internalUrl: 'synthetic-private-envelope' });
  expect(safe).toEqual({
    ...story,
    category: { slug: 'national', name: 'National' },
    seo: { metaDescription: 'Public description' },
    translations: { hi: { title: 'Localized title', content: '<p>Localized body</p>', status: 'APPROVED' } },
    authorByline: { enabled: true, snapshot: { name: 'Public author', shortBio: 'Public bio' } },
  });
  expect(parsePublicNewsGroupItems({ data: { items: [record] } })).toEqual([safe]);
  expect(JSON.stringify(safe)).not.toContain('synthetic-private');
});

test.each([
  {
    title: { en: 'English title', hi: 'Localized title' },
    content: { en: '<p>English body</p>', hi: '<p>Localized body</p>' },
    translationStatus: { hi: 'APPROVED' },
    image: { url: 'https://images.test/public.jpg', status: 'active', credit: 'Public credit' },
  },
  {
    translations: {
      title: { hi: { text: 'Localized title', status: 'APPROVED' } },
      content: { hi: { html: '<p>Localized body</p>', status: 'APPROVED' } },
    },
  },
  {
    title: { value: { hi: 'Localized title' } },
    content: { hi: { html: '<p>Localized body</p>' } },
    translationStatus: { hi: 'APPROVED' },
  },
  { titleHi: 'Localized title', contentHi: '<p>Localized body</p>', translationStatus: { hi: 'APPROVED' } },
  {
    source: { title: 'Source title', content: '<p>Source body</p>' },
    i18n: { gu: { title: 'Localized title', content: '<p>Localized body</p>', status: 'APPROVED' } },
    seo: { gu: { canonicalUrl: '/gu/news/localized-story' } },
  },
  {
    translations: {},
    translation: { hi: { title: 'Localized title', content: '<p>Localized body</p>', status: 'APPROVED' } },
  },
])('preserves existing legacy localization, image, and canonical resolution: %j', (fields) => {
  const record = { ...story, ...fields };
  const safe = parsePublicNewsArticle({ article: record });
  expect(safe).not.toBeNull();
  for (const lang of ['en', 'hi', 'gu']) {
    expect(getLocalizedArticleFields(safe, lang, STRICT_LOCALE_POLICY)).toEqual(getLocalizedArticleFields(record, lang, STRICT_LOCALE_POLICY));
    expect(resolveCoverImageUrl(safe, { lang })).toBe(resolveCoverImageUrl(record, { lang }));
    expect(getArticleCanonicalUrl(safe, lang, 'https://public.test')).toBe(getArticleCanonicalUrl(record, lang, 'https://public.test'));
  }
});

test.each([
  {
    category: 'editorial', authorName: { name: 'Public author' }, authorDesignation: { label: 'Analyst' },
    readingTime: { name: '4 min read' }, imageCaption: { name: 'Public caption' }, imageCredit: { name: 'Public credit' },
  },
  { imageUrl: { url: 'https://images.test/legacy.jpg', alt: 'Public image' } },
  { isSponsored: true, sponsorName: 'Public partner', metadata: { ctaButton: { label: 'Learn more', href: 'https://sponsor.test/story' } } },
  {
    category: 'pulse-dialogue',
    pulseDialogue: {
      contributorSlug: 'public-author', profileAvailable: true, dialogueFormat: 'column',
      bylineSnapshot: { name: 'Public author', designation: 'Guest', photo: { asset: { secure_url: 'https://images.test/portrait.jpg' } } },
      contributor: { id: 'contributor-1', shortBio: 'Public bio' }, showAboutContributor: true,
    },
  },
])('preserves existing public render metadata while removing transport fields: %j', (fields) => {
  const record = { ...story, ...fields, transport: { token: 'synthetic-private-token' } };
  const safe = parsePublicNewsArticle({ article: record });
  expect(safe).not.toBeNull();
  for (const lang of ['en', 'hi', 'gu'] as const) {
    const rendered = (value: unknown) => ({
      seo: buildArticleSeoMetadata(value, lang, 'https://public.test'),
      cover: resolveCoverImageUrl(value, { lang }),
      author: getArticleAuthorName(value), designation: getArticleAuthorDesignation(value),
      readingTime: getArticleReadingTime(value), caption: getImageCaption(value, lang),
      credit: getImageCredit(value, lang), alt: getImageAltText(value, lang),
      pulseDialogue: getPulseDialogueMetadata(value), sponsorship: resolveSponsoredContentMeta(value, lang),
    });
    expect(rendered(safe)).toEqual(rendered(record));
  }
  expect(JSON.stringify(safe)).not.toContain('synthetic-private');
});
