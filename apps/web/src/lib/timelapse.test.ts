import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultTimelapseSize, differencePixels, fetchTimelapse, nextFrame, skyToFrame } from './timelapse';

afterEach(() => vi.unstubAllGlobals());

describe('timelapse playback', () => {
  it('loops through every epoch in play mode', () => {
    expect([0, 1, 2].map((i) => nextFrame(i, 3, 'play', [0, 2]))).toEqual([1, 2, 0]);
  });

  it('alternates between the blink pair', () => {
    expect(nextFrame(0, 4, 'blink', [0, 3])).toBe(3);
    expect(nextFrame(3, 4, 'blink', [0, 3])).toBe(0);
    expect(nextFrame(1, 4, 'blink', [0, 3])).toBe(0);
  });

  it('handles an empty timelapse', () => {
    expect(nextFrame(0, 0, 'play', [0, 0])).toBe(0);
  });
});

describe('skyToFrame', () => {
  const center = { ra: 133.78, dec: -7.24 };

  it('puts the center in the middle', () => {
    expect(skyToFrame(center, center, 0.03)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('draws north up and east to the left', () => {
    const north = skyToFrame({ ra: center.ra, dec: center.dec + 0.0075 }, center, 0.03);
    expect(north.x).toBeCloseTo(0.5);
    expect(north.y).toBeCloseTo(0.25, 3);
    const east = skyToFrame({ ra: center.ra + 0.0075 / Math.cos((center.dec * Math.PI) / 180), dec: center.dec }, center, 0.03);
    expect(east.x).toBeCloseTo(0.25, 3);
  });

  it('wraps right ascension around 0°', () => {
    expect(skyToFrame({ ra: 0.005, dec: 0 }, { ra: 359.995, dec: 0 }, 0.03).x).toBeCloseTo(0.5 - 0.01 / 0.03);
  });
});

describe('differencePixels', () => {
  it('maps no change to grey and new flux to bright', () => {
    const a = new Uint8ClampedArray([10, 10, 10, 255, 50, 50, 50, 255]);
    const b = new Uint8ClampedArray([10, 10, 10, 255, 90, 90, 90, 255]);
    expect(Array.from(differencePixels(a, b))).toEqual([128, 128, 128, 255, 208, 208, 208, 255]);
  });
});

describe('defaultTimelapseSize', () => {
  it('picks the largest cutout that fits the view', () => {
    expect(defaultTimelapseSize(0.01)).toBe(0.03);
    expect(defaultTimelapseSize(0.08)).toBe(0.06);
    expect(defaultTimelapseSize(2)).toBe(0.1);
  });
});

describe('fetchTimelapse', () => {
  it('sends the detector only when chosen', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{"epochs":[]}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchTimelapse({ ra: 1, dec: 2, size: 0.03, detector: null }, new AbortController().signal);
    await fetchTimelapse({ ra: 1, dec: 2, size: 0.03, detector: 3 }, new AbortController().signal);
    expect(fetchMock.mock.calls[0][0]).not.toContain('detector');
    expect(fetchMock.mock.calls[1][0]).toContain('detector=3');
  });

  it('maps 503 to busy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(
      fetchTimelapse({ ra: 1, dec: 2, size: 0.03, detector: null }, new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'busy' });
  });
});
