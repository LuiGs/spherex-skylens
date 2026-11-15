import { useEffect, useRef, useState } from 'react';
import { ApiError, fetchSmallBodies, type SmallBody } from '../lib/api';
import { needsNewQuery, SOLAR_SYSTEM_FIELD_DEG, type SolarSystemQuery } from '../lib/solarSystem';

export type SmallBodiesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; bodies: SmallBody[]; mjd: number }
  | { status: 'error'; error: ApiError };

export function useSmallBodies(enabled: boolean, ra: number, dec: number, mjd: number): SmallBodiesState {
  const [state, setState] = useState<SmallBodiesState>({ status: 'idle' });
  const query = useRef<SolarSystemQuery | null>(null);

  useEffect(() => {
    if (!enabled) {
      query.current = null;
      setState({ status: 'idle' });
      return;
    }
    const next = { ra, dec, mjd };
    if (!needsNewQuery(query.current, next)) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      query.current = next;
      setState({ status: 'loading' });
      void fetchSmallBodies({ ra, dec, size: SOLAR_SYSTEM_FIELD_DEG, mjd }, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          setState({ status: 'ready', bodies: data.bodies, mjd: data.mjd });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
          query.current = null;
          setState({
            status: 'error',
            error: error instanceof ApiError ? error : new ApiError('No se pudo conectar con la API.', 'network'),
          });
        });
    }, 600);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [enabled, ra, dec, mjd]);

  return state;
}
