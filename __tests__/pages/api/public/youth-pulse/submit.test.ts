jest.mock('../../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:5000',
}));

import handler from '../../../../../pages/api/public/youth-pulse/submit';

describe('pages/api/public/youth-pulse/submit', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('forwards Youth Pulse submissions to the backend public community submit route', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, settings: { youthPulseSubmissionsClosed: false } }),
    });
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ success: true, id: 'story-1', status: 'NEW' }),
    });

    const req = {
      method: 'POST',
      body: {
        reporterName: 'Student Reporter',
        reporterEmail: 'student@example.com',
        category: 'Youth / Campus',
        source: 'youth_pulse',
      },
      headers: {},
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:5000/api/public/feature-toggles',
      expect.objectContaining({ method: 'GET' })
    );
    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/public/community-reporter/submit',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })
    );

    const [, init] = (global as any).fetch.mock.calls[1];
    const body = JSON.parse(init.body);

    expect(body.reporterType).toBe('community');
    expect(body.desk).toBe('youth-pulse');
    expect(body.submissionType).toBe('youth-pulse');
    expect(body.source).toBe('youth_pulse');
    expect(body.autoPublish).toBe(false);
    expect(body.publishRequested).toBe(false);
    expect(body.moderationRequired).toBe(true);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ success: true, id: 'story-1', status: 'NEW' });
  });

  it('blocks submissions gracefully when the Youth Pulse toggle is closed', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, settings: { youthPulseSubmissionsClosed: true } }),
    });

    const req = {
      method: 'POST',
      body: {
        reporterName: 'Student Reporter',
        reporterEmail: 'student@example.com',
      },
      headers: {},
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ ok: false, message: 'Youth Pulse submissions are temporarily closed.' });
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