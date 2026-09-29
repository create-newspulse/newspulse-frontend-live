/** @jest-environment-options {"url":"https://www.newspulse.co.in/pulse-dialogue"} */
import { trackDiscoveryClick } from '../../lib/analytics/articleAnalytics';
import { hasStoredConsentForCategory } from '../../src/consent/cookieConsent';
jest.mock('../../src/consent/cookieConsent', () => ({ hasStoredConsentForCategory: jest.fn() }));
beforeEach(() => {
  (hasStoredConsentForCategory as jest.Mock).mockReturnValue(true);
  localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: jest.fn(() => false) });
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});
test('sends nothing and creates no identifiers before consent', () => {
  (hasStoredConsentForCategory as jest.Mock).mockReturnValue(false);
  trackDiscoveryClick('featured_voice_click', 'writer', 'en');
  expect(fetch).not.toHaveBeenCalled(); expect(navigator.sendBeacon).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0);
});
test.each([
  ['contributor_profile_click', 'contributorSlug', 'writer'], ['featured_voice_click', 'contributorSlug', 'writer'],
  ['series_click', 'seriesSlug', 'ideas'], ['featured_dialogue_click', 'articleId', '507f1f77bcf86cd799439011'],
] as const)('%s sends the exact discovery contract', (event, field, target) => {
  trackDiscoveryClick(event, target, 'gu');
  expect(fetch).toHaveBeenCalledWith('/api/analytics/discovery', expect.objectContaining({ keepalive: true }));
  const payload = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
  expect(payload).toEqual({ event, [field]: target, lang: 'gu', visitorId: expect.any(String), sessionId: expect.any(String) });
});
test('transport failure cannot throw into a navigation handler', async () => {
  (fetch as jest.Mock).mockRejectedValue(new Error('offline'));
  expect(() => trackDiscoveryClick('series_click', 'ideas', 'en')).not.toThrow();
  await Promise.resolve();
});