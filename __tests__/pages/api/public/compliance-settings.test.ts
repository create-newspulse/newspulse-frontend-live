jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:5000',
}));

import handler from '../../../../pages/api/public/compliance-settings';

describe('pages/api/public/compliance-settings', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('proxies backend compliance settings without dropping item fields', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
        item: {
          founderName: 'Kiran Parmar',
          publisherEntity: 'News Pulse Media',
          grievanceOfficerName: 'Shailesh Rathod',
          grievanceOfficerDesignation: 'Grievance Officer',
          grievanceEmail: 'grievance@newspulse.co.in',
          grievanceOfficerLocation: 'India',
          chiefEditorName: 'Shailesh Rathod',
          chiefEditorDesignation: 'Chief Editor',
          editorialEmail: 'newspulse.team@gmail.com',
        },
      }),
    });

    const req = { method: 'GET', headers: {} } as any;
    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/public/compliance-settings',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.item.grievanceOfficerName).toBe('Shailesh Rathod');
    expect(res.body.item.chiefEditorDesignation).toBe('Chief Editor');
  });

  it('returns fallback settings when the backend route fails', async () => {
    (global as any).fetch.mockRejectedValueOnce(new Error('network down'));

    const req = { method: 'GET', headers: {} } as any;
    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.fallback).toBe(true);
    expect(res.body.item.founderName).toBe('Kiran Parmar');
    expect(res.body.item.grievanceEmail).toBe('grievance@newspulse.co.in');
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