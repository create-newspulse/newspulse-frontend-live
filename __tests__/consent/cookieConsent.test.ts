import {
  COOKIE_CONSENT_NAME,
  COOKIE_CONSENT_VERSION,
  allAcceptedCategories,
  createConsentRecord,
  defaultDeniedCategories,
  parseConsentRecord,
  readCookieValue,
  serializeConsentRecord,
  writeConsentCookie,
} from '../../src/consent/cookieConsent';

describe('cookie consent model', () => {
  beforeEach(() => {
    document.cookie = `${COOKIE_CONSENT_NAME}=; Path=/; Max-Age=0`;
  });

  test('necessary category is always active and reject disables optional categories', () => {
    const record = createConsentRecord('rejected', defaultDeniedCategories, new Date('2026-08-01T00:00:00.000Z'));

    expect(record.categories).toEqual(defaultDeniedCategories);
    expect(record.categories.necessary).toBe(true);
    expect(record.categories.preferences).toBe(false);
    expect(record.categories.analytics).toBe(false);
    expect(record.categories.advertising).toBe(false);
    expect(record.categories.embeddedMedia).toBe(false);
  });

  test('accept all enables every optional category', () => {
    const record = createConsentRecord('accepted', allAcceptedCategories, new Date('2026-08-01T00:00:00.000Z'));

    expect(record.categories).toEqual(allAcceptedCategories);
  });

  test('custom preferences save correctly and contain no personal data fields', () => {
    const record = createConsentRecord('custom', { preferences: true, analytics: false, advertising: false, embeddedMedia: true }, new Date('2026-08-01T00:00:00.000Z'));
    const serialized = serializeConsentRecord(record);
    const parsed = parseConsentRecord(serialized, new Date('2026-08-01T00:00:01.000Z'));

    expect(parsed?.decision).toBe('custom');
    expect(parsed?.categories).toMatchObject({ necessary: true, preferences: true, analytics: false, advertising: false, embeddedMedia: true });
    expect(serialized).not.toMatch(/email|userId|ip|fingerprint/i);
  });

  test('expired consent and old policy versions are invalid', () => {
    const expired = createConsentRecord('accepted', allAcceptedCategories, new Date('2026-01-01T00:00:00.000Z'));
    expect(parseConsentRecord(serializeConsentRecord(expired), new Date('2026-08-01T00:00:00.000Z'))).toBeNull();

    const oldVersion = { ...createConsentRecord('accepted', allAcceptedCategories), version: '0.9' };
    expect(parseConsentRecord(encodeURIComponent(JSON.stringify(oldVersion)))).toBeNull();
  });

  test('saved decision survives refresh through the first-party consent cookie', () => {
    const record = createConsentRecord('accepted', allAcceptedCategories, new Date('2026-08-01T00:00:00.000Z'));
    writeConsentCookie(record);

    const stored = parseConsentRecord(readCookieValue(COOKIE_CONSENT_NAME), new Date('2026-08-01T00:00:01.000Z'));
    expect(stored?.version).toBe(COOKIE_CONSENT_VERSION);
    expect(stored?.decision).toBe('accepted');
    expect(stored?.categories.analytics).toBe(true);
  });
});