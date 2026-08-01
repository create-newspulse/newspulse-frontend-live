import { COOKIE_CONSENT_VERSION, getCookiePolicyCopy, getCookiePolicyInventory } from '../../src/consent/cookiePolicyContent';

describe('cookie policy content', () => {
  test('renders EN, HI, and GU policy labels', () => {
    expect(getCookiePolicyCopy('en').openSettings).toBe('Open Cookie Settings');
    expect(getCookiePolicyCopy('hi').openSettings).toBe('कुकी सेटिंग्स खोलें');
    expect(getCookiePolicyCopy('gu').openSettings).toBe('કુકી સેટિંગ્સ ખોલો');
  });

  test('uses policy version 1.0 and includes exact audited inventory statuses', () => {
    expect(COOKIE_CONSENT_VERSION).toBe('1.0');
    const inventory = getCookiePolicyInventory();

    expect(inventory.some((item) => item.name === 'np_cookie_consent' && item.currentStatus === 'Active')).toBe(true);
    expect(inventory.some((item) => item.name === 'gtag.js / NEXT_PUBLIC_GA_ID' && item.currentStatus === 'Conditionally active')).toBe(true);
    expect(inventory.some((item) => item.name === 'Microsoft Clarity' && item.currentStatus === 'Not currently active')).toBe(true);
  });
});