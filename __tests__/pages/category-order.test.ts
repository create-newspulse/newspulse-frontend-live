import fs from 'fs';
import path from 'path';

const homePage = fs.readFileSync(path.join(process.cwd(), 'pages', 'index.tsx'), 'utf8');
const appPage = fs.readFileSync(path.join(process.cwd(), 'pages', '_app.tsx'), 'utf8');
const exploreCategories = fs.readFileSync(path.join(process.cwd(), 'components', 'ExploreCategories.tsx'), 'utf8');

const expectedHomeCategoryKeys = [
  'breaking',
  'regional',
  'national',
  'international',
  'business',
  'science-technology',
  'tech-gadgets',
  'sports',
  'lifestyle',
  'faith-culture',
  'glamour',
  'web-stories',
  'viral-videos',
  'editorial',
  'pulse-dialogue',
  'youth',
  'inspiration',
  'community',
];

const expectedExploreHrefs = [
  '/breaking',
  '/regional/gujarat',
  '/national',
  '/international',
  '/business',
  '/science-technology',
  '/tech-gadgets',
  '/sports',
  '/lifestyle',
  '/faith-culture',
  '/glamour',
  '/web-stories',
  '/viral-videos',
  '/editorial',
  '/pulse-dialogue',
  '/youth-pulse',
  '/inspiration-hub',
  '/community-reporter',
];

const expectedHomeRoutes: Record<string, string> = {
  breaking: '/breaking',
  regional: '/regional/gujarat',
  national: '/national',
  international: '/international',
  business: '/business',
  'science-technology': '/science-technology',
  'tech-gadgets': '/tech-gadgets',
  sports: '/sports',
  lifestyle: '/lifestyle',
  'faith-culture': '/faith-culture',
  glamour: '/glamour',
  'web-stories': '/web-stories',
  'viral-videos': '/viral-videos',
  editorial: '/editorial',
  'pulse-dialogue': '/pulse-dialogue',
  youth: '/youth-pulse',
  inspiration: '/inspiration-hub',
  community: '/community-reporter',
};

const expectedHeaderCategoryRoutes = [
  '/business',
  '/sports',
  '/lifestyle',
  '/editorial',
  '/faith-culture',
  '/pulse-dialogue',
  '/tech-gadgets',
  '/hi/faith-culture',
  '/hi/pulse-dialogue',
  '/hi/tech-gadgets',
  '/gu/faith-culture',
  '/gu/pulse-dialogue',
  '/gu/tech-gadgets',
];

function extractConstArray(source: string, name: string): string {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!match) throw new Error(`Unable to find const array ${name}`);
  return match[1];
}

function extractHomeCategoryKeys(): string[] {
  const block = extractConstArray(homePage, 'CATEGORIES');
  return [...block.matchAll(/key:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function extractExploreHrefs(): string[] {
  const block = extractConstArray(exploreCategories, 'NAV');
  return [...block.matchAll(/href:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function extractHomeRoutes(): Record<string, string> {
  const match = homePage.match(/const CATEGORY_ROUTES:\s*Record<string, string>\s*=\s*{([\s\S]*?)};/);
  if (!match) throw new Error('Unable to find CATEGORY_ROUTES');

  const routes: Record<string, string> = {};
  for (const routeMatch of match[1].matchAll(/(?:['"]([^'"]+)['"]|([A-Za-z0-9_-]+)):\s*['"]([^'"]+)['"]/g)) {
    routes[routeMatch[1] || routeMatch[2]] = routeMatch[3];
  }
  return routes;
}

function extractHeaderCategoryRouteSegments(): Set<string> {
  const match = appPage.match(/const CATEGORY_ROUTE_SEGMENTS = new Set\(\[([\s\S]*?)\]\);/);
  if (!match) throw new Error('Unable to find CATEGORY_ROUTE_SEGMENTS');
  return new Set([...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((routeMatch) => routeMatch[1]));
}

function stripLocalePrefixForTest(pathname: string): string {
  const p = String(pathname || '/').trim();
  if (!p || p === '/') return '/';

  const lower = p.toLowerCase();
  if (lower === '/hi' || lower.startsWith('/hi/')) return `/${lower.slice('/hi'.length).replace(/^\//, '')}`.replace(/\/$/, '') || '/';
  if (lower === '/gu' || lower.startsWith('/gu/')) return `/${lower.slice('/gu'.length).replace(/^\//, '')}`.replace(/\/$/, '') || '/';
  if (lower === '/en' || lower.startsWith('/en/')) return `/${lower.slice('/en'.length).replace(/^\//, '')}`.replace(/\/$/, '') || '/';
  return p;
}

function isHeaderCategoryRouteForTest(asPath: string): boolean {
  const raw = String(asPath || '/');
  const pathOnly = (raw.split('?')[0] || '/').split('#')[0] || '/';
  const normalized = stripLocalePrefixForTest(pathOnly).toLowerCase().replace(/\/+$/, '') || '/';
  const first = normalized.split('/').filter(Boolean)[0] || '';
  return extractHeaderCategoryRouteSegments().has(first);
}

describe('public category order', () => {
  it('keeps the homepage category strip in editorial order', () => {
    expect(extractHomeCategoryKeys()).toEqual(expectedHomeCategoryKeys);
  });

  it('keeps Explore Categories in the same editorial order', () => {
    expect(extractExploreHrefs()).toEqual(expectedExploreHrefs);
  });

  it('keeps category strip links mapped to the expected public routes', () => {
    expect(extractHomeRoutes()).toMatchObject(expectedHomeRoutes);
  });

  it('keeps the global header enabled for public category routes', () => {
    for (const route of expectedHeaderCategoryRoutes) {
      expect(isHeaderCategoryRouteForTest(route)).toBe(true);
    }
  });
});