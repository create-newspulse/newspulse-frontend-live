import React from 'react';
import { render, screen } from '@testing-library/react';

import CareersPage from '../../pages/careers';

describe('pages/careers', () => {
  const email = 'contact@newspulse.co.in';
  const subject = 'Career Application - [Position] - [Applicant Name]';
  const mailtoHref = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

  it('renders the Careers route with the public team mailbox', () => {
    const { container } = render(<CareersPage />);

    expect(screen.getByRole('heading', { name: 'Careers at News Pulse' })).toBeTruthy();
    expect(screen.getAllByText(email).length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('@gmail.com');
  });

  it('uses the career application subject on public career mailto links', () => {
    render(<CareersPage />);

    const mailtoLinks = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href') || '')
      .filter((href) => href.startsWith('mailto:'));

    expect(mailtoLinks.length).toBeGreaterThan(0);
    expect(mailtoLinks.every((href) => href === mailtoHref)).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Apply / Contact' })[0]?.getAttribute('href')).toBe(mailtoHref);
  });
});