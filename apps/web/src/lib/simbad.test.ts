import { describe, expect, it } from 'vitest';
import { buildIdentifyQuery, categorize, cleanName, parseIdentifyResponse, pickRadiusDeg } from './simbad';

describe('categorize', () => {
  it('maps SIMBAD codes to plain categories', () => {
    expect(categorize('PM*')).toBe('fastStar');
    expect(categorize('BD*')).toBe('brownDwarf');
    expect(categorize('G')).toBe('galaxy');
    expect(categorize('Sy1')).toBe('galaxy');
    expect(categorize('PN')).toBe('nebula');
    expect(categorize('GlC')).toBe('cluster');
    expect(categorize('Mi*')).toBe('variableStar');
    expect(categorize('*')).toBe('star');
    expect(categorize('Pl')).toBe('planet');
    expect(categorize('X')).toBe('other');
  });
});

describe('pickRadiusDeg', () => {
  it('grows with the field of view within sane bounds', () => {
    expect(pickRadiusDeg(0.01)).toBeCloseTo(10 / 3600, 6);
    expect(pickRadiusDeg(1)).toBeCloseTo(0.025, 6);
    expect(pickRadiusDeg(60)).toBe(0.1);
  });
});

describe('parseIdentifyResponse', () => {
  const planet = ["NAME Barnard's Star b", 'Pl', 269.452, 4.693, 14.2];
  const star = ["NAME Barnard's Star", 'PM*', 269.452, 4.693, 14.2];

  it('skips exoplanets that sit on their host star and cleans the NAME prefix', () => {
    const result = parseIdentifyResponse({ data: [planet, star] });
    expect(result).toMatchObject({ name: "Barnard's Star", category: 'fastStar', separationArcsec: 14.2 });
  });

  it('prefers a named object over a nearby survey designation', () => {
    const survey = ['[SKN2015] C18O-Ori 169', 'Neb', 83.82, -5.159, 8];
    const nebula = ['M  42', 'HII', 83.818, -5.39, 20];
    expect(parseIdentifyResponse({ data: [survey, nebula] })?.name).toBe('M 42');
    const far = ['M  42', 'HII', 83.818, -5.39, 400];
    expect(parseIdentifyResponse({ data: [survey, far] })?.name).toBe('[SKN2015] C18O-Ori 169');
  });

  it('returns null when nothing is catalogued nearby', () => {
    expect(parseIdentifyResponse({ data: [] })).toBeNull();
    expect(parseIdentifyResponse({})).toBeNull();
  });

  it('builds an ADQL cone query around the tapped point', () => {
    const query = buildIdentifyQuery({ ra: 10.5, dec: -3.25 }, 0.02);
    expect(query).toContain("CIRCLE('ICRS', 10.500000, -3.250000, 0.020000)");
    expect(query).toContain('ORDER BY sep');
  });

  it('normalises whitespace in names', () => {
    expect(cleanName('NAME   Barnard  Star')).toBe('Barnard Star');
  });
});
