import { angularDistance, type Equatorial } from './astro';
import type { SmallBody } from './api';

/** Width (deg) of the field asked to JPL; wide enough to cover a 1° SPHEREx cutout. */
export const SOLAR_SYSTEM_FIELD_DEG = 1;

export interface SolarSystemQuery extends Equatorial {
  mjd: number;
}

/**
 * JPL takes 20–60 s per field, so a query is reused while the view stays inside the
 * same field and the epoch does not change by more than half a day.
 */
export function needsNewQuery(previous: SolarSystemQuery | null, next: SolarSystemQuery): boolean {
  if (!previous) return true;
  if (Math.abs(previous.mjd - next.mjd) > 0.5) return true;
  return angularDistance(previous, next) > SOLAR_SYSTEM_FIELD_DEG / 4;
}

/** Sky motion in arcsec per hour, or null when JPL did not report rates. */
export function skyRate(body: SmallBody): number | null {
  if (body.ra_rate_arcsec_h === null || body.dec_rate_arcsec_h === null) return null;
  return Math.hypot(body.ra_rate_arcsec_h, body.dec_rate_arcsec_h);
}

/** Short display name: "8891 Irokawa (1994 RC1)" → "8891 Irokawa"; "(2009 SZ243)" → "2009 SZ243". */
export function shortName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) return trimmed.slice(1, -1);
  return trimmed.replace(/\s*\([^)]*\)\s*$/, '');
}
