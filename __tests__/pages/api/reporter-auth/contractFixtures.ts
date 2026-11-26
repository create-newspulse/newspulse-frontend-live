import type { NextApiRequest, NextApiResponse } from 'next';

export const accountId = '111111111111111111111111';
export const email = 'one@example.test';
export const origin = 'http://127.0.0.1:3010';
export const runtime = '/api/reporter-runtime/v1';
export const backend = `${origin}${runtime}/reporter-portal`;
export const pin = `sha256:${'a'.repeat(64)}`;
export const binding = Symbol.for('newspulse.reporter.local-ingress.v1');
export const capabilities = ['immutable-submitting-account', 'revocable-reporter-sessions', 'owner-only-unsubmitted-drafts',
  'idempotent-first-draft', 'explicit-final-ethics', 'idempotent-editorial-handoff', 'authorized-multilingual-publication'];
export const proofBody = { ok: true, contract: 'np.community-reporter.v1', buildId: pin, capabilities };
export const expiresAt = () => new Date(Date.now() + 60_000).toISOString();
export const logoutReceipt = ['reporter_portal.sid', 'reporter_portal_session', 'reporter_portal_login_challenge']
  .map(name => `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`);
export function sessionBody() {
  return { ok: true, reporter: { id: accountId, email, fullName: 'One', status: 'active' },
    session: { expiresAt: expiresAt() }, summary: { totalSubmissions: 2, received: 1 } };
}
export function upstream(body: unknown, status = 200, cookies: string[] = []) {
  const headers = new Headers({ 'X-NP-Reporter-Build': pin, 'X-NP-Reporter-Contract': 'np.community-reporter.v1',
    'Cache-Control': 'private, no-store', 'CDN-Cache-Control': 'no-store', 'Surrogate-Control': 'no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(body), { status, headers });
}
export function request(method: string, body?: unknown, headers?: Record<string, string>, cookies?: Record<string, string>): NextApiRequest {
  return { method, body, cookies: cookies || {}, headers: { host: 'localhost:3000', ...headers } } as NextApiRequest;
}
export function response() {
  const data = { status: 200, headers: {} as Record<string, string | string[]>, json: null as any };
  const res = { setHeader: (name: string, value: string | string[]) => { data.headers[name] = value; },
    status: (status: number) => { data.status = status; return res; },
    json: (json: unknown) => { data.json = json; } };
  return { data, res: res as unknown as NextApiResponse };
}
export function mockBackend() {
  const real = global.fetch;
  const original = process.env;
  let operations: jest.Mock;
  beforeEach(() => {
    // Do not inherit any application, production, mail, or DB configuration.
    process.env = { NODE_ENV: 'test', REPORTER_PORTAL_CONTRACT: 'phase5ab', REPORTER_AUTH_API_BASE: origin,
      REPORTER_PHASE5E1_VERIFIED_ORIGIN: origin, NEXT_PUBLIC_API_BASE_DEV: origin, REPORTER_RUNTIME_EXPECTED_BUILD: pin };
    global.fetch = jest.fn().mockRejectedValue(new Error('direct network unavailable'));
    operations = jest.fn().mockRejectedValue(new Error('isolated operation unavailable'));
    Object.defineProperty(process, binding, { configurable: true, value: {
      origin, buildId: pin, expiresAt: Date.now() + 60_000,
      dispatch: async (path: string, init: RequestInit) => path === `${runtime}/contract` ? upstream(proofBody) : operations(origin + path, init),
    } });
  });
  afterEach(() => { Reflect.deleteProperty(process, binding); process.env = original; global.fetch = real; });
  return () => operations;
}
