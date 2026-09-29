/** @jest-environment node */
import handler from '../../../pages/api/public/pulse-dialogue/[...path]';
jest.mock('../../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'http://localhost:3010' }));
function response() {
  const res: any = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res); res.json.mockReturnValue(res); return res;
}
beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ status: 200, json: async () => ({ ok: true, items: [] }) }); });
test('forwards only the bounded public query without credentials', async () => {
  const res = response();
  await handler({ method: 'GET', query: { path: ['articles'], lang: 'hi', q: 'ideas', page: '2', limit: '12' } } as any, res);
  expect(fetch).toHaveBeenCalledWith('http://localhost:3010/api/public/pulse-dialogue/articles?lang=hi&q=ideas&page=2&limit=12', expect.objectContaining({ headers: { Accept: 'application/json' } }));
});
test.each([['admin'], ['contributors', '..', 'articles'], ['series', 'private']])('rejects unsupported path %j', async (...path) => {
  const res = response(); await handler({ method: 'GET', query: { path } } as any, res);
  expect(res.status).toHaveBeenCalledWith(404); expect(fetch).not.toHaveBeenCalled();
});
test('preserves 503 instead of a false empty result', async () => {
  (fetch as jest.Mock).mockRejectedValue(new Error('offline'));
  const res = response(); await handler({ method: 'GET', query: { path: ['discovery'], lang: 'en' } } as any, res);
  expect(res.status).toHaveBeenCalledWith(503);
});
test('strips bodies from public archive cards', async () => {
  (fetch as jest.Mock).mockResolvedValue({ status: 200, json: async () => ({ ok: true, items: [{ _id: 'story', title: 'Title', content: 'body', translations: { en: { content: 'body' } }, translationKey: 'group' }] }) });
  const res = response(); await handler({ method: 'GET', query: { path: ['series', 'ideas', 'articles'], lang: 'en', limit: '4' } } as any, res);
  expect(res.json).toHaveBeenCalledWith({ ok: true, items: [{ _id: 'story', title: 'Title', translationKey: 'group' }] });
});