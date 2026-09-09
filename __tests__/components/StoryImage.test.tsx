import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import StoryImage from '../../src/components/story/StoryImage';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, onError, onLoad }: any) => (
    <img src={src} alt={alt} onError={onError} onLoad={onLoad} data-testid="next-image" />
  ),
}));

describe('StoryImage', () => {
  test('falls back safely when a valid resolved image fails to load', () => {
    render(
      <StoryImage
        storyId="broken-image-story"
        src="https://res.cloudinary.com/demo/image/upload/broken.jpg"
        alt="Broken story image"
        variant="top"
        fallbackSrc="/fallback.svg"
      />
    );

    const image = screen.getByTestId('next-image');
    expect(image.getAttribute('src')).toBe('https://res.cloudinary.com/demo/image/upload/broken.jpg');

    fireEvent.error(image);

    expect(screen.getByTestId('next-image').getAttribute('src')).toBe('/fallback.svg');
  });
});