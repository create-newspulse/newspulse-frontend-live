/** @jest-environment node */
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import handler from '../../../pages/api/public/broadcast/stream';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

jest.mock('../../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: jest.fn() }));

const base = 'http://backend.test/api/public/broadcast';
const originalFetch = global.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
let active = true;

function fixture(input: RequestInfo | URL) {
  const url = new URL(String(input));
  if (url.pathname.endsWith('/config')) return Response.json({ config: {
    breaking: { enabled: active, durationSeconds: 22 }, live: { enabled: active, durationSec: 30 },
  } });
  const items = active ? [{ text: `${url.searchParams.get('type')} update` }] : [];
  return Response.json(url.searchParams.get('type') === 'breaking' ? { items } : { data: items });
}

function connect(lastId = '', method = 'GET') {
  const req = Object.assign(new IncomingMessage(new Socket()), {
    method, query: { lang: 'gu' }, headers: { 'last-event-id': lastId, cookie: 'test=1', authorization: 'fixture' },
    cookies: {}, env: {}, body: undefined,
  });
  const res = Object.assign(new ServerResponse(req), {
    setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn(), end: jest.fn(), write: jest.fn(),
    send: jest.fn(), redirect: jest.fn(), setDraftMode: jest.fn(), setPreviewData: jest.fn(),
    clearPreviewData: jest.fn(), revalidate: jest.fn(),
  });
  const done = handler(req, res);
  return { req, res, done };
}

async function frame(lastId?: string) {
  const { done, res } = connect(lastId);
  await done;
  expect(res.end).toHaveBeenCalledTimes(1);
  const wire: string = res.end.mock.calls[0][0];
  expect(wire).toMatch(/\n\n$/);
  expect(res.setHeader).toHaveBeenCalledWith('Content-Type', expect.stringContaining('text/event-stream'));
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('no-store'));
  return {
    wire, id: /^id: (.+)$/m.exec(wire)![1], data: JSON.parse(/^data: (.+)$/m.exec(wire)![1]),
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  active = true;
  jest.mocked(getPublicApiBaseUrl).mockReturnValue('http://backend.test');
  global.fetch = fetchMock.mockReset().mockImplementation(async input => fixture(input));
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

test('ends a localized snapshot immediately, resumes unchanged by ID and delivers a real inactive update', async () => {
  const first = await frame();
  expect(first.wire).toContain('retry: 5000\n');
  expect(first.wire).toContain('event: broadcast_updated\n');
  expect(first.data).toEqual({
    ok: true, _meta: { hasSettings: true },
    settings: { breaking: { enabled: true, mode: 'AUTO', speedSec: 22 }, live: { enabled: true, mode: 'AUTO', speedSec: 30 } },
    items: { breaking: [{ text: 'breaking update' }], live: [{ text: 'live update' }] },
  });
  expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual([
    `${base}/config?lang=gu`, `${base}/items?type=breaking&lang=gu`, `${base}/items?type=live&lang=gu`,
  ]);
  for (const [, init] of fetchMock.mock.calls) {
    const headers = new Headers(init?.headers);
    expect(headers.has('cookie')).toBe(false);
    expect(headers.has('authorization')).toBe(false);
  }
  await jest.advanceTimersByTimeAsync(10_000);
  expect(fetchMock).toHaveBeenCalledTimes(3); // Nothing polls while a client is away.
  const unchanged = await frame(first.id);
  expect(unchanged.id).toBe(first.id);
  expect(unchanged.wire).toContain('event: ping\n');
  expect(unchanged.wire).not.toContain('broadcast_updated');

  active = false;
  const inactive = await frame(first.id);
  expect(inactive.id).not.toBe(first.id);
  expect(inactive.wire).toContain('event: broadcast_updated\n');
  expect(inactive.data).toMatchObject({
    settings: { breaking: { enabled: false }, live: { enabled: false } }, items: { breaking: [], live: [] },
  });
  expect(jest.getTimerCount()).toBe(0);
});

test.each([true, false])('preserves items and distinguishes legacy settings from absent settings (available: %s)', async available => {
  fetchMock.mockImplementation(async input => {
    if (String(input).includes('/config?')) return new Response(null, { status: 404 });
    if (String(input).includes('/settings?')) return available
      ? Response.json({ settings: { live: { enabled: false, speedSec: 32 } } })
      : new Response(null, { status: 404 });
    return fixture(input);
  });
  const { data } = await frame();
  expect(data._meta.hasSettings).toBe(available);
  if (available) expect(data.settings.live).toEqual({ enabled: false, mode: 'AUTO', speedSec: 32 });
  expect(data.items.live).toEqual([{ text: 'live update' }]);
});

test('a slow primary plus a stalled legacy response body share one deadline below ten seconds', async () => {
  const stalled = new Response();
  jest.spyOn(stalled, 'json').mockImplementation(() => new Promise(() => {}));
  fetchMock.mockImplementation(async input => {
    if (String(input).includes('/config?')) {
      await new Promise(resolve => setTimeout(resolve, 4_500));
      return new Response(null, { status: 404 });
    }
    if (String(input).includes('/settings?')) return stalled;
    return fixture(input);
  });
  const { done, res } = connect();
  await jest.advanceTimersByTimeAsync(4_500);
  expect(stalled.json).toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(1_500);
  expect(res.status).toHaveBeenCalledWith(504);
  await done;
  expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'BROADCAST_TIMEOUT' });
  expect(res.write).not.toHaveBeenCalled();
  expect(res.end).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test.each(['aborted', 'close'])('client %s during the first read cancels work without writing a late frame', async event => {
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const { req, res, done } = connect();
  (event === 'aborted' ? req : res).emit(event);
  await done;
  expect(fetchMock.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
  expect(res.end).not.toHaveBeenCalled();
  expect(res.json).not.toHaveBeenCalled();
  expect(req.listenerCount('aborted') + res.listenerCount('close')).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
});

test.each([401, 403, 502])('upstream failure (%s) cancels siblings without publishing a successful empty snapshot', async status => {
  fetchMock.mockImplementation(async input => {
    if (String(input).includes('/config?') && status !== 502) return new Response(null, { status });
    if (String(input).includes('type=live') && status === 502) return Response.json({ error: 'not an items list' });
    return new Promise(() => {});
  });
  const { done, res } = connect();
  await done;
  expect(res.status).toHaveBeenCalledWith(status);
  expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'BROADCAST_UNAVAILABLE' });
  expect(res.end).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/settings?'), expect.anything());
  expect(fetchMock.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
});

test('remains read-only and fails explicitly when no backend is configured', async () => {
  const post = connect('', 'POST');
  await post.done;
  expect(post.res.status).toHaveBeenCalledWith(405);
  expect(post.res.setHeader).toHaveBeenCalledWith('Allow', 'GET');
  jest.mocked(getPublicApiBaseUrl).mockReturnValue('');
  const offline = connect();
  await offline.done;
  expect(offline.res.status).toHaveBeenCalledWith(503);
  expect(fetchMock).not.toHaveBeenCalled();
});
