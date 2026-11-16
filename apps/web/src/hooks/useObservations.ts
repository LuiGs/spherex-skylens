import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchObservations, type ObservationsResponse } from '../lib/api';
import { groupEpochs, type Epoch } from '../lib/epochs';

const SIZE_STEPS_DEG = [0.05, 0.1, 0.2, 0.5, 1];

/** Snaps the request to a few sizes and ~0.4" in position so small pans and zooms reuse the API cache. */
export function observationsRequest(ra: number, dec: number, fov: number) {
  const size = SIZE_STEPS_DEG.find((step) => fov <= step) ?? 1;
  return { ra: Number(ra.toFixed(4)), dec: Number(dec.toFixed(4)), size };
}

export type ObservationsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: ObservationsResponse; epochs: Epoch[] }
  | { status: 'empty' }
  | { status: 'error'; error: ApiError };

export function useObservations(centerRa: number, centerDec: number, fov: number) {
  const { ra, dec, size } = observationsRequest(centerRa, centerDec, fov);
  const [state, setState] = useState<ObservationsState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setState({ status: 'loading' });
      void fetchObservations({ ra, dec, size }, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          setState(
            data.observations.length
              ? { status: 'ready', data, epochs: groupEpochs(data.observations) }
              : { status: 'empty' },
          );
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
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
  }, [ra, dec, size, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, retry };
}
