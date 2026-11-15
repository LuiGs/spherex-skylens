import { describe, expect, it } from 'vitest';
import { gaiaConeUrl, motionArrows } from './gaia';

const barnard = { ra: 269.452, dec: 4.693, pmRA: -801.6, pmDE: 10362.4 };

describe('gaiaConeUrl', () => {
  it('builds a sorted, magnitude-limited VizieR cone search for Gaia DR3', () => {
    const url = new URL(gaiaConeUrl(10, -5, 0.25, 0, 500));
    expect(url.host).toBe('vizier.cfa.harvard.edu');
    expect(url.searchParams.get('-source')).toBe('I/355/gaiadr3');
    expect(url.searchParams.get('-c')).toBe('10 -5');
    expect(url.searchParams.get('-c.rd')).toBe('0.25');
    expect(url.searchParams.get('-out.max')).toBe('500');
    expect(url.searchParams.get('-sort')).toBe('_r');
    expect(url.searchParams.get('Gmag')).toBe('<17');
    expect(url.searchParams.get('-out')).toContain('pmRA');
  });

  it('switches host for the fallback mirror', () => {
    expect(new URL(gaiaConeUrl(10, -5, 0.25, 1)).host).toBe('vizier.idia.ac.za');
  });
});

describe('motionArrows', () => {
  it('ignores slow stars and missing proper motions', () => {
    const result = motionArrows(
      [
        { ra: 1, dec: 1, pmRA: 3, pmDE: 4 },
        { ra: 1, dec: 1, pmRA: Number.NaN, pmDE: 100 },
      ],
      0.5,
    );
    expect(result).toEqual({ years: 0, arrows: [] });
  });

  it('picks a time span that keeps the fastest arrow within a fifth of the view', () => {
    const { years, arrows } = motionArrows([barnard], 0.5);
    expect(years).toBe(20);
    const [arrow] = arrows;
    const lengthDeg = Math.hypot(
      (arrow.to.ra - arrow.from.ra) * Math.cos((barnard.dec * Math.PI) / 180),
      arrow.to.dec - arrow.from.dec,
    );
    expect(lengthDeg).toBeLessThanOrEqual(0.1);
    expect(lengthDeg).toBeGreaterThan(0.05);
    expect(arrow.to.dec).toBeGreaterThan(barnard.dec);
  });

  it('draws the arrow head behind the tip', () => {
    const { arrows } = motionArrows([barnard], 0.5);
    const [arrow] = arrows;
    for (const point of arrow.head) expect(point.dec).toBeLessThan(arrow.to.dec);
  });

  it('wraps right ascension across 0°', () => {
    const { arrows } = motionArrows([{ ra: 359.999, dec: 0, pmRA: 5000, pmDE: 0 }], 1);
    expect(arrows[0].to.ra).toBeGreaterThanOrEqual(0);
    expect(arrows[0].to.ra).toBeLessThan(1);
  });
});
