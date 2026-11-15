import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSpectrum, fluxRange, scale, type SpectralPoint } from './spectrum';

afterEach(() => vi.unstubAllGlobals());

const point = (flux: number): SpectralPoint => ({
  wavelength_um: 1,
  bandwidth_um: 0.05,
  flux,
  error: 0.1,
  detector: 1,
  mjd: 60800,
  obs_id: 'x',
});

describe('fluxRange', () => {
  it('ignores a single outlier and keeps zero visible', () => {
    const points = [...Array.from({ length: 49 }, (_, i) => point(1 + i / 49)), point(1000)];
    const [low, high] = fluxRange(points);
    expect(low).toBeLessThan(0);
    expect(high).toBeLessThan(10);
  });

  it('has a sane default without data', () => {
    expect(fluxRange([])).toEqual([0, 1]);
  });
});

describe('scale', () => {
  it('maps and inverts', () => {
    expect(scale(5, [0, 10], 200)).toBe(100);
    expect(scale(10, [0, 10], 200, true)).toBe(0);
  });
});

describe('fetchSpectrum', () => {
  it('maps 502 to busy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 502 })));
    await expect(fetchSpectrum({ ra: 1, dec: 2 }, new AbortController().signal)).rejects.toMatchObject({
      kind: 'busy',
    });
  });
});
