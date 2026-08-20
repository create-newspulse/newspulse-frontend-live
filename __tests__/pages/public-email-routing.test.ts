import fs from 'fs';
import path from 'path';

function readPage(...parts: string[]) {
  return fs.readFileSync(path.join(process.cwd(), 'pages', ...parts), 'utf8');
}

describe('public email routing policy', () => {
  it('does not expose the private admin mailbox on public contact pages', () => {
    const publicPages = [
      readPage('contact.tsx'),
      readPage('careers.tsx'),
      readPage('community-reporter.tsx'),
      readPage('community-reporter', 'guidelines.tsx'),
      readPage('journalist-desk.tsx'),
      readPage('terms-of-service.tsx'),
      readPage('editorial-policy.tsx'),
    ];

    for (const source of publicPages) {
      expect(source).not.toContain('newspulse.admin@gmail.com');
    }
  });

  it('keeps the requested public email mapping in source', () => {
    expect(readPage('contact.tsx')).toContain("const generalEmail = 'newspulse.team@gmail.com';");
    expect(readPage('contact.tsx')).toContain("const contactEmail = 'community@newspulse.co.in';");
    expect(readPage('contact.tsx')).toContain("const grievanceEmail = 'grievance@newspulse.co.in';");
    expect(readPage('careers.tsx')).toContain("const contactEmail = 'newspulse.team@gmail.com';");
    expect(readPage('community-reporter.tsx')).toContain("const contactEmail = 'community@newspulse.co.in';");
    expect(readPage('community-reporter', 'guidelines.tsx')).toContain("const contactEmail = 'community@newspulse.co.in';");
    expect(readPage('journalist-desk.tsx')).toContain("const contactEmail = 'community@newspulse.co.in';");
    expect(readPage('editorial-policy.tsx')).toContain("const contactEmail = 'community@newspulse.co.in';");
    expect(readPage('terms-of-service.tsx')).toContain("const contactEmail = 'newspulse.team@gmail.com';");
  });
});