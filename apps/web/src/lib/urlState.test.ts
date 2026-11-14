import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, readViewState, writeViewState } from './urlState';

describe('url state', () => {
  it('round-trips', () => {
    const s = { ra: 10.5, dec: -20.25, fov: 0.5, frame: 12 };
    expect(readViewState(writeViewState(s))).toEqual(s);
  });

  it('falls back to defaults on invalid values', () => {
    expect(readViewState('?ra=abc')).toEqual(DEFAULT_VIEW);
  });

  it('clamps out-of-range values from shared links', () => {
    expect(readViewState('?frame=102').frame).toBe(101);
    expect(readViewState('?frame=-3').frame).toBe(0);
    expect(readViewState('?dec=120').dec).toBe(90);
    expect(readViewState('?ra=370').ra).toBeCloseTo(10);
  });
});
