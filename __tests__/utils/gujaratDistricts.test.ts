import { getGujaratDistrictName } from '../../utils/localizedNames';
import { GUJARAT_DISTRICTS } from '../../utils/regions';

describe('Gujarat district registry', () => {
  test('keeps Vav-Tharad in the shared listing with the explicit route slug', () => {
    expect(GUJARAT_DISTRICTS).toContainEqual({ name: 'Vav-Tharad', slug: 'vav-tharad' });
  });

  test('resolves localized labels for Vav-Tharad without falling back to a raw slug', () => {
    expect(getGujaratDistrictName('english', 'vav-tharad')).toBe('Vav-Tharad');
    expect(getGujaratDistrictName('hindi', 'vav-tharad')).toBe('वाव-थराद');
    expect(getGujaratDistrictName('gujarati', 'vav-tharad')).toBe('વાવ-થરાદ');
  });
});