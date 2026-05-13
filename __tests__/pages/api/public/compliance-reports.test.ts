jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:5000',
}));

import handler from '../../../../pages/api/public/compliance-reports';

describe('pages/api/public/compliance-reports', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('forwards published compliance reports to the backend public route', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        reports: [
          {
            month: 'April',
            year: 2026,
            label: 'April 2026',
            publishedDate: '12 May 2026',
            complaintsReceived: 0,
            complaintsResolved: 0,
            averageResponseTime: 'Nil',
            complaintsPending: 0,
            actionTakenOnOrders: 'Nil',
            note: 'Latest published report',
            status: 'Published',
          },
          {
            month: 'March',
            year: 2026,
            label: 'March 2026',
            publishedDate: '10 April 2026',
            complaintsReceived: 2,
            complaintsResolved: 2,
            averageResponseTime: '3 days',
            complaintsPending: 0,
            actionTakenOnOrders: 'Nil',
            note: 'Historical report should remain hidden for now',
            status: 'Draft',
          },
          {
            month: 'May',
            year: 2026,
            label: 'May 2026',
            publishedDate: '05 June 2026',
            complaintsReceived: 1,
            complaintsResolved: 0,
            averageResponseTime: 'Pending',
            complaintsPending: 1,
            actionTakenOnOrders: 'Under review',
            note: 'Draft report',
            status: 'Draft',
          },
        ],
      }),
    });

    const req = {
      method: 'GET',
      headers: {},
    } as any;
    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/public/compliance-reports',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.fallback).toBe(false);
    expect(res.body.reports).toHaveLength(1);
    expect(res.body.reports[0].label).toBe('April 2026');
  });

  it('returns static fallback reports when the backend route fails', async () => {
    (global as any).fetch.mockRejectedValueOnce(new Error('network down'));

    const req = {
      method: 'GET',
      headers: {},
    } as any;
    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.fallback).toBe(true);
    expect(Array.isArray(res.body.reports)).toBe(true);
    expect(res.body.reports[0].label).toBe('April 2026');
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