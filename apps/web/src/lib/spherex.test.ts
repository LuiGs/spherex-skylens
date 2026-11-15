import { describe, expect, it } from 'vitest';
import { CHANNELS, WAVELENGTHS, channelColor, nearestChannel } from './spherex';

describe('published spectral channels', () => {
  it('uses 102 published wavelengths and omits the two blank channels', () => {
    expect(WAVELENGTHS).toHaveLength(102);
    expect(CHANNELS.filter((c) => c.available)).toHaveLength(100);
    expect(WAVELENGTHS[40]).toBe(1.905);
    expect(nearestChannel(WAVELENGTHS[50])).not.toBe(50);
  });
  it('places colors by wavelength and rescales them to the selected range', () => {
    expect(channelColor(0, 0, 101)).toBe('rgb(0, 0, 255)');
    expect(channelColor(101, 0, 101)).toBe('rgb(255, 0, 0)');
    expect(channelColor(60, 0, 101)).not.toBe(channelColor(60, 34, 80));
    const t = (WAVELENGTHS[60] - WAVELENGTHS[0]) / (WAVELENGTHS[101] - WAVELENGTHS[0]);
    expect(channelColor(60, 0, 101)).toContain(String(Math.round(255 * (2 * t - 1))));
  });
});
