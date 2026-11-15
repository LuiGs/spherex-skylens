export type SkyProjection = 'SIN' | 'TAN';

export const MIN_FOV = 1e-4;
// A perspective view must stay below 180 degrees, where TAN becomes singular.
export const MAX_FOV: Record<SkyProjection, number> = { SIN: 180, TAN: 170 };

export function clampFov(fov: number, projection: SkyProjection): number {
  return Math.min(MAX_FOV[projection], Math.max(MIN_FOV, fov));
}
