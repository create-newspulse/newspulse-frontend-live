const root = '/api/reporter-runtime/v1';
const contract = 'np.community-reporter.v1';
const buildHeader = 'X-NP-Reporter-Build';
const capabilities = [
  'immutable-submitting-account', 'revocable-reporter-sessions', 'owner-only-unsubmitted-drafts',
  'idempotent-first-draft', 'explicit-final-ethics', 'idempotent-editorial-handoff', 'authorized-multilingual-publication',
];

// This capability belongs to the isolated Node host, not an HTTP request or an
// environment variable. Its dispatch must enforce live pool membership before
// every hop. No independently verified production ingress is installed.
type Ingress = Readonly<{
  origin: string; buildId: string; expiresAt: number;
  dispatch: (path: string, init: RequestInit) => Promise<Response>;
}>;
const binding = Symbol.for('newspulse.reporter.local-ingress.v1');
const unavailable = () => new Error('REPORTER_RUNTIME_UNAVAILABLE');

function ingress(origin: string): Ingress {
  const pin = process.env.REPORTER_RUNTIME_EXPECTED_BUILD;
  const gate = (process as NodeJS.Process & { [binding]?: Ingress })[binding];
  if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.RENDER
    || [process.env.NEWS_PULSE_DEPLOYMENT, process.env.NEWS_PULSE_ENV].some(value => /^(prod|production)$/i.test(value || ''))
    || !/^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):[1-9]\d*$/.test(origin)
    || !pin || !/^sha256:[a-f0-9]{64}$/.test(pin) || !gate || gate.origin !== origin || gate.buildId !== pin
    || !Number.isSafeInteger(gate.expiresAt) || gate.expiresAt <= Date.now() || typeof gate.dispatch !== 'function') throw unavailable();
  return gate;
}

export function hasReporterIngress(origin: string): boolean {
  try { ingress(origin); return true; } catch { return false; }
}

function verifiedHeaders(res: Response, pin: string): boolean {
  const age = res.headers.get('Age');
  return !res.redirected && (res.status < 300 || res.status >= 400) && (age === null || age === '0') && res.headers.get(buildHeader) === pin
    && res.headers.get('X-NP-Reporter-Contract') === contract
    && ['Cache-Control', 'CDN-Cache-Control', 'Surrogate-Control'].every(name =>
      res.headers.get(name)?.toLowerCase().split(',').some(token => token.trim() === 'no-store'));
}

export async function dispatchReporterOperation(origin: string, path: string, init: RequestInit): Promise<Response> {
  const gate = ingress(origin);
  const pin = gate.buildId;
  const common = { redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8_000) } as const;
  // Never send even an account selector, cookie, approval header, or query on the probe.
  const proof = await gate.dispatch(`${root}/contract`, { ...common, method: 'GET', headers: { Accept: 'application/json' } });
  if (proof.status !== 200 || !verifiedHeaders(proof, pin)) throw unavailable();
  const data = await proof.json();
  if (data?.ok !== true || data.contract !== contract || data.buildId !== pin || !Array.isArray(data.capabilities)
    || !capabilities.every(name => data.capabilities.includes(name))) throw unavailable();
  if (ingress(origin) !== gate || gate.buildId !== pin) throw unavailable();
  const res = await gate.dispatch(`${root}${path}`, { ...init, ...common, headers: { ...init.headers, [buildHeader]: pin } });
  // This is receipt validation, not pre-forward protection. A lost or invalid
  // mutation response cannot establish that the write did not happen.
  if (!verifiedHeaders(res, pin) || ingress(origin) !== gate || gate.buildId !== pin) throw unavailable();
  return res;
}
