import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, readViewState, writeViewState } from './urlState';

describe('url state', () => {
  it('round-trips', () => {
    const s = { ra: 10.5, dec: -20.25, fov: 0.5, frame: 12, target: null, timelapse: null, detector: null, wise: 0.5 };
    expect(readViewState(writeViewState(s))).toEqual(s);
  });

  it('round-trips the selected target', () => {
    const state = { ...DEFAULT_VIEW, target: 'wise-0855' };
    expect(readViewState(writeViewState(state))).toEqual(state);
    expect(readViewState('?target=wise-0855').target).toBe('wise-0855');
  });

  it('round-trips an open timelapse and its detector', () => {
    const state = { ...DEFAULT_VIEW, timelapse: 0.06, detector: 4 };
    expect(readViewState(writeViewState(state))).toEqual(state);
    expect(readViewState('?tl=0.5&det=9')).toMatchObject({ timelapse: null, detector: null });
    expect(readViewState('?wise=7').wise).toBe(1);
    expect(readViewState('?wise=-1').wise).toBe(0);
    expect(writeViewState({ ...readViewState(''), wise: 0 })).not.toContain('wise');
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
