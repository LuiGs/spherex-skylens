import { afterEach, describe, expect, it, vi } from 'vitest';
import { findChallengeTarget, parseCoordinatePair, parseSesame, resolveSearch } from './resolver';

afterEach(() => vi.unstubAllGlobals());

const SESAME_M31 = `# M31\t#Q213528
#=S=Simbad, IDIA (via url):    1     0ms (from cache)
%@ 1575544
%I.0 M  31
%C.0 AGN
%J 10.6847083 +41.2687500 = 00:42:44.32 +41:16:07.5
#====Done====`;

describe('parseCoordinatePair', () => {
  it('reads decimal and sexagesimal pairs', () => {
    for (const text of ['133.79 -7.24', '133.79, -7.24']) {
      expect(parseCoordinatePair(text)?.ra).toBeCloseTo(133.79);
      expect(parseCoordinatePair(text)?.dec).toBeCloseTo(-7.24);
    }
    const sexagesimal = parseCoordinatePair('08h55m10.831s -7d14m42.53s');
    expect(sexagesimal?.ra).toBeCloseTo(133.79513, 4);
    expect(sexagesimal?.dec).toBeCloseTo(-7.24515, 4);
    expect(parseCoordinatePair('08 55 10.831 -07 14 42.53')?.ra).toBeCloseTo(133.79513, 4);
  });

  it('rejects names and invalid values', () => {
    expect(parseCoordinatePair('M31')).toBeNull();
    expect(parseCoordinatePair('Barnard star')).toBeNull();
    expect(parseCoordinatePair('10 95')).toBeNull();
  });
});

describe('findChallengeTarget', () => {
  it('matches names loosely', () => {
    expect(findChallengeTarget('barnard')?.id).toBe('barnard');
    expect(findChallengeTarget('wise 0855')?.id).toBe('wise-0855');
    expect(findChallengeTarget('Epsilon Indi')?.id).toBe('eps-indi-b');
    expect(findChallengeTarget('ab')).toBeNull();
  });
});

describe('parseSesame', () => {
  it('extracts name and J2000 position', () => {
    expect(parseSesame(SESAME_M31)).toEqual({ name: 'M  31', position: { ra: 10.6847083, dec: 41.26875 } });
    expect(parseSesame('#! *** Nothing found ***')).toBeNull();
  });
});

describe('resolveSearch', () => {
  it('prefers coordinates and challenge targets before calling Sesame', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await resolveSearch('10 20')).toEqual({ kind: 'coordinates', position: { ra: 10, dec: 20 } });
    expect((await resolveSearch('R Draconis'))?.kind).toBe('target');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the CDS name resolver', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(SESAME_M31)));
    expect(await resolveSearch('M31')).toEqual({ kind: 'name', name: 'M31', position: { ra: 10.6847083, dec: 41.26875 } });
  });

  it('tries the next mirror when one fails', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(SESAME_M31));
    vi.stubGlobal('fetch', fetchMock);
    expect((await resolveSearch('M31'))?.kind).toBe('name');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
