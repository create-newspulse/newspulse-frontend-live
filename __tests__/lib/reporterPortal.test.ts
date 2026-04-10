import { getReporterDisplayName, loadReporterPortalProfile, saveReporterPortalProfile } from '../../lib/reporterPortal';

describe('reporterPortal display name helpers', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (global as any).window = {
      localStorage: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
      },
    } as any;
  });

  it('prefers fullName then name then firstName then email prefix', () => {
    expect(getReporterDisplayName({ fullName: 'Kiran Parmar', name: 'Kiran', firstName: 'KP', email: 'reporter@example.com' })).toBe('Kiran Parmar');
    expect(getReporterDisplayName({ name: 'Kiran', firstName: 'KP', email: 'reporter@example.com' })).toBe('Kiran');
    expect(getReporterDisplayName({ firstName: 'Kiran', email: 'reporter@example.com' })).toBe('Kiran');
    expect(getReporterDisplayName({ email: 'reporter@example.com' })).toBe('reporter');
  });

  it('loads legacy reporter profile name fields for shared display resolution', () => {
    (global as any).window.localStorage.setItem('np_cr_profile_v1', JSON.stringify({
      name: 'Kiran Parmar',
      firstName: 'Kiran',
      email: 'Reporter@Example.com',
    }));

    expect(loadReporterPortalProfile()).toEqual(expect.objectContaining({
      fullName: 'Kiran Parmar',
      name: 'Kiran Parmar',
      firstName: 'Kiran',
      email: 'reporter@example.com',
    }));
  });

  it('persists full name, name, and firstName for later local session hydration', () => {
    saveReporterPortalProfile({ fullName: 'Kiran Parmar', email: 'Reporter@Example.com' });

    expect(loadReporterPortalProfile()).toEqual(expect.objectContaining({
      fullName: 'Kiran Parmar',
      name: 'Kiran Parmar',
      firstName: 'Kiran',
      email: 'reporter@example.com',
    }));
  });
});