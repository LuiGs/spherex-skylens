import { useEffect, useState } from 'react';
import type { Equatorial } from '../lib/astro';
import { identifyAt, pickRadiusDeg, type IdentifiedObject } from '../lib/simbad';

export type SkyPickState =
  | { status: 'loading' }
  | { status: 'ready'; object: IdentifiedObject | null; radiusDeg: number }
  | { status: 'error' };

/** Asks SIMBAD what sits where the user tapped; the radius scales with the current zoom. */
export function useSkyPick(pick: Equatorial | null, fovDeg: number): SkyPickState | null {
  const [state, setState] = useState<SkyPickState | null>(null);

  useEffect(() => {
    if (!pick) {
      setState(null);
      return;
    }
    const controller = new AbortController();
    const radiusDeg = pickRadiusDeg(fovDeg);
    setState({ status: 'loading' });
    identifyAt(pick, radiusDeg, controller.signal)
      .then((object) => setState({ status: 'ready', object, radiusDeg }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
    // The radius is frozen when the tap happens; zooming afterwards must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);

  return state;
}
