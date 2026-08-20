import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(process.cwd(), 'pages', 'index.tsx'), 'utf8');

function extractArray(name: string) {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n  \\];`));
  if (!match) throw new Error(`Could not find ${name}`);
  return match[1];
}

function routePosition(block: string, route: string) {
  const position = block.indexOf(`localizePath('${route}', lang)`);
  if (position < 0) throw new Error(`Missing route ${route}`);
  return position;
}

describe('homepage footer information architecture', () => {
  const quickLinks = extractArray('quickLinks');
  const legalComplianceLinks = extractArray('legalComplianceLinks');

  it('uses News Pulse as the first footer column heading', () => {
    expect(source).toMatch(/<div className="md:col-span-4">[\s\S]*?<div className="text-lg font-extrabold"[^>]*>\s*News Pulse\s*<\/div>/);
  });

  it('keeps Editorial Policy and Digital Code of Ethics only under Legal & Compliance', () => {
    expect(quickLinks).not.toContain("t('footer.editorialPolicy')");
    expect(quickLinks).not.toContain("t('footer.digitalCodeOfEthics')");
    expect(legalComplianceLinks).toContain("t('footer.editorialPolicy')");
    expect(legalComplianceLinks).toContain("t('footer.digitalCodeOfEthics')");
    expect((source.match(/localizePath\('\/editorial-policy', lang\)/g) || [])).toHaveLength(1);
    expect((source.match(/localizePath\('\/digital-code-of-ethics', lang\)/g) || [])).toHaveLength(1);
  });

  it('preserves the requested footer link order and routes', () => {
    expect(quickLinks).toContain("t('common.communityReporter')");
    expect(quickLinks).toContain("label: 'Community Reporter Guide'");

    expect(routePosition(quickLinks, '/about-us')).toBeLessThan(routePosition(quickLinks, '/contact'));
    expect(routePosition(quickLinks, '/contact')).toBeLessThan(routePosition(quickLinks, '/careers'));
    expect(routePosition(quickLinks, '/careers')).toBeLessThan(routePosition(quickLinks, '/community-reporter'));
    expect(routePosition(quickLinks, '/community-reporter')).toBeLessThan(routePosition(quickLinks, '/community-reporter/guidelines'));
    expect(routePosition(quickLinks, '/community-reporter/guidelines')).toBeLessThan(routePosition(quickLinks, '/journalist-desk'));

    expect(routePosition(legalComplianceLinks, '/editorial-policy')).toBeLessThan(routePosition(legalComplianceLinks, '/digital-code-of-ethics'));
    expect(routePosition(legalComplianceLinks, '/digital-code-of-ethics')).toBeLessThan(routePosition(legalComplianceLinks, '/privacy-policy'));
    expect(routePosition(legalComplianceLinks, '/privacy-policy')).toBeLessThan(routePosition(legalComplianceLinks, '/cookie-policy'));
    expect(legalComplianceLinks.indexOf("t('footer.cookieSettings')")).toBeGreaterThan(routePosition(legalComplianceLinks, '/cookie-policy'));
    expect(routePosition(legalComplianceLinks, '/terms-of-service')).toBeGreaterThan(legalComplianceLinks.indexOf("t('footer.cookieSettings')"));
    expect(routePosition(legalComplianceLinks, '/terms-of-service')).toBeLessThan(routePosition(legalComplianceLinks, '/copyright-policy'));
    expect(routePosition(legalComplianceLinks, '/copyright-policy')).toBeLessThan(routePosition(legalComplianceLinks, '/grievance-redressal'));
    expect(routePosition(legalComplianceLinks, '/grievance-redressal')).toBeLessThan(routePosition(legalComplianceLinks, '/privacy-request'));
    expect(routePosition(legalComplianceLinks, '/privacy-request')).toBeLessThan(routePosition(legalComplianceLinks, '/monthly-compliance'));
  });
});