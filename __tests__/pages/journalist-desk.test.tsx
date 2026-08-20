import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen } from '@testing-library/react';

import JournalistDeskPage from '../../pages/journalist-desk';

describe('pages/journalist-desk', () => {
  const email = 'community@newspulse.co.in';
  const subject = 'Journalist Desk - [Pitch / Proposal] - [Name]';
  const mailtoHref = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

  it('renders the Journalist Desk route with the shared community email', () => {
    const { container } = render(<JournalistDeskPage />);

    expect(screen.getByRole('heading', { name: 'Journalist Desk' })).toBeTruthy();
    expect(screen.getAllByText(email).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('newspulse.team@gmail.com');
  });

  it('uses the shared community mailbox and Journalist Desk subject for all mailto links', () => {
    render(<JournalistDeskPage />);

    const mailtoLinks = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href') || '')
      .filter((href) => href.startsWith('mailto:'));

    expect(mailtoLinks.length).toBeGreaterThan(0);
    expect(mailtoLinks.every((href) => href === mailtoHref)).toBe(true);
    expect(screen.getByRole('link', { name: 'Submit a Pitch' }).getAttribute('href')).toBe(mailtoHref);
    expect(screen.getByRole('link', { name: 'Email Journalist Desk' }).getAttribute('href')).toBe(mailtoHref);
  });

  it('keeps Community Reporter on the shared community email', () => {
    const communityReporterSource = fs.readFileSync(path.join(process.cwd(), 'pages', 'community-reporter.tsx'), 'utf8');
    const communityReporterGuideSource = fs.readFileSync(path.join(process.cwd(), 'pages', 'community-reporter', 'guidelines.tsx'), 'utf8');

    expect(communityReporterSource).toContain("const contactEmail = 'community@newspulse.co.in';");
    expect(communityReporterGuideSource).toContain("const contactEmail = 'community@newspulse.co.in';");
  });
});