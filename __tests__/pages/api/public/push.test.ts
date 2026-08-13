jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:5000',
}));

import registerHandler from '../../../../pages/api/public/push/register';
import diagnosticsHandler from '../../../../pages/api/public/push/diagnostics';
import preferencesHandler from '../../../../pages/api/public/push/preferences';
import unregisterHandler from '../../../../pages/api/public/push/unregister';

describe('pages/api/public/push/*', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });
  });

  it('proxies register requests to the backend push register route', async () => {
    const req = {
      method: 'POST',
      body: {
        token: 'fcm-token-123',
        registrationType: 'token',
        platform: 'web',
        language: 'gu',
        preferences: { breakingNews: true, analytics: true },
        categories: ['National', 'Gujarat/Regional', 'gujaratRegional', 'invalid-category'],
        email: 'not-forwarded@example.com',
      },
    } as any;
    const res = createMockResponse();

    await registerHandler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/public/push/register',
      expect.objectContaining({ method: 'POST' })
    );
    const [, init] = (global as any).fetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      token: 'fcm-token-123',
      registrationType: 'token',
      platform: 'web',
      language: 'gu',
      preferences: { breakingNews: true },
      categories: ['national', 'gujarat'],
    });
    expect(JSON.parse(init.body).categories).not.toContain('National');
    expect(JSON.parse(init.body).categories).not.toContain('Gujarat/Regional');
    expect(JSON.parse(init.body).categories).not.toContain('gujaratRegional');
    expect(JSON.parse(init.body).categories).not.toContain('invalid-category');
    expect(res.statusCode).toBe(200);
  });

  it('proxies preference updates with PUT', async () => {
    const req = {
      method: 'PUT',
      body: {
        token: 'fcm-token-123',
        registrationType: 'token',
        platform: 'web',
        language: 'hi',
        preferences: { allArticles: true },
        categories: [],
      },
    } as any;
    const res = createMockResponse();

    await preferencesHandler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/public/push/preferences',
      expect.objectContaining({ method: 'PUT' })
    );
    expect(res.statusCode).toBe(200);
  });

  it('proxies unregister requests with DELETE and accepts POST too', async () => {
    const deleteReq = {
      method: 'DELETE',
      body: { token: 'fcm-token-123', registrationType: 'token' },
    } as any;
    const deleteRes = createMockResponse();

    await unregisterHandler(deleteReq, deleteRes as any);

    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/public/push/unregister',
      expect.objectContaining({ method: 'DELETE' })
    );

    const postReq = {
      method: 'POST',
      body: { token: 'fcm-token-123', registrationType: 'token' },
    } as any;
    const postRes = createMockResponse();

    await unregisterHandler(postReq, postRes as any);

    expect((global as any).fetch).toHaveBeenLastCalledWith(
      'http://127.0.0.1:5000/api/public/push/unregister',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('rejects missing registration details before proxying upstream', async () => {
    const req = { method: 'POST', body: { registrationId: '' } } as any;
    const res = createMockResponse();

    await registerHandler(req, res as any);

    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, message: 'Invalid push registration details' });
  });

  it('rejects fid-only registration details before proxying upstream', async () => {
    const req = { method: 'POST', body: { registrationId: 'fid-123', registrationType: 'fid' } } as any;
    const res = createMockResponse();

    await registerHandler(req, res as any);

    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, message: 'Invalid push registration details' });
  });

  it('safely proxies optional push diagnostics without requiring a registration identifier', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, firebaseBackendConfigured: true, messagingAvailable: true }),
    });
    const req = { method: 'GET' } as any;
    const res = createMockResponse();

    await diagnosticsHandler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/public/push/diagnostics',
      expect.objectContaining({ method: 'GET' })
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, firebaseBackendConfigured: true, messagingAvailable: true });
  });
});

function createMockResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: undefined as any,
    setHeader(name: string, value: string | string[]) {
      response.headers[name] = value;
    },
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(payload: any) {
      response.body = payload;
      return response;
    },
  };

  return response;
}