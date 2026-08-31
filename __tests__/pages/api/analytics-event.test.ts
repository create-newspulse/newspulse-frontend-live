/**
 * @jest-environment node
 */
import handler, {
  FAILURE_LOG_WINDOW_MS,
  __resetAnalyticsFailureLogStateForTests,
} from '../../../pages/api/analytics/[event]';

jest.mock('../../../lib/publicNewsApi', () => ({
  getApiOrigin: () => 'https://backend.example.test',
}));

function createRes() {
  const res: any = {
    statusCode: 0,
    body: undefined,
    setHeader: jest.fn(),
    end: jest.fn(),
  };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

function createReq(event: string, body: any) {
  return { method: 'POST', query: { event }, body } as any;
}

const BASE_PAYLOAD = {
  articleId: '507f1f77bcf86cd799439011',
  visitorId: 'visitor-1',
  sessionId: 'session-1',
  slug: 'some-article',
  source: 'homepage',
  referrer: 'https://newspulse.co.in/',
  deviceType: 'mobile',
  language: 'hi',
};

describe('/api/analytics/[event] proxy', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetAnalyticsFailureLogStateForTests();
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const cases: Array<[string, string]> = [
    ['article-view', 'https://backend.example.test/api/analytics/article/view'],
    ['engaged-read', 'https://backend.example.test/api/analytics/article/engagement'],
    ['scroll-milestone', 'https://backend.example.test/api/analytics/article/scroll'],
    ['article-heartbeat', 'https://backend.example.test/api/analytics/article/heartbeat'],
  ];

  it.each(cases)('maps %s to the verified backend endpoint', async (event, expectedUrl) => {
    const res = createRes();
    await handler(createReq(event, BASE_PAYLOAD), res);

    const [url] = ((global as any).fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(expectedUrl);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, tracked: true });
  });

  it('forwards a flat JSON body preserving articleId/visitorId/sessionId', async () => {
    const res = createRes();
    await handler(createReq('article-view', BASE_PAYLOAD), res);

    const [, init] = ((global as any).fetch as jest.Mock).mock.calls[0];
    const sent = JSON.parse(init.body);

    expect(sent.type).toBeUndefined();
    expect(sent.data).toBeUndefined();
    expect(sent).toMatchObject({
      articleId: '507f1f77bcf86cd799439011',
      visitorId: 'visitor-1',
      sessionId: 'session-1',
      source: 'homepage',
      deviceType: 'mobile',
    });
  });

  it('forwards scroll milestone as `milestone` (not `milestonePct`)', async () => {
    const res = createRes();
    await handler(createReq('scroll-milestone', { ...BASE_PAYLOAD, milestone: 75, scrollPercent: 78 }), res);

    const [, init] = ((global as any).fetch as jest.Mock).mock.calls[0];
    const sent = JSON.parse(init.body);

    expect(sent.milestone).toBe(75);
    expect(sent.scrollPercent).toBe(78);
    expect(sent.milestonePct).toBeUndefined();
  });

  it('parses string bodies sent via navigator.sendBeacon', async () => {
    const res = createRes();
    await handler(createReq('article-heartbeat', JSON.stringify({ ...BASE_PAYLOAD, readTimeSec: 30 })), res);

    const [, init] = ((global as any).fetch as jest.Mock).mock.calls[0];
    const sent = JSON.parse(init.body);

    expect(sent.articleId).toBe('507f1f77bcf86cd799439011');
    expect(sent.readTimeSec).toBe(30);
  });

  it('lets the backend override tracked when it skips the event', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tracked: false, reason: 'duplicate' }),
    });

    const res = createRes();
    await handler(createReq('article-view', BASE_PAYLOAD), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, tracked: false, reason: 'duplicate' });
  });

  it('does not report a false success when the backend rejects the event', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const res = createRes();
    await handler(createReq('article-view', BASE_PAYLOAD), res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ success: false, tracked: false });
  });

  it('does not report a false success when the backend is unreachable', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const res = createRes();
    await handler(createReq('engaged-read', BASE_PAYLOAD), res);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ success: false, tracked: false });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).not.toContain('visitor-1');
    expect(String(warnSpy.mock.calls[0][0])).not.toContain('session-1');
  });

  it('does not forward unsupported event names to the backend', async () => {
    const res = createRes();
    await handler(createReq('feature-usage', BASE_PAYLOAD), res);

    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ tracked: false, reason: 'unsupported_event' });
  });

  it('rejects non-POST methods', async () => {
    const res = createRes();
    await handler({ method: 'GET', query: { event: 'article-view' } } as any, res);

    expect(res.statusCode).toBe(405);
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('never logs on successful analytics requests', async () => {
    for (let i = 0; i < 25; i += 1) {
      await handler(createReq('article-view', BASE_PAYLOAD), createRes());
    }

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs a repeated forwarding failure only once per time window', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    for (let i = 0; i < 50; i += 1) {
      const res = createRes();
      await handler(createReq('article-heartbeat', BASE_PAYLOAD), res);
      expect(res.statusCode).toBe(502);
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('logs again after the window elapses and reports the suppressed count', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const nowSpy = jest.spyOn(Date, 'now');

    nowSpy.mockReturnValue(1_000_000);
    await handler(createReq('article-view', BASE_PAYLOAD), createRes());
    await handler(createReq('article-view', BASE_PAYLOAD), createRes());
    await handler(createReq('article-view', BASE_PAYLOAD), createRes());
    expect(warnSpy).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(1_000_000 + FAILURE_LOG_WINDOW_MS + 1);
    await handler(createReq('article-view', BASE_PAYLOAD), createRes());

    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(String(warnSpy.mock.calls[1][0])).toContain('2 similar suppressed');
  });

  it('logs distinct event/status combinations independently', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await handler(createReq('article-view', BASE_PAYLOAD), createRes());
    await handler(createReq('scroll-milestone', BASE_PAYLOAD), createRes());
    await handler(createReq('article-view', BASE_PAYLOAD), createRes());

    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('never includes identifiers or payload data in failure logs', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await handler(createReq('engaged-read', BASE_PAYLOAD), createRes());

    const logged = warnSpy.mock.calls.map((c) => c.join(' ')).join(' ');
    expect(logged).not.toContain('visitor-1');
    expect(logged).not.toContain('session-1');
    expect(logged).not.toContain('507f1f77bcf86cd799439011');
    expect(logged).not.toContain('some-article');
    expect(logged).not.toContain('ECONNREFUSED');
    expect(logged).toContain('engaged-read');
  });
});
