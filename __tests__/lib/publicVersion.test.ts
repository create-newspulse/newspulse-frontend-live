import { normalizePublicVersion } from '../../lib/publicVersion';

describe('publicVersion normalization', () => {
  test('prefers explicit version values from nested payloads', () => {
    expect(
      normalizePublicVersion({
        ok: true,
        data: {
          version: 'v-123',
          updatedAt: '2026-03-18T10:00:00.000Z',
        },
      })
    ).toEqual({
      ok: true,
      version: 'v-123',
      updatedAt: '2026-03-18T10:00:00.000Z',
    });
  });

  test('falls back to timestamps when version is missing', () => {
    expect(
      normalizePublicVersion({
        success: true,
        updatedAt: '2026-03-18T11:22:33.000Z',
      })
    ).toEqual({
      ok: true,
      version: '2026-03-18T11:22:33.000Z',
      updatedAt: '2026-03-18T11:22:33.000Z',
    });
  });

  test('returns a non-ok empty state for invalid payloads', () => {
    expect(normalizePublicVersion(null)).toEqual({
      ok: false,
      version: null,
      updatedAt: null,
    });
  });
});