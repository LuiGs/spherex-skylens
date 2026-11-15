import { describe, expect, it } from 'vitest';
import type { SmallBody } from './api';
import { needsNewQuery, shortName, skyRate } from './solarSystem';

const body = (over: Partial<SmallBody>): SmallBody => ({
  name: 'x',
  kind: 'asteroid',
  ra: 0,
  dec: 0,
  vmag: null,
  ra_rate_arcsec_h: null,
  dec_rate_arcsec_h: null,
  dist_arcsec: null,
  ...over,
});

describe('solar system overlay helpers', () => {
  it('reuses a JPL query while the view stays in the same field and epoch', () => {
    const previous = { ra: 180, dec: 0, mjd: 60801.2 };
    expect(needsNewQuery(null, previous)).toBe(true);
    expect(needsNewQuery(previous, { ra: 180.1, dec: 0.05, mjd: 60801.4 })).toBe(false);
    expect(needsNewQuery(previous, { ra: 180.4, dec: 0, mjd: 60801.2 })).toBe(true);
    expect(needsNewQuery(previous, { ra: 180, dec: 0, mjd: 60802 })).toBe(true);
  });

  it('combines RA and Dec rates', () => {
    expect(skyRate(body({ ra_rate_arcsec_h: 3, dec_rate_arcsec_h: 4 }))).toBe(5);
    expect(skyRate(body({ ra_rate_arcsec_h: 3 }))).toBeNull();
  });

  it('shortens JPL designations', () => {
    expect(shortName('8891 Irokawa (1994 RC1)')).toBe('8891 Irokawa');
    expect(shortName('(2009 SZ243)')).toBe('2009 SZ243');
    expect(shortName('C/2023 A3 (Tsuchinshan-ATLAS)')).toBe('C/2023 A3');
  });
});
