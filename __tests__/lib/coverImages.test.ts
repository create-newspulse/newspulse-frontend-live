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

  test('prefers image.en, image.hi, and image.gu records when present', () => {
    const article: any = {
      _id: 'article-lang-image',
      coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/default.jpg',
      image: {
        en: { url: 'https://res.cloudinary.com/demo/image/upload/english.jpg' },
        hi: { url: 'https://res.cloudinary.com/demo/image/upload/hindi-direct.jpg' },
        gu: { url: 'https://res.cloudinary.com/demo/image/upload/gujarati-direct.jpg' },
      },
    };

    expect(resolveCoverImageUrl(article, { lang: 'en' })).toBe('https://res.cloudinary.com/demo/image/upload/english.jpg');
    expect(resolveCoverImageUrl(article, { lang: 'hi' })).toBe('https://res.cloudinary.com/demo/image/upload/hindi-direct.jpg');
    expect(resolveCoverImageUrl(article, { lang: 'gu' })).toBe('https://res.cloudinary.com/demo/image/upload/gujarati-direct.jpg');
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

  test('resolves supported current and alternate article image fields consistently', () => {
    const fields = [
      { imageUrl: 'https://res.cloudinary.com/demo/image/upload/image-url.jpg' },
      { imageURL: 'https://res.cloudinary.com/demo/image/upload/image-url-uppercase.jpg' },
      { coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/cover-image-url.jpg' },
      { coverImage: { url: 'https://res.cloudinary.com/demo/image/upload/cover-image.jpg' } },
      { featuredImageUrl: 'https://res.cloudinary.com/demo/image/upload/featured-image-url.jpg' },
      { featuredImage: { url: 'https://res.cloudinary.com/demo/image/upload/featured-image.jpg' } },
      { thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/thumbnail-url.jpg' },
      { thumbnail: { url: 'https://res.cloudinary.com/demo/image/upload/thumbnail.jpg' } },
      { media: { url: 'https://res.cloudinary.com/demo/image/upload/media-url.jpg' } },
      { media: [{ thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/media-thumbnail-url.jpg' }] },
    ];

    for (const field of fields) {
      const article: any = { _id: 'article-field', ...field };
      const expected = JSON.stringify(field).match(/https:\/\/[^\"]+/)?.[0];
      expect(resolveCoverImageUrl(article)).toBe(expected);
    }
  });

  test('resolves multilingual variants from source/group-level image when localized text has no media', () => {
    const article: any = {
      _id: 'article-multilingual',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/source-image.jpg',
      translations: {
        hi: { title: 'Hindi title', summary: 'Hindi summary' },
        gu: { title: 'Gujarati title', summary: 'Gujarati summary' },
      },
    };

    expect(resolveCoverImageUrl(article, { lang: 'hi' })).toBe('https://res.cloudinary.com/demo/image/upload/source-image.jpg');
    expect(resolveCoverImageUrl(article, { lang: 'gu' })).toBe('https://res.cloudinary.com/demo/image/upload/source-image.jpg');
  });

  test('returns empty for genuinely missing image fields', () => {
    expect(resolveCoverImageUrl({ _id: 'article-missing', title: 'No image article' })).toBe('');
  });

  test('ignores invalid local file paths and keeps searching for a usable remote image', () => {
    const article: any = {
      _id: 'article-4',
      coverImageUrl: 'C:\\fakepath\\broken.jpg',
      featuredImageUrl: 'https://res.cloudinary.com/demo/image/upload/fallback-remote.jpg',
    };

    expect(resolveCoverImageUrl(article)).toBe('https://res.cloudinary.com/demo/image/upload/fallback-remote.jpg');
  });

  test('skips trashed or deleted media records before using image URLs', () => {
    const article: any = {
      _id: 'article-5',
      coverImage: {
        status: 'trashed',
        url: 'https://res.cloudinary.com/demo/image/upload/trashed.jpg',
      },
      media: [
        {
          status: 'deleted',
          image: 'https://res.cloudinary.com/demo/image/upload/deleted.jpg',
        },
        {
          status: 'published',
          image: 'https://res.cloudinary.com/demo/image/upload/active.jpg',
        },
      ],
    };

    expect(resolveCoverImageUrl(article)).toBe('https://res.cloudinary.com/demo/image/upload/active.jpg');
  });
});