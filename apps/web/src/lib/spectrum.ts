import { ApiError, API_BASE_URL } from './api';

export interface SpectralPoint {
  wavelength_um: number;
  bandwidth_um: number;
  flux: number;
  error: number;
  detector: number;
  mjd: number;
  obs_id: string;
}

export interface SpectrumResponse {
  ra: number;
  dec: number;
  unit: string;
  n_images: number;
  n_available: number;
  n_saturated: number;
  n_flagged: number;
  points: SpectralPoint[];
}

/** Molecular bands that shape the 0.75-5 µm spectra of cool stars, brown dwarfs and ices. */
export const SPECTRAL_FEATURES = [
  { um: 1.4, label: 'H₂O' },
  { um: 1.9, label: 'H₂O' },
  { um: 3.3, label: 'CH₄' },
  { um: 4.27, label: 'CO₂' },
  { um: 4.65, label: 'CO' },
] as const;

export const WAVELENGTH_RANGE: [number, number] = [0.7, 5.05];

export async function fetchSpectrum(input: { ra: number; dec: number }, signal: AbortSignal): Promise<SpectrumResponse> {
  const params = new URLSearchParams({ ra: input.ra.toFixed(6), dec: input.dec.toFixed(6) });
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/spectrum?${params}`, { signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError('No se pudo conectar con la API.', 'network');
  }
  if (!response.ok) {
    const kind = [502, 503, 504].includes(response.status) ? 'busy' : 'http';
    throw new ApiError(`La API respondió con estado ${response.status}.`, kind, response.status);
  }
  return (await response.json()) as SpectrumResponse;
}

/** Flux axis limits from the 2nd-98th percentiles so a single outlier does not flatten the plot. */
export function fluxRange(points: SpectralPoint[]): [number, number] {
  if (!points.length) return [0, 1];
  const values = points.map((point) => point.flux).sort((a, b) => a - b);
  const pick = (q: number) => values[Math.min(values.length - 1, Math.max(0, Math.round(q * (values.length - 1))))];
  const low = Math.min(0, pick(0.02));
  const high = pick(0.98);
  const pad = (high - low || 1) * 0.08;
  return [low - pad, high + pad];
}

/** Maps a value in [min, max] to [0, size], optionally inverted (SVG y grows downwards). */
export function scale(value: number, [min, max]: [number, number], size: number, invert = false): number {
  const t = (value - min) / (max - min || 1);
  return (invert ? 1 - t : t) * size;
}
