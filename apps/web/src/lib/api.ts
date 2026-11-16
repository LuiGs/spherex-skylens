export interface Observation {
  obs_id: string;
  collection: string;
  detector: number;
  mjd_start: number;
  wavelength_min_um: number;
  wavelength_max_um: number;
  access_url: string;
  cutout_url: string;
}

export interface ObservationsResponse {
  ra: number;
  dec: number;
  size_deg: number;
  count: number;
  observations: Observation[];
}

export type ApiErrorKind = 'busy' | 'network' | 'http';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;

  constructor(message: string, kind: ApiErrorKind, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL ?? '');

export async function fetchObservations(
  input: { ra: number; dec: number; size: number },
  signal: AbortSignal,
): Promise<ObservationsResponse> {
  const params = new URLSearchParams({
    ra: String(input.ra),
    dec: String(input.dec),
    size: String(input.size),
  });
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/observations?${params}`, { signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError('No se pudo conectar con la API.', 'network');
  }
  if (!response.ok) {
    const kind = [502, 503, 504].includes(response.status) ? 'busy' : 'http';
    throw new ApiError(`La API respondió con estado ${response.status}.`, kind, response.status);
  }
  return (await response.json()) as ObservationsResponse;
}

export interface SmallBody {
  name: string;
  kind: 'asteroid' | 'comet';
  ra: number;
  dec: number;
  vmag: number | null;
  ra_rate_arcsec_h: number | null;
  dec_rate_arcsec_h: number | null;
  dist_arcsec: number | null;
}

export interface SmallBodiesResponse {
  ra: number;
  dec: number;
  size_deg: number;
  mjd: number;
  count: number;
  bodies: SmallBody[];
}

export async function fetchSmallBodies(
  input: { ra: number; dec: number; size: number; mjd: number },
  signal: AbortSignal,
): Promise<SmallBodiesResponse> {
  const params = new URLSearchParams({
    ra: String(input.ra),
    dec: String(input.dec),
    size: String(input.size),
    mjd: String(input.mjd),
  });
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/solar-system?${params}`, { signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError('No se pudo conectar con la API.', 'network');
  }
  if (!response.ok) {
    const kind = [502, 503, 504].includes(response.status) ? 'busy' : 'http';
    throw new ApiError(`La API respondió con estado ${response.status}.`, kind, response.status);
  }
  return (await response.json()) as SmallBodiesResponse;
}

/**
 * Wakes the API as soon as the page opens: the container scales to zero when idle and takes ~20 s to start,
 * so starting it while the viewer and the tour load hides most of that wait.
 */
export function wakeApi(fetchFn: typeof fetch = fetch): void {
  void fetchFn(`${API_BASE_URL}/health`, { cache: 'no-store' }).catch(() => undefined);
}
