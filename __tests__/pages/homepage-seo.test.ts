import fs from 'fs';
import path from 'path';

describe('homepage SEO metadata', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'pages', 'index.tsx'), 'utf8');

  test('uses the requested homepage title, description and canonical URL', () => {
    expect(source).toContain("const HOMEPAGE_TITLE = 'News Pulse | Latest News in English, Hindi and Gujarati';");
    expect(source).toContain("const HOMEPAGE_DESCRIPTION = 'Read the latest regional, national, international, business, technology, sports and editorial news from News Pulse.';");
    expect(source).toContain("const HOMEPAGE_CANONICAL_URL = `${NEWS_PULSE_SITE_URL}/`; ".trim());
    expect(source).toContain('canonicalUrl: HOMEPAGE_CANONICAL_URL');
  });

  test('renders matching Open Graph and Twitter metadata from the existing page Head', () => {
    expect(source).toContain('<meta property="og:type" content="website" />');
    expect(source).toContain('<meta property="og:title" content={HOMEPAGE_TITLE} />');
    expect(source).toContain('<meta property="og:description" content={HOMEPAGE_DESCRIPTION} />');
    expect(source).toContain('<meta property="og:url" content={HOMEPAGE_CANONICAL_URL} />');
    expect(source).toContain('<meta name="twitter:title" content={HOMEPAGE_TITLE} />');
    expect(source).toContain('<meta name="twitter:description" content={HOMEPAGE_DESCRIPTION} />');
  });
});