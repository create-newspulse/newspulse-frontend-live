import { resolveCoverImageUrl, resolveCoverFitMode } from '../../lib/coverImages';

describe('coverImages', () => {
  test('resolves top-level cover image variants from the shared helper', () => {
    const article: any = {
      _id: 'article-1',
      imageURL: 'https://res.cloudinary.com/demo/image/upload/sample-top-level.jpg',
    };

    expect(resolveCoverImageUrl(article)).toBe('https://res.cloudinary.com/demo/image/upload/sample-top-level.jpg');
  });

  test('prefers requested localized image fields when present', () => {
    const article: any = {
      _id: 'article-2',
      coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/default.jpg',
      translations: {
        hi: {
          coverImage: {
            url: 'https://res.cloudinary.com/demo/image/upload/hindi.jpg',
          },
        },
        gu: {
          imageUrl: 'https://res.cloudinary.com/demo/image/upload/gujarati.jpg',
        },
      },
    };

    expect(resolveCoverImageUrl(article, { lang: 'hi' })).toBe('https://res.cloudinary.com/demo/image/upload/hindi.jpg');
    expect(resolveCoverImageUrl(article, { lang: 'gu' })).toBe('https://res.cloudinary.com/demo/image/upload/gujarati.jpg');
    expect(resolveCoverImageUrl(article, { lang: 'en' })).toBe('https://res.cloudinary.com/demo/image/upload/default.jpg');
  });

  test('falls back to nested media image fields used by some article shapes', () => {
    const article: any = {
      _id: 'article-3',
      media: [
        {
          image: 'https://res.cloudinary.com/demo/image/upload/media-image.jpg',
          width: 1600,
          height: 900,
        },
      ],
    };

    expect(resolveCoverImageUrl(article)).toBe('https://res.cloudinary.com/demo/image/upload/media-image.jpg');
    expect(resolveCoverFitMode(article, { src: resolveCoverImageUrl(article), altText: 'Hero image' })).toBe('cover');
  });

  test('ignores invalid local file paths and keeps searching for a usable remote image', () => {
    const article: any = {
      _id: 'article-4',
      coverImageUrl: 'C:\\fakepath\\broken.jpg',
      featuredImageUrl: 'https://res.cloudinary.com/demo/image/upload/fallback-remote.jpg',
    };

    expect(resolveCoverImageUrl(article)).toBe('https://res.cloudinary.com/demo/image/upload/fallback-remote.jpg');
  });
});