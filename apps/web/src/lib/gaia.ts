import { normalizeDeg, type Equatorial } from './astro';

/**
 * VizieR mirrors tried in order. Aladin's built-in host (vizier.unistra.fr) does not always
 * resolve, and a single mirror occasionally loses its database connection.
 */
export const GAIA_VIZIER_MIRRORS = ['https://vizier.cfa.harvard.edu', 'https://vizier.idia.ac.za'];

/** Faint stars swamp crowded Milky Way fields, so the cone keeps G < 17 and the nearest rows first. */
export const GAIA_MAX_GMAG = 17;

export function gaiaConeUrl(ra: number, dec: number, radiusDeg: number, mirror = 0, limit = 3000): string {
  const params = new URLSearchParams({
    '-source': 'I/355/gaiadr3',
    '-c': `${ra} ${dec}`,
    '-c.rd': String(radiusDeg),
    '-out.max': String(limit),
    '-sort': '_r',
    '-out': 'Source,RA_ICRS,DE_ICRS,Gmag,Plx,pmRA,pmDE,RUWE',
    Gmag: `<${GAIA_MAX_GMAG}`,
  });
  return `${GAIA_VIZIER_MIRRORS[mirror]}/viz-bin/votable?${params}`;
}

/** Position plus Gaia proper motion in mas/yr (pmRA already includes cos δ). */
export interface MovingStar extends Equatorial {
  pmRA: number;
  pmDE: number;
}

export interface MotionArrow {
  from: Equatorial;
  to: Equatorial;
  head: [Equatorial, Equatorial];
}

export interface MotionArrows {
  years: number;
  arrows: MotionArrow[];
}

const MAS_PER_DEG = 3.6e6;
const NICE_YEARS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
/** Slower stars would only draw dots at any useful time span. */
export const MIN_PROPER_MOTION = 20;
const MAX_ARROWS = 300;
const HEAD_ANGLE = (25 * Math.PI) / 180;

function offset({ ra, dec }: Equatorial, eastDeg: number, northDeg: number): Equatorial {
  return { ra: normalizeDeg(ra + eastDeg / Math.cos((dec * Math.PI) / 180)), dec: dec + northDeg };
}

/**
 * Arrows showing where each fast-moving star will be after a "nice" number of years,
 * chosen so the fastest arrow spans about a fifth of the field of view.
 */
export function motionArrows(stars: MovingStar[], fovDeg: number): MotionArrows {
  const moving = stars
    .filter((s) => Number.isFinite(s.pmRA) && Number.isFinite(s.pmDE))
    .map((s) => ({ ...s, pm: Math.hypot(s.pmRA, s.pmDE) }))
    .filter((s) => s.pm >= MIN_PROPER_MOTION)
    .sort((a, b) => b.pm - a.pm)
    .slice(0, MAX_ARROWS);
  if (moving.length === 0) return { years: 0, arrows: [] };

  const target = fovDeg / 5;
  const fastest = moving[0].pm / MAS_PER_DEG;
  const years = [...NICE_YEARS].reverse().find((y) => fastest * y <= target) ?? NICE_YEARS[0];

  const arrows = moving.map((s) => {
    const east = (s.pmRA * years) / MAS_PER_DEG;
    const north = (s.pmDE * years) / MAS_PER_DEG;
    const angle = Math.atan2(north, east);
    const headLength = Math.min(Math.hypot(east, north) * 0.35, fovDeg / 60);
    const back = (side: number) =>
      offset(
        s,
        east - headLength * Math.cos(angle + side * HEAD_ANGLE),
        north - headLength * Math.sin(angle + side * HEAD_ANGLE),
      );
    return {
      from: { ra: s.ra, dec: s.dec },
      to: offset(s, east, north),
      head: [back(1), back(-1)] as [Equatorial, Equatorial],
    };
  });
  return { years, arrows };
}
