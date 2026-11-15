import metadata from '../../../api/src/skylens_api/spherex_channels.json';

/** SPHEREx DR1 all-sky HiPS cube served by NASA/IPAC IRSA (102 spectral frames, CORS enabled). */
export const SPHEREX_HIPS_URL = 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube';
export const SPHEREX_CUBE_DEPTH = 102;
export const CHANNELS_PER_BAND = 17;
// All generated surveys use the same PNG HiPS grid; only their tile URLs change.
export const SPECTRAL_HIPS_OPTIONS = { maxOrder: 5, minOrder: 0, cooFrame: 'ICRS', imgFormat: 'png', tileSize: 512 };
export const WAVELENGTHS = metadata.wavelengths_um;
export const CHANNELS = WAVELENGTHS.map((wavelength, frame) => ({
  frame, wavelength, band: Math.floor(frame / 17) + 1, channel: frame % 17 + 1,
  available: !metadata.blank_frames.includes(frame),
}));

export function nearestChannel(wavelength: number): number {
  return CHANNELS.filter((c) => c.available).reduce((best, c) =>
    Math.abs(c.wavelength - wavelength) < Math.abs(WAVELENGTHS[best] - wavelength) ? c.frame : best, 0);
}

export function channelColor(frame: number, low: number, high: number): string {
  const span = WAVELENGTHS[high] - WAVELENGTHS[low];
  const t = span ? (WAVELENGTHS[frame] - WAVELENGTHS[low]) / span : 0.5;
  return `rgb(${Math.round(255 * Math.max(0, 2 * t - 1))}, ${Math.round(255 * (1 - Math.abs(2 * t - 1)))}, ${Math.round(255 * Math.max(0, 1 - 2 * t))})`;
}

export function spectralSurveyUrl(view: { spectralMode: 'mono' | 'color'; frame: number; minFrame: number; maxFrame: number }): string {
  const low = view.spectralMode === 'color' ? view.minFrame : view.frame;
  const high = view.spectralMode === 'color' ? view.maxFrame : view.frame;
  return new URL(`/api/v1/spectral/hips/${view.spectralMode}/${low}/${high}`, import.meta.env.VITE_API_URL || window.location.origin).href;
}

/** Detector bands D1..D6 wavelength ranges in microns (IRSA mission page). */
export const SPHEREX_BANDS = [
  { id: 1, min: 0.75, max: 1.1 },
  { id: 2, min: 1.1, max: 1.6 },
  { id: 3, min: 1.6, max: 2.4 },
  { id: 4, min: 2.4, max: 3.8 },
  { id: 5, min: 3.8, max: 4.4 },
  { id: 6, min: 4.4, max: 5.0 },
] as const;

/** frame index = 17*(band-1) + (channel-1), per the HiPS `obs_description`. */
export function frameToBandChannel(frame: number): { band: number; channel: number } {
  return { band: Math.floor(frame / CHANNELS_PER_BAND) + 1, channel: (frame % CHANNELS_PER_BAND) + 1 };
}

export function approxWavelength(frame: number): number {
  return WAVELENGTHS[frame];
}
