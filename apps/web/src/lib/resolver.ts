import { CHALLENGE_TARGETS, type Target } from '../data/targets';
import { parseDec, parseRa, type Equatorial } from './astro';

export type SearchResult =
  | { kind: 'target'; target: Target }
  | { kind: 'coordinates'; position: Equatorial }
  | { kind: 'name'; name: string; position: Equatorial };

// CDS Sesame mirrors, fastest first; the main CDS host can take 20+ s when it redirects to another mirror.
const SESAME_URLS = [
  'https://vizier.cfa.harvard.edu/viz-bin/nph-sesame/-oI/SNV',
  'https://cds.unistra.fr/cgi-bin/nph-sesame/-oI/SNV',
];
const SESAME_TIMEOUT_MS = 8000;

/** Accepts "133.79 -7.24", "133.79, -7.24", "08h55m10.8s -7d14m42s" or "08 55 10.8 -07 14 42.5". */
export function parseCoordinatePair(input: string): Equatorial | null {
  const text = input.trim();
  let parts: string[];
  if (text.includes(',')) parts = text.split(',');
  else {
    const tokens = text.split(/\s+/);
    if (tokens.length === 2) parts = tokens;
    else if (tokens.length === 6) parts = [tokens.slice(0, 3).join(':'), tokens.slice(3).join(':')];
    else return null;
  }
  if (parts.length !== 2) return null;
  const ra = parseRa(parts[0]);
  const dec = parseDec(parts[1]);
  return ra === null || dec === null ? null : { ra, dec };
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function findChallengeTarget(query: string): Target | null {
  const wanted = normalize(query);
  if (wanted.length < 3) return null;
  return (
    CHALLENGE_TARGETS.find((target) => {
      const name = normalize(target.name);
      return name.startsWith(wanted) || normalize(target.id) === wanted;
    }) ?? null
  );
}

/** Parses the plain-text answer of the CDS Sesame name resolver. */
export function parseSesame(text: string): { name: string; position: Equatorial } | null {
  const coordinates = text.match(/^%J\s+([\d.]+)\s+([+-]?[\d.]+)/m);
  if (!coordinates) return null;
  const name = text.match(/^%I\.0\s+(.+)$/m)?.[1].trim() ?? '';
  return { name, position: { ra: Number(coordinates[1]), dec: Number(coordinates[2]) } };
}

export async function resolveSearch(query: string, signal?: AbortSignal): Promise<SearchResult | null> {
  const position = parseCoordinatePair(query);
  if (position) return { kind: 'coordinates', position };
  const target = findChallengeTarget(query);
  if (target) return { kind: 'target', target };
  let lastError: unknown = null;
  for (const url of SESAME_URLS) {
    const timeout = AbortSignal.timeout(SESAME_TIMEOUT_MS);
    try {
      const response = await fetch(`${url}?${encodeURIComponent(query.trim())}`, {
        signal: signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!response.ok) throw new Error(`Sesame respondió ${response.status}`);
      const resolved = parseSesame(await response.text());
      return resolved ? { kind: 'name', name: query.trim(), position: resolved.position } : null;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError;
}
