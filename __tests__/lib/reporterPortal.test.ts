import { getReporterDisplayName, loadReporterPortalProfile, saveReporterPortalProfile } from '../../lib/reporterPortal';
import { clearReporterPrivateStorage, REPORTER_PRIVATE_RESET } from '../../lib/reporterPrivacy';

it('uses session display name precedence without loading a browser profile', () => {
  expect(getReporterDisplayName({ fullName: 'One', name: 'Two', firstName: 'Three' })).toBe('One');
  expect(getReporterDisplayName({ firstName: 'Three' })).toBe('Three');
  expect(getReporterDisplayName({ email: 'one@example.test' })).toBe('one');
});
it('purges only reporter keys, never reads or writes a reporter identity, and notifies volatile consumers', () => {
  for (const storage of [localStorage, sessionStorage]) {
    storage.setItem('np_cr_profile_v1', '{"email":"old@example.test"}');
    storage.setItem('np_communityReporterId', 'old');
    storage.setItem('lang', 'hi');
  }
  const listener = jest.fn();
  window.addEventListener(REPORTER_PRIVATE_RESET, listener);
  const writes = jest.spyOn(Storage.prototype, 'setItem');
  const reads = jest.spyOn(Storage.prototype, 'getItem');
  expect(loadReporterPortalProfile()).toBeNull();
  saveReporterPortalProfile({ email: 'new@example.test', fullName: 'DO NOT STORE' });
  clearReporterPrivateStorage();
  expect(reads).not.toHaveBeenCalled();
  expect(writes).not.toHaveBeenCalled();
  reads.mockRestore(); writes.mockRestore();
  for (const storage of [localStorage, sessionStorage]) {
    expect(storage.getItem('np_cr_profile_v1')).toBeNull();
    expect(storage.getItem('np_communityReporterId')).toBeNull();
    expect(storage.getItem('lang')).toBe('hi');
  }
  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener(REPORTER_PRIVATE_RESET, listener);
});
