import React from 'react';
import { render, screen } from '@testing-library/react';
import DigitalCodeOfEthicsPage from '../../pages/digital-code-of-ethics';

describe('pages/digital-code-of-ethics', () => {
  it('shows the applicable code of ethics section', () => {
    render(<DigitalCodeOfEthicsPage />);

    expect(screen.getByRole('heading', { name: 'Applicable Code of Ethics' })).toBeTruthy();
    expect(
      screen.getByText('News Pulse observes the Norms of Journalistic Conduct of the Press Council of India, the applicable Programme Code, and applicable laws governing the publication of news and current-affairs content.')
    ).toBeTruthy();
  });
});