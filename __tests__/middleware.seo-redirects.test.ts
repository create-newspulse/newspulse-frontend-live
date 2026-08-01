import { middleware } from '../middleware';

function request(url: string) {
  const nextUrl = new URL(url) as URL & { locale?: string; defaultLocale?: string };
  nextUrl.locale = 'en';
  nextUrl.defaultLocale = 'en';
  return {
    url,
    nextUrl,
    headers: new Headers({ accept: 'text/html' }),
    cookies: { get: jest.fn() },
  } as any;
}

function jsonResponse(payload: any, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

describe('dynamic SEO redirects middleware', () => {
  const originalApiBase = process.env.NEXT_PUBLIC_API_BASE;
  let requestCounter = 0;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE = 'https://backend.test';
    jest.resetAllMocks();
    requestCounter += 1;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_API_BASE = originalApiBase;
  });

  test('matching 301 returns a server-side 301 redirect', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ destination: '/new-destination', statusCode: 301, preserveQuery: true })) as any;

    const response = await middleware(request(`https://www.newspulse.co.in/seo-redirect-301-${requestCounter}?utm_source=x&keep=1`));

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://www.newspulse.co.in/new-destination?utm_source=x&keep=1');
  });

  test('matching 302 returns a server-side 302 redirect', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ destination: '/', statusCode: 302 })) as any;

    const response = await middleware(request(`https://www.newspulse.co.in/seo-redirect-302-${requestCounter}`));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://www.newspulse.co.in/');
  });

  test('unknown path continues normal routing and caches a short miss', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(null, 404)) as any;

    const firstResponse = await middleware(request(`https://www.newspulse.co.in/unknown-route-${requestCounter}`));
    const secondResponse = await middleware(request(`https://www.newspulse.co.in/unknown-route-${requestCounter}`));

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('redirect loop is prevented', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ destination: `/same-path-${requestCounter}?x=1`, statusCode: 302 })) as any;

    const response = await middleware(request(`https://www.newspulse.co.in/same-path-${requestCounter}?x=1`));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  test('protected paths bypass dynamic redirects', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ destination: '/', statusCode: 301 })) as any;

    const adminResponse = await middleware(request('https://www.newspulse.co.in/admin'));
    const apiResponse = await middleware(request('https://www.newspulse.co.in/api/public/news'));
    const assetResponse = await middleware(request('https://www.newspulse.co.in/_next/static/app.js'));
    const robotsResponse = await middleware(request('https://www.newspulse.co.in/robots.txt'));

    expect(adminResponse.status).toBe(200);
    expect(apiResponse.status).toBe(200);
    expect(assetResponse.status).toBe(200);
    expect(robotsResponse.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('redirect service failure fails open without caching an error as a redirect', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as any;

    const publicResponse = await middleware(request(`https://www.newspulse.co.in/no-rule-${requestCounter}`));

    expect(publicResponse.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('unsafe destination is rejected and normal routing continues', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ destination: 'javascript:alert(1)', statusCode: 302 })) as any;

    const response = await middleware(request(`https://www.newspulse.co.in/unsafe-destination-${requestCounter}`));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  test('query parameters are not duplicated and are omitted when preserveQuery is false', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ destination: '/query-target?source=approved', statusCode: 302, preserveQuery: true }))
      .mockResolvedValueOnce(jsonResponse({ destination: '/query-target', statusCode: 302, preserveQuery: false })) as any;

    const preserved = await middleware(request(`https://www.newspulse.co.in/query-preserve-${requestCounter}?source=test&campaign=one`));
    const omitted = await middleware(request(`https://www.newspulse.co.in/query-omit-${requestCounter}?source=test&campaign=one`));

    expect(preserved.headers.get('location')).toBe('https://www.newspulse.co.in/query-target?source=approved&campaign=one');
    expect(omitted.headers.get('location')).toBe('https://www.newspulse.co.in/query-target');
  });
});