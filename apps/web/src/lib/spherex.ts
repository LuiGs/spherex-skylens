/** SPHEREx DR1 all-sky HiPS cube served by NASA/IPAC IRSA (102 spectral frames, CORS enabled). */
export const SPHEREX_HIPS_URL = 'https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube';
export const SPHEREX_CUBE_DEPTH = 102;
export const CHANNELS_PER_BAND = 17;

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
  const { band, channel } = frameToBandChannel(frame);
  const b = SPHEREX_BANDS[band - 1];
  return b.min + ((channel - 0.5) / CHANNELS_PER_BAND) * (b.max - b.min);
}
