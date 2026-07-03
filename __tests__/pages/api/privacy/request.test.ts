jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:5000',
}));

import handler from '../../../../pages/api/privacy/request';

describe('pages/api/privacy/request', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('forwards privacy requests to the backend privacy request route', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ ok: true, requestId: 'prv-1' }),
    });

    const req = {
      method: 'POST',
      body: {
        fullName: 'Kiran Parmar',
        email: 'kiran@example.com',
        mobile: '9876543210',
        requestType: 'access',
        message: 'Please share the personal data associated with my account.',
        referenceId: 'ABC-123',
        pageUrl: 'http://localhost:3000/privacy-request',
      },
      headers: {},
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/privacy/request',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })
    );

    const [, init] = (global as any).fetch.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      fullName: 'Kiran Parmar',
      email: 'kiran@example.com',
      mobile: '9876543210',
      requestType: 'access',
      type: 'access',
      message: 'Please share the personal data associated with my account.',
      referenceId: 'ABC-123',
      pageUrl: 'http://localhost:3000/privacy-request',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true, requestId: 'prv-1' });
  });

  it('rejects invalid privacy requests before proxying upstream', async () => {
    const req = {
      method: 'POST',
      body: {
        fullName: '',
        email: 'not-an-email',
        requestType: 'bad-value',
        message: '',
      },
      headers: {},
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, message: 'Invalid privacy request details' });
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