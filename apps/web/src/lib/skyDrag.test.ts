import { describe, expect, it } from 'vitest';
import { dragCamera } from './skyDrag';

describe('camera basis dragging', () => {
  it.each([89, -89, 90, -90])('keeps polar wiggles reversible at declination %s', (dec) => {
    const start = { ra: 0, dec, rotation: 17 };
    for (let cycle = 0; cycle < 10; cycle++) {
      for (const dy of [0.5, 1, 2, 4, 2, 1, 0.5, 0]) {
        const pose = dragCamera(start, 0, dy);
        expect(Object.values(pose).every(Number.isFinite)).toBe(true);
        expect(Math.abs(pose.dec)).toBeLessThanOrEqual(90);
      }
      expect(dragCamera(start, 0, 0)).toEqual(start);
    }
  });
  it('crosses the RA wrap with a small angular displacement', () => {
    const result = dragCamera({ ra: 359.9, dec: 0, rotation: 0 }, 0.2, 0);
    expect(result.ra).toBeCloseTo(0.1, 6);
    expect(result.rotation).toBeCloseTo(0, 6);
  });
});
