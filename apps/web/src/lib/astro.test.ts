import { describe, expect, it } from 'vitest';
import {
  angularSeparation,
  applyProperMotion,
  dateToMjd,
  deviceOrientationToHorizontal,
  earthBarycentric,
  horizontalToEquatorial,
  angularDistance,
  mjdToJulianYear,
  parseDec,
  parseRa,
  predictPosition,
  smoothPointing,
} from './astro';
import { CHALLENGE_TARGETS } from '../data/targets';

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

describe('astrometric predictions', () => {
  const references = [
    { id: 'barnard', mjd: 60801.11, ra: 269.44652259, dec: 4.76636605 },
    { id: 'barnard', mjd: 61000.5, ra: 269.44621727, dec: 4.76782477 },
    { id: 'barnard', mjd: 61162.74, ra: 269.44630745, dec: 4.76921274 },
    { id: 'eps-indi-b', mjd: 60801.11, ra: 331.09545364, dec: -56.80018205 },
    { id: 'eps-indi-b', mjd: 61000.5, ra: 331.09630310, dec: -56.80060489 },
    { id: 'eps-indi-b', mjd: 61162.74, ra: 331.09745169, dec: -56.80085747 },
    { id: 'wise-0855', mjd: 60801.11, ra: 133.76168832, dec: -7.24193379 },
    { id: 'wise-0855', mjd: 61000.5, ra: 133.76070625, dec: -7.24189165 },
    { id: 'wise-0855', mjd: 61162.74, ra: 133.75948017, dec: -7.24171507 },
    { id: 'rw-aur', mjd: 60801.11, ra: 76.95655812, dec: 30.40125212 },
    { id: 'rw-aur', mjd: 61000.5, ra: 76.95656049, dec: 30.40124886 },
    { id: 'rw-aur', mjd: 61162.74, ra: 76.95655960, dec: 30.40124536 },
    { id: 'r-dra', mjd: 60801.11, ra: 248.16724298, dec: 66.75502303 },
    { id: 'r-dra', mjd: 61000.5, ra: 248.16723453, dec: 66.75502330 },
    { id: 'r-dra', mjd: 61162.74, ra: 248.16722864, dec: 66.75502471 },
  ];

  it.each(references)('$id at MJD $mjd matches the reference coordinates', ({ id, mjd, ra, dec }) => {
    const target = CHALLENGE_TARGETS.find((candidate) => candidate.id === id);
    if (!target) throw new Error(`Missing target ${id}`);
    const predicted = predictPosition(target, mjd);
    const deltaRaArcsec =
      ((((predicted.ra - ra + 540) % 360) - 180) * Math.cos((dec * Math.PI) / 180) * 3600);
    const deltaDecArcsec = (predicted.dec - dec) * 3600;

    expect(Math.abs(deltaRaArcsec)).toBeLessThan(0.05);
    expect(Math.abs(deltaDecArcsec)).toBeLessThan(0.05);
  });

  it('converts dates and MJD to Julian years', () => {
    expect(dateToMjd(new Date('2000-01-01T12:00:00Z'))).toBe(51544.5);
    expect(mjdToJulianYear(51544.5)).toBe(2000);
  });

  it('uses zero parallax as proper motion only and returns the source at its epoch', () => {
    const target = CHALLENGE_TARGETS.find((candidate) => candidate.id === 'barnard');
    if (!target) throw new Error('Missing Barnard target');
    const mjd = 60801.11;
    expect(predictPosition({ ...target, parallax: 0 }, mjd)).toEqual(predictPosition({ ...target, parallax: undefined }, mjd));

    const atEpoch = dateToMjd(new Date(Date.UTC(2016, 0, 1, 12)));
    const noParallax = predictPosition({ ...target, parallax: 0 }, atEpoch);
    expect(noParallax.ra).toBeCloseTo(target.ra, 12);
    expect(noParallax.dec).toBeCloseTo(target.dec, 12);
  });

  it('returns an Earth position in astronomical units', () => {
    const earth = earthBarycentric(60801.11);
    expect(earth).toHaveLength(3);
    expect(Math.hypot(...earth)).toBeGreaterThan(0.98);
    expect(Math.hypot(...earth)).toBeLessThan(1.02);
  });
});

describe('smoothPointing', () => {
  it('moves part of the way and wraps RA around 0°', () => {
    expect(smoothPointing(null, { ra: 10, dec: 0 }, 0.3)).toEqual({ ra: 10, dec: 0 });
    const half = smoothPointing({ ra: 359, dec: 0 }, { ra: 1, dec: 0 }, 0.5);
    expect(half.ra === 0 || half.ra === 360 || Math.abs(half.ra) < 1e-9 || Math.abs(half.ra - 360) < 1e-9).toBe(true);
    expect(smoothPointing({ ra: 0, dec: 0 }, { ra: 0, dec: 10 }, 0.25).dec).toBeGreaterThan(2);
  });
});

describe('angularSeparation', () => {
  it('is zero for the same point and 90° between pole and equator', () => {
    expect(angularSeparation({ ra: 10, dec: 20 }, { ra: 10, dec: 20 })).toBeCloseTo(0, 6);
    expect(angularSeparation({ ra: 0, dec: 90 }, { ra: 123, dec: 0 })).toBeCloseTo(90, 6);
  });

  it('shrinks with cos(dec) along right ascension', () => {
    expect(angularSeparation({ ra: 0, dec: 60 }, { ra: 2, dec: 60 })).toBeCloseTo(1, 1);
  });
});
