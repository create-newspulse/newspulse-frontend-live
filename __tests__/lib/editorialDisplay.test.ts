import { getImageAltText, getImageCaption, getLocalizedSeoValue } from '../../lib/editorialDisplay';

describe('editorialDisplay localized helpers', () => {
  test('selects localized image text and SEO fields before top-level values', () => {
    const article = {
      title: 'English title',
      imageAlt: 'English image alt',
      imageCaption: 'English caption',
      seo: {
        title: 'English SEO title',
        gu: {
          title: 'ગુજરાતી SEO શીર્ષક',
          metaDescription: 'ગુજરાતી મેટા વર્ણન',
        },
      },
      image: {
        gu: {
          alt: 'ગુજરાતી છબી વર્ણન',
          caption: 'ગુજરાતી છબી કેપ્શન',
        },
      },
    };

    expect(getImageAltText(article, 'gu')).toBe('ગુજરાતી છબી વર્ણન');
    expect(getImageCaption(article, 'gu')).toBe('ગુજરાતી છબી કેપ્શન');
    expect(getLocalizedSeoValue(article, 'gu', 'title')).toBe('ગુજરાતી SEO શીર્ષક');
    expect(getLocalizedSeoValue(article, 'gu', 'metaDescription')).toBe('ગુજરાતી મેટા વર્ણન');
    expect(getImageAltText(article, 'hi')).toBe('English image alt');
  });
});