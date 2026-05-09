jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:5000',
}));

import handler from '../../../../pages/api/public/grievance';

describe('pages/api/public/grievance', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('forwards grievance submissions to the backend public grievance route', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ ok: true, grievanceId: 'grv-1' }),
    });

    const req = {
      method: 'POST',
      body: {
        fullName: 'Kiran Parmar',
        email: 'kiran@example.com',
        phone: '9876543210',
        address: '123 News Street, Ahmedabad - 380001',
        articleReference: 'https://www.newspulse.co.in/sample-story',
        publicationDate: '2026-05-10',
        publicationViolation: 'A specific paragraph is in dispute.',
        violationSummary: 'The paragraph contains an alleged factual inaccuracy requiring review.',
        declarationAccepted: true,
        pageUrl: 'http://localhost:3000/grievance-redressal',
      },
      headers: {},
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/public/grievance',
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
      phone: '9876543210',
      address: '123 News Street, Ahmedabad - 380001',
      articleReference: 'https://www.newspulse.co.in/sample-story',
      publicationDate: '2026-05-10',
      publicationViolation: 'A specific paragraph is in dispute.',
      violationSummary: 'The paragraph contains an alleged factual inaccuracy requiring review.',
      declarationAccepted: true,
      pageUrl: 'http://localhost:3000/grievance-redressal',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true, grievanceId: 'grv-1' });
  });

  it('rejects invalid grievance submissions before proxying upstream', async () => {
    const req = {
      method: 'POST',
      body: {
        fullName: 'Kiran Parmar',
        email: 'not-an-email',
        phone: '',
        address: '',
        articleReference: '',
        publicationDate: '',
        publicationViolation: '',
        violationSummary: '',
        declarationAccepted: false,
      },
      headers: {},
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ ok: false, message: 'Invalid grievance details' });
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