import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { fetchTimelapse, frameSrc, type TimelapseResponse } from '../lib/timelapse';

export type TimelapseState =
  | { status: 'loading' }
  | { status: 'ready'; data: TimelapseResponse; frames: HTMLImageElement[] }
  | { status: 'empty' }
  | { status: 'error'; error: ApiError };

function loadFrame(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Needed so the difference mode can read pixels back from a canvas.
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new ApiError('No se pudo cargar un frame del timelapse.', 'network'));
    image.src = src;
  });
}

export function useTimelapse(ra: number, dec: number, size: number, detector: number | null) {
  const [state, setState] = useState<TimelapseState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchTimelapse({ ra, dec, size, detector }, controller.signal)
      .then(async (data) => {
        if (!data.epochs.length) return setState({ status: 'empty' });
        const frames = await Promise.all(data.epochs.map((epoch) => loadFrame(frameSrc(epoch))));
        if (!controller.signal.aborted) setState({ status: 'ready', data, frames });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
        setState({
          status: 'error',
          error: error instanceof ApiError ? error : new ApiError('No se pudo conectar con la API.', 'network'),
        });
      });
    return () => controller.abort();
  }, [ra, dec, size, detector, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, retry };
}
