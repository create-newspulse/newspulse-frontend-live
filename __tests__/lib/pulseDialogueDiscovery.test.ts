import { EMPTY_PULSE_FILTERS, PULSE_FORMAT_GROUPS, pulseArticleQuery, pulseFilters, readPulse, uniquePulseStories, publicPulsePhoto } from '../../lib/pulseDialogueDiscovery';

jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => '' }));
const mockFetch = jest.fn();
beforeEach(() => { global.fetch = mockFetch; mockFetch.mockReset(); });

test('uses the four approved format groups without changing stored values', () => {
  expect(PULSE_FORMAT_GROUPS).toEqual({ columns: ['column', 'guest_column'], essays: ['essay', 'literary_essay'], culture: ['culture_ideas'], conversations: ['conversation', 'interview'] });
});
test('combines supported filters with bounded pagination', () => {
  expect(pulseArticleQuery({ q: 'heritage', contributor: 'writer', series: 'ideas', format: 'essay,literary_essay', sort: 'oldest' }, 1001, 100)).toEqual({ q: 'heritage', contributor: 'writer', seriesSlug: 'ideas', dialogueFormat: 'essay,literary_essay', sort: 'oldest', page: '1000', limit: '24' });
  expect(pulseArticleQuery(EMPTY_PULSE_FILTERS)).toEqual({ sort: 'newest', page: '1', limit: '12' });
});
test('normalizes URL input and caps search at 80 characters', () => {
  expect(pulseFilters({ q: 'a'.repeat(90), format: 'essay,invalid,essay', sort: 'invalid' })).toEqual({ ...EMPTY_PULSE_FILTERS, q: 'a'.repeat(80), format: 'essay' });
});
test.each(['en', 'hi', 'gu'] as const)('always supplies %s and only the Pulse endpoint', async (lang) => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, lang, items: [], page: 1, totalPages: 0, hasNextPage: false }) });
  await readPulse('articles', lang, pulseArticleQuery({ ...EMPTY_PULSE_FILTERS, q: 'heritage' }));
  expect(mockFetch).toHaveBeenCalledWith(`/api/public/pulse-dialogue/articles?page=1&limit=12&sort=newest&q=heritage&lang=${lang}`, expect.objectContaining({ signal: expect.anything() }));
});
test('keeps curation order and empty arrays without fabricating a lead', async () => {
  const payload = { ok: true, lang: 'en', featuredDialogue: [{ _id: 'second' }, { _id: 'first' }], featuredVoices: [], formatGroups: { columns: [], essays: [], culture: [], conversations: [] } };
  mockFetch.mockResolvedValue({ ok: true, json: async () => payload });
  expect(await readPulse('discovery', 'en')).toBe(payload);
});
test('does not convert transient errors to empty successful data', async () => {
  mockFetch.mockResolvedValue({ ok: false, status: 503 });
  await expect(readPulse('articles', 'en')).rejects.toThrow('temporarily unavailable');
});
test('excludes the current story across translation documents and deduplicates cards', () => {
  const current = { _id: 'en', translationKey: 'story', slug: 'english' };
  expect(uniquePulseStories([{ _id: 'gu', translationGroupId: 'story', slug: 'gujarati' }, { _id: 'next', translationKey: 'next' }, { _id: 'next-hi', translationKey: 'next' }], [current])).toEqual([{ _id: 'next', translationKey: 'next' }]);
});
test.each(['column', 'guest_column', 'essay', 'literary_essay', 'culture_ideas', 'conversation', 'interview', 'viewpoint', 'expert_perspective', 'open_letter'])('keeps stored article format %s supported without rewriting it', (format) => {
  const filters = pulseFilters({ format });
  expect(filters.format).toBe(format);
  expect(pulseArticleQuery(filters).dialogueFormat).toBe(format);
});
test('invalid or absent portraits render no image', () => {
  expect(publicPulsePhoto('javascript:alert(1)')).toBe('');
  expect(publicPulsePhoto(null)).toBe('');
  expect(publicPulsePhoto('https://example.test/photo.jpg')).toBe('https://example.test/photo.jpg');
});