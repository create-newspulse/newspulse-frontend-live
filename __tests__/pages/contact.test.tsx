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

    expect(screen.getAllByText('newspulse.team@gmail.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('community@newspulse.co.in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('grievance@newspulse.co.in').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/newspulse\.ads@gmail\.com/i).length).toBeGreaterThan(0);

    expect(screen.getByRole('link', { name: 'newspulse.team@gmail.com' }).getAttribute('href')).toBe('mailto:newspulse.team@gmail.com');
    expect(screen.getAllByRole('link', { name: 'community@newspulse.co.in' })[0]?.getAttribute('href')).toBe('mailto:community@newspulse.co.in');
    expect(screen.getByRole('link', { name: 'newspulse.ads@gmail.com' }).getAttribute('href')).toBe('mailto:newspulse.ads@gmail.com');
    expect(screen.queryByText('newspulse.admin@gmail.com')).toBeNull();
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