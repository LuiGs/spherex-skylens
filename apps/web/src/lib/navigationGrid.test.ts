import { describe, expect, it } from 'vitest';
import { gridLabel, gridStep, gridOpacity } from './navigationGrid';

describe('coordinate grid', () => {
  it('holds visibility during camera motion and fades after inactivity', () => {
    expect(gridOpacity(0)).toBe(1);
    expect(gridOpacity(650)).toBe(1);
    expect(gridOpacity(1000)).toBeCloseTo(0.5);
    expect(gridOpacity(1400)).toBe(0);
  });
  it('selects angular spacing from field of view alone', () => {
    expect(gridStep(150)).toBe(30);
    expect(gridStep(150 - 1e-10)).toBe(30);
    expect(gridStep(120)).toBe(10);
    expect(gridStep(100)).toBe(10);
    expect(gridStep(1)).toBe(0.2);
  });
  it('shows units without padding or irrelevant decimal places', () => {
    expect(gridLabel(120, 'AR', 30)).toBe('AR 120°');
    expect(gridLabel(-80, 'Dec', 10)).toBe('Dec -80°');
    expect(gridLabel(0, 'Dec', 1)).toBe('Dec 0°');
    expect(gridLabel(0.2, 'AR', 0.1)).toBe('AR 0.2°');
    expect(gridLabel(-0.000001, 'Dec', 1)).toBe('Dec 0°');
  });
});
