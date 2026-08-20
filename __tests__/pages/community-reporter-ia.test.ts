import fs from 'fs';
import path from 'path';

const operationalPage = fs.readFileSync(path.join(process.cwd(), 'pages', 'community-reporter.tsx'), 'utf8');
const guidelinesPage = fs.readFileSync(path.join(process.cwd(), 'pages', 'community-reporter', 'guidelines.tsx'), 'utf8');
const homePage = fs.readFileSync(path.join(process.cwd(), 'pages', 'index.tsx'), 'utf8');
const exploreCategories = fs.readFileSync(path.join(process.cwd(), 'components', 'ExploreCategories.tsx'), 'utf8');
const sitemap = fs.readFileSync(path.join(process.cwd(), 'pages', 'api', 'sitemap.ts'), 'utf8');

describe('Community Reporter public information architecture', () => {
  it('keeps public category launchers on the operational submission route', () => {
    expect(homePage).toContain('community: "/community-reporter"');
    expect(exploreCategories).toContain('{ href: "/community-reporter", label: "Community Reporter"');
  });

  it('keeps the operational page focused on participation and links to the guide', () => {
    expect(operationalPage).toContain('<SubmissionExperience {...props} variant="public" />');
    expect(operationalPage).toContain('/community-reporter/guidelines');
    expect(operationalPage).toContain('Having trouble submitting online?');
    expect(operationalPage).not.toContain('What Is Community Reporter?');
    expect(operationalPage).not.toContain('What Is Not Allowed');
  });

  it('publishes the requested guide sections and submission links', () => {
    const requiredSections = [
      'What Is Community Reporter?',
      'Who Can Participate?',
      'Community Reporter vs Professional Journalist',
      'What You Can Submit',
      'Safety & Verification',
      'Verification Notice',
      'Verification Before Publication',
      'What Is Not Allowed',
      'Responsibility of the Submitter',
      'Privacy / Photos / Videos / Copyright',
      'No Official Representation',
      'What Happens After Submission?',
      'News Pulse Rules',
      'Editorial Review',
      'How to Submit',
    ];

    for (const section of requiredSections) {
      expect(guidelinesPage).toContain(section);
    }

    expect(guidelinesPage).toContain('href="/community-reporter"');
    expect(guidelinesPage).toContain('Submit Your Story');
    expect(guidelinesPage).toContain('href="/journalist-desk"');
    expect(guidelinesPage).toContain('href="/editorial-policy"');
    expect(guidelinesPage).toContain('href="/digital-code-of-ethics"');
  });

  it('includes the guide in public discovery surfaces', () => {
    expect(homePage).toContain("label: t('common.communityReporter'), href: localizePath('/community-reporter', lang)");
    expect(homePage).toContain("label: 'Community Reporter Guide', href: localizePath('/community-reporter/guidelines', lang)");
    expect(homePage.indexOf("localizePath('/community-reporter', lang)")).toBeLessThan(homePage.indexOf("localizePath('/community-reporter/guidelines', lang)"));
    expect(sitemap).toContain("'/community-reporter/guidelines'");
  });
});