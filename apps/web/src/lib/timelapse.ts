import { ApiError, API_BASE_URL } from './api';
import type { Equatorial } from './astro';

export interface TimelapseEpoch {
  index: number;
  mjd_start: number;
  mjd_end: number;
  mjd_mid: number;
  n_images: number;
  n_available: number;
  detectors: number[];
  frame_url: string;
}

export interface TimelapseResponse {
  ra: number;
  dec: number;
  size_deg: number;
  detector: number | null;
  collections: string[];
  pixel_scale_arcsec: number;
  width: number;
  height: number;
  stretch: { kind: string; vmin: number; vmax: number };
  epochs: TimelapseEpoch[];
}

export type TimelapseMode = 'play' | 'blink' | 'diff';

/** Cutout sizes offered to the user; bigger cutouts take longer for IRSA to serve. */
export const TIMELAPSE_SIZES = [
  { deg: 0.03, label: 'Chico', seconds: 30 },
  { deg: 0.06, label: 'Medio', seconds: 45 },
  { deg: 0.1, label: 'Grande', seconds: 70 },
] as const;

export function defaultTimelapseSize(fov: number): number {
  const fitting = TIMELAPSE_SIZES.filter((size) => size.deg <= fov);
  return (fitting[fitting.length - 1] ?? TIMELAPSE_SIZES[0]).deg;
}

export async function fetchTimelapse(
  input: { ra: number; dec: number; size: number; detector: number | null },
  signal: AbortSignal,
): Promise<TimelapseResponse> {
  const params = new URLSearchParams({
    ra: input.ra.toFixed(6),
    dec: input.dec.toFixed(6),
    size: String(input.size),
  });
  if (input.detector) params.set('detector', String(input.detector));
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/timelapse?${params}`, { signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError('No se pudo conectar con la API.', 'network');
  }
  if (!response.ok) {
    const kind = [502, 503, 504].includes(response.status) ? 'busy' : 'http';
    throw new ApiError(`La API respondió con estado ${response.status}.`, kind, response.status);
  }
  return (await response.json()) as TimelapseResponse;
}

export function frameSrc(epoch: TimelapseEpoch): string {
  return `${API_BASE_URL}${epoch.frame_url}`;
}

/** Index of the frame shown after `current`, for each playback mode. */
export function nextFrame(current: number, count: number, mode: TimelapseMode, blinkPair: [number, number]): number {
  if (count <= 0) return 0;
  if (mode === 'blink') return current === blinkPair[0] ? blinkPair[1] : blinkPair[0];
  return (current + 1) % count;
}

/** Fractional pixel position (0..1, origin top-left, north up, east left) of a sky position in a TAN cutout. */
export function skyToFrame(position: Equatorial, center: Equatorial, sizeDeg: number): { x: number; y: number } {
  const rad = Math.PI / 180;
  const dRa = ((((position.ra - center.ra) % 360) + 540) % 360) - 180;
  const ra = dRa * rad;
  const dec = position.dec * rad;
  const dec0 = center.dec * rad;
  const cosc = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(ra);
  const xi = (Math.cos(dec) * Math.sin(ra)) / cosc / rad;
  const eta = (Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(ra)) / cosc / rad;
  return { x: 0.5 - xi / sizeDeg, y: 0.5 - eta / sizeDeg };
}

/**
 * Signed difference of two frames rendered with the same stretch: grey = no change,
 * bright = only in `b` (where the object is now), dark = only in `a` (where it was).
 */
export function differencePixels(a: Uint8ClampedArray, b: Uint8ClampedArray, gain = 2): Uint8ClampedArray {
  const out = new Uint8ClampedArray(a.length);
  for (let i = 0; i < a.length; i += 4) {
    const value = 128 + (b[i] - a[i]) * gain;
    out[i] = out[i + 1] = out[i + 2] = value;
    out[i + 3] = 255;
  }
  return out;
}
