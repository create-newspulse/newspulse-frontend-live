import { fetchCurrentWeather } from '../../lib/fetchWeather';

describe('lib/fetchWeather', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('requests the same-origin current weather endpoint with a sanitized city', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tempC: 30.7, condition: 'Sunny' }),
    });

    const weather = await fetchCurrentWeather({ city: '  Ahmedabad  ' });

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect((global as any).fetch).toHaveBeenCalledWith(
      '/api/public/weather/current?city=Ahmedabad',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      })
    );
    expect(weather).toEqual({ tempC: 30.7, condition: 'Sunny' });
  });

  it('rejects missing or malformed cities without making a request', async () => {
    await expect(fetchCurrentWeather({ city: '' })).rejects.toThrow('Invalid weather city');
    await expect(fetchCurrentWeather({ city: 'Ahmedabad<script>' })).rejects.toThrow('Invalid weather city');
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('fails once for a non-ok response without retrying', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ ok: false }),
    });

    await expect(fetchCurrentWeather({ city: 'Ahmedabad' })).rejects.toThrow('Weather request failed (502)');
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });
});