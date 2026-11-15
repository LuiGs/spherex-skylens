import { SPHEREX_CUBE_DEPTH } from './spherex';

export interface ViewState {
  ra: number;
  dec: number;
  fov: number;
  frame: number;
  target: string | null;
}

export const DEFAULT_VIEW: ViewState = { ra: 133.795129, dec: -7.245147, fov: 1, frame: 40, target: null };

const num = (v: string | null, fallback: number) => {
  if (v === null || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const wrap360 = (v: number) => (v >= 0 && v < 360 ? v : ((v % 360) + 360) % 360);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function readViewState(search: string): ViewState {
  const p = new URLSearchParams(search);
  return {
    ra: wrap360(num(p.get('ra'), DEFAULT_VIEW.ra)),
    dec: clamp(num(p.get('dec'), DEFAULT_VIEW.dec), -90, 90),
    fov: clamp(num(p.get('fov'), DEFAULT_VIEW.fov), 1e-4, 180),
    frame: clamp(Math.round(num(p.get('frame'), DEFAULT_VIEW.frame)), 0, SPHEREX_CUBE_DEPTH - 1),
    target: p.get('target') || null,
  };
}

export function writeViewState(state: ViewState): string {
  const p = new URLSearchParams({
    ra: state.ra.toFixed(6),
    dec: state.dec.toFixed(6),
    fov: state.fov.toFixed(4),
    frame: String(state.frame),
  });
  if (state.target) p.set('target', state.target);
  return `?${p.toString()}`;
}
