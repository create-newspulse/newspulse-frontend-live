jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:5000',
}));

import handler from '../../../../pages/api/community/submissions';

describe('pages/api/community/submissions', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('forwards only the backend-compatible community submission payload and preserves 201', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ ok: true, referenceId: 'story-1', status: 'Under review' }),
    });

    const req = {
      method: 'POST',
      body: {
        reporterAccountId: 'acct-1',
        reporterProfileId: 'prof-1',
        reporterType: 'community',
        reporterName: ' Test User ',
        reporterEmail: ' TEST@Example.com ',
        reporterPhone: ' 999 ',
        reporterWhatsApp: '888',
        city: ' Ahmedabad ',
        district: 'Ahmedabad',
        state: 'Gujarat',
        country: 'India',
        ageGroup: '18_24',
        category: 'regional',
        coverageScope: 'regional',
        headline: ' Local civic issue ',
        story: 'A sufficiently detailed public-interest story for review.',
        preferredLanguages: ['en', ''],
        consentToContact: true,
        beats: ['Civic', 'Education'],
        fullName: 'Legacy Alias',
        phone: 'legacy-phone',
        storyText: 'legacy story text',
        body: 'legacy body',
        reporterProfile: { fullName: 'Legacy Alias' },
        meta: { shouldNotForward: true },
      },
      headers: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/community/submissions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      })
    );

    const [, init] = (global as any).fetch.mock.calls[0];
    const body = JSON.parse(init.body);

    expect(body).toEqual({
      reporterAccountId: 'acct-1',
      reporterProfileId: 'prof-1',
      reporterType: 'community',
      reporterName: 'Test User',
      reporterEmail: 'test@example.com',
      reporterPhone: '999',
      reporterWhatsApp: '888',
      city: 'Ahmedabad',
      district: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      ageGroup: '18-24',
      category: 'regional',
      coverageScope: 'regional',
      headline: 'Local civic issue',
      story: 'A sufficiently detailed public-interest story for review.',
      priority: 'normal',
      preferredLanguages: ['en'],
      consentToContact: true,
      beats: ['Civic', 'Education'],
      communityInterests: ['Civic', 'Education'],
      journalistCharterAccepted: false,
      generalEthicsAccepted: false,
    });
    expect(body.fullName).toBeUndefined();
    expect(body.phone).toBeUndefined();
    expect(body.storyText).toBeUndefined();
    expect(body.body).toBeUndefined();
    expect(body.reporterProfile).toBeUndefined();
    expect(body.meta).toBeUndefined();
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true, referenceId: 'story-1', status: 'Under review' });
  });

  it.each([
    ['under_18', 'Under 18'],
    ['18_24', '18-24'],
    ['25_40', '25-40'],
    ['41_plus', '41+'],
  ])('maps frontend ageGroup %s to backend value %s in the proxy', async (frontendAgeGroup, backendAgeGroup) => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ ok: true, referenceId: 'story-1' }),
    });

    const req = {
      method: 'POST',
      body: {
        reporterType: 'community',
        reporterName: 'Test User',
        reporterEmail: 'test@example.com',
        ageGroup: frontendAgeGroup,
        category: 'regional',
        coverageScope: 'regional',
        headline: 'Local civic issue',
        story: 'A sufficiently detailed public-interest story for review.',
      },
      headers: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    const [, init] = (global as any).fetch.mock.calls[0];
    expect(JSON.parse(init.body).ageGroup).toBe(backendAgeGroup);
  });

  it('preserves 200 success responses', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, referenceId: 'story-2' }),
    });

    const req = {
      method: 'POST',
      body: {
        reporterType: 'community',
        reporterName: 'Test User',
        reporterEmail: 'test@example.com',
        category: 'regional',
        headline: 'Local civic issue',
        story: 'A sufficiently detailed public-interest story for review.',
      },
      headers: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, referenceId: 'story-2' });
  });

  it('returns public-safe validation messages for upstream HTTP 400', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({ error: 'submit_failed', message: 'submit_failed', stack: 'AxiosError: pages/api/community/submissions' }),
    });

    const req = {
      method: 'POST',
      body: {
        reporterType: 'community',
        reporterName: 'Test User',
        reporterEmail: 'test@example.com',
        category: '',
        headline: 'Local civic issue',
        story: 'A sufficiently detailed public-interest story for review.',
      },
      headers: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      message: 'Please check the required story details and try submitting again.',
      code: 'VALIDATION_ERROR',
    });
    expect(JSON.stringify(res.body)).not.toContain('submit_failed');
    expect(JSON.stringify(res.body)).not.toContain('AxiosError');
    expect(JSON.stringify(res.body)).not.toContain('pages/api');
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
