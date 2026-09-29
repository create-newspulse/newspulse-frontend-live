/** @jest-environment node */
import type { NextApiRequest } from 'next';
import handler, { config } from '../../../pages/api/community-reporter/upload-id';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

jest.mock('../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: jest.fn(() => { throw new Error('Backend resolution must not occur'); }),
}));

function response() {
  const res: any = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, 'fetch').mockImplementation(() => { throw new Error('Network requests must not occur'); });
});
afterEach(() => jest.restoreAllMocks());

test.each(['multipart/form-data; boundary=upload', 'application/json', undefined])('POST returns the exact controlled 404 without processing %s uploads', async (contentType) => {
  const readBody = jest.fn(() => { throw new Error('Request body must not be read'); });
  const req = { method: 'POST', headers: { 'content-type': contentType } };
  for (const property of ['body', 'pipe', 'read', 'on', Symbol.asyncIterator]) {
    Object.defineProperty(req, property, { get: readBody });
  }
  const res = response();

  await handler(req as NextApiRequest, res);

  expect(res.status).toHaveBeenCalledTimes(1);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledTimes(1);
  expect(res.json).toHaveBeenCalledWith({
    ok: false,
    code: 'JOURNALIST_VERIFICATION_NOT_AVAILABLE',
    message: 'Journalist verification is not currently available.',
  });
  expect(readBody).not.toHaveBeenCalled();
  expect(getPublicApiBaseUrl).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

test.each(['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', undefined])('%s preserves the 405 response and Allow header', async (method) => {
  const res = response();

  await handler({ method } as NextApiRequest, res);

  expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST');
  expect(res.status).toHaveBeenCalledWith(405);
  expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  expect(getPublicApiBaseUrl).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

test('disables automatic Next body parsing before the handler rejects uploads', () => {
  expect(config.api.bodyParser).toBe(false);
});