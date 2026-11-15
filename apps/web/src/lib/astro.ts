import type { Target } from '../data/targets';

export interface Equatorial {
  ra: number;
  dec: number;
}

export interface Horizontal {
  alt: number;
  az: number;
}

const DEG = Math.PI / 180;

export const normalizeDeg = (deg: number): number => ((deg % 360) + 360) % 360;

export function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Local sidereal time in degrees (IAU 1982 approximation, < 0.1 s accuracy for this century). */
export function localSiderealTime(date: Date, longitudeDeg: number): number {
  const d = julianDate(date) - 2451545.0;
  const t = d / 36525;
  const gmst = 280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000;
  return normalizeDeg(gmst + longitudeDeg);
}

/** Converts horizontal coordinates (azimuth measured from North towards East) to ICRS-ish RA/Dec. */
export function horizontalToEquatorial(
  { alt, az }: Horizontal,
  latitudeDeg: number,
  longitudeDeg: number,
  date: Date,
): Equatorial {
  const lat = latitudeDeg * DEG;
  const a = alt * DEG;
  const A = az * DEG;
  const sinDec = Math.sin(a) * Math.sin(lat) + Math.cos(a) * Math.cos(lat) * Math.cos(A);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec)));
  const y = -Math.sin(A) * Math.cos(a);
  const x = Math.sin(a) * Math.cos(lat) - Math.cos(a) * Math.sin(lat) * Math.cos(A);
  const hourAngle = Math.atan2(y, x) / DEG;
  const ra = normalizeDeg(localSiderealTime(date, longitudeDeg) - hourAngle);
  return { ra, dec: dec / DEG };
}

/**
 * Converts a device orientation (W3C DeviceOrientationEvent angles, absolute) into the
 * horizontal direction the back camera is pointing at.
 */
export function deviceOrientationToHorizontal(alpha: number, beta: number, gamma: number): Horizontal {
  const a = alpha * DEG;
  const b = beta * DEG;
  const g = gamma * DEG;
  // Back-camera vector (0, 0, -1) rotated by R = Rz(alpha) * Rx(beta) * Ry(gamma), in the East-North-Up frame.
  const east = -(Math.cos(a) * Math.sin(g) + Math.sin(a) * Math.sin(b) * Math.cos(g));
  const north = -(Math.sin(a) * Math.sin(g) - Math.cos(a) * Math.sin(b) * Math.cos(g));
  const up = -(Math.cos(b) * Math.cos(g));
  const alt = Math.asin(Math.max(-1, Math.min(1, up))) / DEG;
  const az = normalizeDeg(Math.atan2(east, north) / DEG);
  return { alt, az };
}

/** Parses "08h55m10.831s" / "08:55:10.831" / "133.79" into degrees. */
export function parseRa(input: string): number | null {
  const s = input.trim();
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) return normalizeDeg(Number(s));
  const m = s.match(/^(\d{1,2})[h:\s]+(\d{1,2})[m:\s]+(\d{1,2}(?:\.\d+)?)s?$/i);
  if (!m) return null;
  const [h, min, sec] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (h >= 24 || min >= 60 || sec >= 60) return null;
  return (h + min / 60 + sec / 3600) * 15;
}

/** Parses "-7d14m42.53s" / "-07:14:42.53" / "-7.245" into degrees. */
export function parseDec(input: string): number | null {
  const s = input.trim();
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) {
    const v = Number(s);
    return Math.abs(v) <= 90 ? v : null;
  }
  const m = s.match(/^([+-]?)(\d{1,2})[d°:\s]+(\d{1,2})[m':\s]+(\d{1,2}(?:\.\d+)?)(?:s|")?$/i);
  if (!m) return null;
  const [min, sec] = [Number(m[3]), Number(m[4])];
  if (min >= 60 || sec >= 60) return null;
  const v = Number(m[2]) + min / 60 + sec / 3600;
  if (v > 90) return null;
  return m[1] === '-' ? -v : v;
}

/** Great-circle separation in degrees. */
export function angularDistance(a: Equatorial, b: Equatorial): number {
  const h =
    Math.sin(((b.dec - a.dec) * DEG) / 2) ** 2 +
    Math.cos(a.dec * DEG) * Math.cos(b.dec * DEG) * Math.sin(((b.ra - a.ra) * DEG) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / DEG;
}

/** Propagates a position with proper motion (mas/yr, pmRa includes cos(dec)) to a target epoch. */
export function applyProperMotion(
  { ra, dec }: Equatorial,
  pmRaMasYr: number,
  pmDecMasYr: number,
  fromEpoch: number,
  toEpoch: number,
): Equatorial {
  const years = toEpoch - fromEpoch;
  const dDec = (pmDecMasYr * years) / 3.6e6;
  const dRa = (pmRaMasYr * years) / 3.6e6 / Math.cos(dec * DEG);
  return { ra: normalizeDeg(ra + dRa), dec: dec + dDec };
}

export function mjdToJulianYear(mjd: number): number {
  return 2000 + (mjd - 51544.5) / 365.25;
}

export function dateToMjd(date: Date): number {
  return date.getTime() / 86400000 + 40587;
}

export function earthBarycentric(mjd: number): [number, number, number] {
  const jd = mjd + 2400000.5;
  const n = jd - 2451545;
  const L = 280.460 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;
  const radius = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
  const epsilon = (23.439 - 0.0000004 * n) * DEG;
  return [
    -radius * Math.cos(lambda),
    -radius * Math.cos(epsilon) * Math.sin(lambda),
    -radius * Math.sin(epsilon) * Math.sin(lambda),
  ];
}

export function predictPosition(target: Target, mjd: number): Equatorial {
  const ra0 = target.ra * DEG;
  const dec0 = target.dec * DEG;
  const cosRa = Math.cos(ra0);
  const sinRa = Math.sin(ra0);
  const cosDec = Math.cos(dec0);
  const sinDec = Math.sin(dec0);
  const years = mjdToJulianYear(mjd) - target.epoch;
  const radiansPerMas = DEG / 3_600_000;
  const pmRa = (target.pmRa ?? 0) * radiansPerMas * years;
  const pmDec = (target.pmDec ?? 0) * radiansPerMas * years;
  const x = cosDec * cosRa - pmRa * sinRa - pmDec * cosRa * sinDec;
  const y = cosDec * sinRa + pmRa * cosRa - pmDec * sinRa * sinDec;
  const z = sinDec + pmDec * cosDec;
  const norm = Math.hypot(x, y, z);
  const ra = normalizeDeg(Math.atan2(y, x) / DEG);
  const dec = Math.asin(z / norm);
  const [earthX, earthY, earthZ] = earthBarycentric(mjd);
  const parallaxDeg = (target.parallax ?? 0) / 3_600_000;
  const alpha = ra * DEG;
  const delta = dec;
  const deltaAlphaCosDelta = parallaxDeg * (earthX * Math.sin(alpha) - earthY * Math.cos(alpha));
  const deltaDelta =
    parallaxDeg *
    (earthX * Math.cos(alpha) * Math.sin(delta) +
      earthY * Math.sin(alpha) * Math.sin(delta) -
      earthZ * Math.cos(delta));

  return {
    ra: normalizeDeg(ra + deltaAlphaCosDelta / Math.cos(delta)),
    dec: delta / DEG + deltaDelta,
  };
}
