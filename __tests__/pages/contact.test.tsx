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
  it('shows exactly the four public contact reasons and keeps ads/business inquiries on the ads email', () => {
    render(<ContactPage initialType={null} />);

    const select = screen.getByLabelText('Reason') as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.text);

    expect(options).toEqual([
      'General Inquiry',
      'Copyright / Permission / Complaint',
      'Feedback / Correction',
      'Technical Issue',
    ]);

    expect(screen.getAllByText('Newspulse.team@gmail.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/newspulse\.ads@gmail\.com/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('option', { name: 'Partnership / Collaboration' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Advertising' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Media Kit' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Sponsorship' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Sponsored Content' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Business Promotion' })).toBeNull();
    expect(
      screen.getAllByText(/For advertising, media kit, sponsorship, sponsored content, partnership, collaboration, or business promotion inquiries, please contact newspulse\.ads@gmail\.com\./i).length
    ).toBeGreaterThan(0);
  });

  it('preselects the copyright reason when opened with the copyright type', () => {
    render(<ContactPage initialType="copyright" />);

    const select = screen.getByLabelText('Reason') as HTMLSelectElement;
    expect(select.value).toBe('copyright');
    expect(select.options[select.selectedIndex]?.text).toBe('Copyright / Permission / Complaint');
  });
});