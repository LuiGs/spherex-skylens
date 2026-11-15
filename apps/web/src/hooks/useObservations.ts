import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchObservations, type ObservationsResponse } from '../lib/api';
import { groupEpochs, type Epoch } from '../lib/epochs';

export type ObservationsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: ObservationsResponse; epochs: Epoch[] }
  | { status: 'empty' }
  | { status: 'error'; error: ApiError };

export function useObservations(ra: number, dec: number, fov: number) {
  const [state, setState] = useState<ObservationsState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setState({ status: 'loading' });
      void fetchObservations({ ra, dec, size: Math.min(fov, 1) }, controller.signal)
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
  }, [ra, dec, fov, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, retry };
}
