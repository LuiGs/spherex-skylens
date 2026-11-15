import type { Equatorial } from './astro';

const TAP_MIRRORS = ['https://simbad.harvard.edu/simbad/sim-tap/sync', 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync'];

export type ObjectCategory =
  | 'planet'
  | 'galaxy'
  | 'nebula'
  | 'cluster'
  | 'brownDwarf'
  | 'whiteDwarf'
  | 'fastStar'
  | 'variableStar'
  | 'star'
  | 'other';

export interface IdentifiedObject {
  name: string;
  otype: string;
  category: ObjectCategory;
  position: Equatorial;
  /** Separation from the tapped point, in arcseconds. */
  separationArcsec: number;
}

const GALAXY = new Set(['AGN', 'QSO', 'Sy1', 'Sy2', 'SyG', 'BLL', 'LIN', 'EmG', 'SBG', 'bCG', 'LSB', 'IG', 'PaG', 'GiG', 'GiC', 'GiP', 'ClG', 'GrG', 'CGG', 'rG', 'H2G', 'LeI', 'LeG', 'LeQ', 'Bla', 'BLL']);
const NEBULA = new Set(['Neb', 'HII', 'PN', 'RNe', 'DNe', 'MoC', 'GNe', 'BNe', 'SNR', 'SFR', 'EmO', 'HH', 'Cld', 'ISM', 'glb', 'cor', 'bub', 'sh', 'PN?', 'SR?']);
const CLUSTER = new Set(['Cl*', 'OpC', 'GlC', 'As*', 'St*', 'MGr', 'C?*', 'Gl?', 'Cl?', 'As?']);
const BROWN_DWARF = new Set(['BD*', 'BD?', 'LM*', 'LM?']);
const WHITE_DWARF = new Set(['WD*', 'WD?']);
const FAST_STAR = new Set(['PM*', 'HPM', 'HV*']);

/** Maps a SIMBAD object type code to a handful of categories a non-astronomer can relate to. */
export function categorize(otype: string): ObjectCategory {
  const code = otype.trim();
  if (code === 'Pl' || code === 'Pl?') return 'planet';
  if (GALAXY.has(code) || code === 'G' || code.startsWith('G?')) return 'galaxy';
  if (NEBULA.has(code)) return 'nebula';
  if (CLUSTER.has(code)) return 'cluster';
  if (BROWN_DWARF.has(code)) return 'brownDwarf';
  if (WHITE_DWARF.has(code)) return 'whiteDwarf';
  if (FAST_STAR.has(code)) return 'fastStar';
  if (/^(V|Mi|Ce|RR|LP|Er|Pu|Ro|Or|TT|Y\*|EB|No|SN|dS|RV|Ir|BY|RS|El|WV|SX|gD|ZZ|bC|cC)/.test(code) || code === 'YSO')
    return 'variableStar';
  if (code.includes('*')) return 'star';
  return 'other';
}

/** Radius worth searching for a tap, from a few arcseconds zoomed in to a few arcminutes zoomed out. */
export function pickRadiusDeg(fovDeg: number): number {
  return Math.min(0.1, Math.max(10 / 3600, fovDeg / 40));
}

export function cleanName(mainId: string): string {
  return mainId.replace(/^NAME\s+/, '').replace(/\s+/g, ' ').trim();
}

export function buildIdentifyQuery(center: Equatorial, radiusDeg: number): string {
  const ra = center.ra.toFixed(6);
  const dec = center.dec.toFixed(6);
  return [
    'SELECT TOP 8 main_id, otype_txt, ra, dec,',
    `DISTANCE(POINT('ICRS', ra, dec), POINT('ICRS', ${ra}, ${dec})) * 3600 AS sep`,
    'FROM basic',
    `WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE('ICRS', ${ra}, ${dec}, ${radiusDeg.toFixed(6)})) = 1`,
    'AND ra IS NOT NULL ORDER BY sep',
  ].join(' ');
}

interface TapResponse {
  data?: unknown[][];
}

/**
 * Picks the closest catalogued object, skipping exoplanets (they share their host star's position)
 * and preferring a proper name over a survey designation like "[ABC2015] 169" when both are close.
 */
export function parseIdentifyResponse(payload: TapResponse): IdentifiedObject | null {
  const candidates: IdentifiedObject[] = [];
  for (const row of payload.data ?? []) {
    const [mainId, otype, ra, dec, sep] = row;
    if (typeof mainId !== 'string' || typeof ra !== 'number' || typeof dec !== 'number' || typeof sep !== 'number') continue;
    const type = typeof otype === 'string' ? otype : '';
    const category = categorize(type);
    if (category === 'planet') continue;
    candidates.push({ name: cleanName(mainId), otype: type, category, position: { ra, dec }, separationArcsec: sep });
  }
  const closest = candidates[0];
  if (!closest) return null;
  if (!closest.name.startsWith('[')) return closest;
  const named = candidates.find((c) => !c.name.startsWith('[') && c.separationArcsec <= closest.separationArcsec * 3 + 5);
  return named ?? closest;
}

export async function identifyAt(center: Equatorial, radiusDeg: number, signal?: AbortSignal): Promise<IdentifiedObject | null> {
  const body = new URLSearchParams({
    request: 'doQuery',
    lang: 'adql',
    format: 'json',
    query: buildIdentifyQuery(center, radiusDeg),
  });
  let lastError: unknown = null;
  for (const url of TAP_MIRRORS) {
    try {
      const response = await fetch(url, { method: 'POST', body, signal });
      if (!response.ok) throw new Error(`SIMBAD ${response.status}`);
      return parseIdentifyResponse((await response.json()) as TapResponse);
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('SIMBAD unavailable');
}

export function simbadPageUrl(name: string): string {
  return `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(name)}`;
}
