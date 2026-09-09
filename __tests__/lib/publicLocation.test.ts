import { formatPublicArticleLocation } from '../../lib/publicLocation';

describe('public location metadata formatting', () => {
  test('renders a published Ahmedabad article location without publication status metadata', () => {
    const article = {
      status: 'published',
      location: {
        district: 'ahmedabad',
        state: 'draft',
      },
    };

    expect(formatPublicArticleLocation(article)).toBe('Ahmedabad');
  });

  test('does not append publication status to public location display', () => {
    expect(formatPublicArticleLocation({ status: 'published', location: { district: 'ahmedabad' } })).toBe('Ahmedabad');
    expect(formatPublicArticleLocation({ status: 'draft', location: { district: 'ahmedabad' } })).toBe('Ahmedabad');
  });

  test('keeps legitimate multi-part location values', () => {
    expect(formatPublicArticleLocation({ location: { city: 'ahmedabad', state: 'gujarat' } })).toBe('Ahmedabad, Gujarat');
    expect(formatPublicArticleLocation({ location: 'ahmedabad, gujarat' })).toBe('Ahmedabad, Gujarat');
  });
});