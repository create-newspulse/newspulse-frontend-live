import { getSafeRetryAfter } from '../../lib/retryAfter';

describe('safe Retry-After forwarding', () => {
  test.each([
    '0', '45', '00060',
    'Fri, 16 Oct 2026 00:00:00 GMT',
    'Sunday, 06-Nov-94 08:49:37 GMT',
    'Sun Nov  6 08:49:37 1994',
  ])('preserves valid delay/date %s', (value) => {
    expect(getSafeRetryAfter(value)).toBe(value);
  });

  test('trims surrounding header whitespace', () => {
    expect(getSafeRetryAfter(' 45 ')).toBe('45');
  });

  test.each([
    undefined, null, 45, '', '-1', '1.5', '1e3', 'Infinity', '9007199254740992',
    'tomorrow', '2026-10-16', 'https://backend.test/private',
    '45\r\nAuthorization: fake-token', '\n45',
    'Fri, 16 Oct 2026 00:00:00 GMT (fake-token)',
    'Fri, 16 Oct 2026 99:99:99 GMT',
  ])('does not forward an invalid or diagnostic value: %j', (value) => {
    expect(getSafeRetryAfter(value)).toBeUndefined();
  });
});
