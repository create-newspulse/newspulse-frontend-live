/** @jest-environment node */

function article(overrides: Record<string, any>) {
  return {
    _id: 'article-1',
    title: 'Published article',
    summary: 'Summary',
    slug: 'published-article',
    language: 'en',
    status: 'published',
    publishedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('publicNewsApi visibility filtering', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NEXT_PUBLIC_API_BASE_DEV: 'http://backend.test' };
    delete process.env.NEXT_PUBLIC_API_BASE;
    delete process.env.VERCEL_ENV;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('filters draft articles even when the public API response contains them', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          article({ _id: 'published-1', title: 'Public story' }),
          article({ _id: 'draft-1', title: 'Draft story', status: 'draft', publishedAt: '2026-09-02T10:00:00.000Z' }),
        ],
      }),
    });

    const { fetchPublicNews } = await import('../../lib/publicNewsApi');
    const result = await fetchPublicNews({ language: 'en', limit: 10 });

    expect(result.items.map((item) => item._id)).toEqual(['published-1']);
    expect(result.items.map((item) => item.title)).not.toContain('Draft story');
  });
});