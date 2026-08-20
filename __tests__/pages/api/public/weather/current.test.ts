jest.mock('../../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: jest.fn(() => 'http://localhost:5000'),
}));

import handler from '../../../../../pages/api/public/weather/current';
import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';

describe('pages/api/public/weather/current', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
    (getPublicApiBaseUrl as jest.Mock).mockReturnValue('http://localhost:5000');
  });

  it('requires GET requests', async () => {
    const req = { method: 'POST', query: {}, headers: {} } as any;
    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET');
    expect(res.body).toEqual({ ok: false, message: 'METHOD_NOT_ALLOWED' });
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('rejects missing and malformed city values before proxying', async () => {
    const missing = createMockResponse();
    await handler({ method: 'GET', query: {}, headers: {} } as any, missing as any);

    expect(missing.statusCode).toBe(400);
    expect(missing.body).toEqual({ ok: false, message: 'CITY_REQUIRED' });

    const malformed = createMockResponse();
    await handler({ method: 'GET', query: { city: '../Ahmedabad<script>' }, headers: {} } as any, malformed as any);

    expect(malformed.statusCode).toBe(400);
    expect(malformed.body).toEqual({ ok: false, message: 'INVALID_CITY' });
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('proxies a sanitized city to the configured local backend route', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ temp_c: 31.4, weather: [{ main: 'Clear' }], secret: 'not-for-browser' }),
    });

    const req = { method: 'GET', query: { city: '  Ahmedabad  ' }, headers: {} } as any;
    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/public/weather/current?city=Ahmedabad',
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, tempC: 31.4, condition: 'Clear' });
  });

  it('fails clearly when local backend configuration is missing', async () => {
    (getPublicApiBaseUrl as jest.Mock).mockReturnValue('');

    const req = { method: 'GET', query: { city: 'Ahmedabad' }, headers: {} } as any;
    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ ok: false, message: 'WEATHER_BACKEND_NOT_CONFIGURED' });
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('does not return backend 404 as a Next route 404', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ ok: false, message: 'not found' }),
    });

    const req = { method: 'GET', query: { city: 'Ahmedabad' }, headers: {} } as any;
    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ ok: false, message: 'WEATHER_UPSTREAM_NOT_FOUND' });
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