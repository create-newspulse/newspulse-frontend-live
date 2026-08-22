import React from 'react';
import { render, screen } from '@testing-library/react';
import ContactPage from '../../pages/contact';

jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: {},
  }),
}));

describe('pages/contact', () => {
  it('shows the current public contact channels and keeps business inquiries on the ads email', () => {
    render(<ContactPage initialType={null} />);

    expect(screen.getByRole('heading', { name: 'Contact News Pulse' })).toBeTruthy();
    expect(screen.queryByLabelText('Reason')).toBeNull();

    expect(screen.getByText('General Contact')).toBeTruthy();
    expect(screen.getAllByText('Editorial / News Desk').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Grievance Redressal').length).toBeGreaterThan(0);
    expect(screen.getByText('Advertising and Business')).toBeTruthy();

    expect(screen.getAllByText('contact@newspulse.co.in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('community@newspulse.co.in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('grievance@newspulse.co.in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ads@newspulse.co.in').length).toBeGreaterThan(0);

    expect(screen.getByRole('link', { name: 'contact@newspulse.co.in' }).getAttribute('href')).toBe('mailto:contact@newspulse.co.in');
    expect(screen.getAllByRole('link', { name: 'community@newspulse.co.in' })[0]?.getAttribute('href')).toBe('mailto:community@newspulse.co.in');
    expect(screen.getByRole('link', { name: 'ads@newspulse.co.in' }).getAttribute('href')).toBe('mailto:ads@newspulse.co.in');
    expect(document.body.textContent).not.toContain('@gmail.com');
    expect(screen.queryByRole('option', { name: 'Business Promotion' })).toBeNull();
    expect(screen.getByText(/business or promotional enquiries/i)).toBeTruthy();
  });

  it('highlights the grievance channel when opened with the copyright type', () => {
    render(<ContactPage initialType="copyright" />);

    expect(screen.queryByLabelText('Reason')).toBeNull();
    expect(screen.getByText('Recommended for copyright and complaint requests')).toBeTruthy();
    expect(screen.getAllByText('grievance@newspulse.co.in').length).toBeGreaterThan(0);
  });
});