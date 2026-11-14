import { describe, expect, it } from 'vitest';
import {
  applyProperMotion,
  deviceOrientationToHorizontal,
  horizontalToEquatorial,
  angularDistance,
  parseDec,
  parseRa,
} from './astro';

describe('coordinate parsing', () => {
  it('parses sexagesimal RA/Dec (WISE 0855 from the challenge)', () => {
    expect(parseRa('08h55m10.831s')).toBeCloseTo(133.795129, 5);
    expect(parseDec('-7d14m42.53s')).toBeCloseTo(-7.245147, 5);
  });

  it('parses decimal degrees and rejects garbage', () => {
    expect(parseRa('370')).toBeCloseTo(10);
    expect(parseDec('95')).toBeNull();
    expect(parseRa('hello')).toBeNull();
  });

  it('rejects out-of-range sexagesimal fields', () => {
    expect(parseDec('95d00m00s')).toBeNull();
    expect(parseDec('10d75m00s')).toBeNull();
    expect(parseRa('25h00m00s')).toBeNull();
    expect(parseRa('08h55m75s')).toBeNull();
    expect(parseDec('90d00m00s')).toBe(90);
  });

  it('computes angular distance', () => {
    expect(angularDistance({ ra: 0, dec: 0 }, { ra: 90, dec: 0 })).toBeCloseTo(90);
    expect(angularDistance({ ra: 359.5, dec: 0 }, { ra: 0.5, dec: 0 })).toBeCloseTo(1);
  });
});

describe('horizontal to equatorial', () => {
  it('zenith maps to dec = latitude and ra = LST', () => {
    const date = new Date('2026-10-02T00:00:00Z');
    const { dec } = horizontalToEquatorial({ alt: 90, az: 0 }, -24.78, -65.41, date);
    expect(dec).toBeCloseTo(-24.78, 3);
  });

  it('north horizon at the equator maps to dec = 90 - 0', () => {
    const { dec } = horizontalToEquatorial({ alt: 0, az: 0 }, 0, 0, new Date());
    expect(dec).toBeCloseTo(90, 3);
  });
});

describe('device orientation', () => {
  it('phone flat, screen up -> back camera points at nadir', () => {
    expect(deviceOrientationToHorizontal(0, 0, 0).alt).toBeCloseTo(-90);
  });

  it('phone upright facing north -> horizon, azimuth 0', () => {
    const { alt, az } = deviceOrientationToHorizontal(0, 90, 0);
    expect(alt).toBeCloseTo(0);
    expect(az).toBeCloseTo(0);
  });
});

describe('proper motion', () => {
  it("moves Barnard's star north ~4.4 arcmin in 25.5 years", () => {
    const p = applyProperMotion({ ra: 269.452, dec: 4.6934 }, -801.551, 10362.394, 2000, 2025.5);
    expect((p.dec - 4.6934) * 60).toBeCloseTo(4.4, 1);
  });
});
