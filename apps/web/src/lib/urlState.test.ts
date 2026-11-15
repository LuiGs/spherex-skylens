import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, readViewState, writeViewState } from './urlState';

describe('url state', () => {
  it('preserves the composite range and accepts reversed or out-of-range limits safely', () => {
    const state = { ...DEFAULT_VIEW, spectralMode: 'color' as const, minFrame: 15, maxFrame: 80 };
    expect(readViewState(writeViewState(state))).toEqual(state);
    expect(readViewState('?min=90&max=10&mode=color').minFrame).toBe(10);
    expect(readViewState('?min=-10&max=200').maxFrame).toBe(101);
    expect(readViewState('?frame=40').spectralMode).toBe('mono');
  });
  it('round-trips', () => {
    const s = { ...DEFAULT_VIEW, ra: 10.5, dec: -20.25, fov: 0.5, frame: 12, projection: 'TAN' as const, target: null };
    expect(readViewState(writeViewState(s))).toEqual(s);
  });

  it('round-trips the selected target', () => {
    const state = { ...DEFAULT_VIEW, target: 'wise-0855' };
    expect(readViewState(writeViewState(state))).toEqual(state);
    expect(readViewState('?target=wise-0855').target).toBe('wise-0855');
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

  it('keeps old links in SIN and restricts perspective links to a valid field of view', () => {
    expect(readViewState('?fov=180').projection).toBe('SIN');
    expect(readViewState('?projection=invalid').projection).toBe('SIN');
    const perspective = readViewState('?projection=tan&fov=180');
    expect(perspective.projection).toBe('TAN');
    expect(perspective.fov).toBeLessThan(180);
    expect(readViewState(writeViewState(perspective))).toEqual(perspective);
  });
});
