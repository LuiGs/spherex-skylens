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
