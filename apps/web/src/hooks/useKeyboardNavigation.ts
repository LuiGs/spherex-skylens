import { useEffect, useRef } from 'react';
import { normalizeDeg } from '../lib/astro';
import type { ViewState } from '../lib/urlState';

const PAN_FRACTION = 0.15;
const ZOOM_STEP = 1.4;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

/** Pans by a fraction of the field of view in the direction of `key`, or zooms; null for unrelated keys. */
export function keyToViewPatch(key: string, view: ViewState, allowArrows: boolean): Partial<ViewState> | null {
  const step = view.fov * PAN_FRACTION;
  const raStep = step / Math.max(0.05, Math.cos((view.dec * Math.PI) / 180));
  const lower = key.toLowerCase();
  const arrow = allowArrows ? key : '';
  if (lower === 'w' || arrow === 'ArrowUp') return { dec: Math.min(90, view.dec + step) };
  if (lower === 's' || arrow === 'ArrowDown') return { dec: Math.max(-90, view.dec - step) };
  // East is to the left on the sky, so "left" increases right ascension.
  if (lower === 'a' || arrow === 'ArrowLeft') return { ra: normalizeDeg(view.ra + raStep) };
  if (lower === 'd' || arrow === 'ArrowRight') return { ra: normalizeDeg(view.ra - raStep) };
  if (key === '+' || key === '=' || lower === 'e') return { fov: Math.max(1e-3, view.fov / ZOOM_STEP) };
  if (key === '-' || key === '_' || lower === 'q') return { fov: Math.min(180, view.fov * ZOOM_STEP) };
  return null;
}

export function useKeyboardNavigation(
  view: ViewState,
  onChange: (patch: Partial<ViewState>) => void,
  { allowArrows, enabled }: { allowArrows: boolean; enabled: boolean },
) {
  const latest = useRef({ view, onChange, allowArrows });
  latest.current = { view, onChange, allowArrows };

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      const patch = keyToViewPatch(event.key, latest.current.view, latest.current.allowArrows);
      if (!patch) return;
      event.preventDefault();
      latest.current.onChange(patch);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
