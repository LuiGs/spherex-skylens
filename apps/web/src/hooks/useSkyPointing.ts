import { useCallback, useEffect, useRef, useState } from 'react';
import {
  angularSeparation,
  deviceOrientationToHorizontal,
  horizontalToEquatorial,
  smoothPointing,
  type Equatorial,
} from '../lib/astro';

// Hand tremor is a fraction of a degree; ignore it so the sky does not jitter.
const DEAD_ZONE_DEG = 0.4;
// Small movements are damped hard (steady), big sweeps follow almost immediately.
const MIN_SMOOTHING = 0.06;
const MAX_SMOOTHING = 0.5;
const FULL_SPEED_DEG = 15;

type Status = 'idle' | 'requesting' | 'active' | 'held' | 'unsupported' | 'denied';

function adaptiveSmoothing(distanceDeg: number): number {
  const t = Math.min(distanceDeg / FULL_SPEED_DEG, 1);
  return MIN_SMOOTHING + (MAX_SMOOTHING - MIN_SMOOTHING) * t * t;
}

interface OrientationEventWithCompass extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface PermissionAwareOrientation {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

/**
 * "Point your phone at the sky" mode: combines device orientation, geolocation and time
 * into the RA/Dec the back camera is pointing at.
 */
export function useSkyPointing(onPointing: (p: Equatorial) => void) {
  const [status, setStatus] = useState<Status>('idle');
  const location = useRef<{ lat: number; lon: number } | null>(null);
  const smoothed = useRef<Equatorial | null>(null);
  const frame = useRef<number | null>(null);
  const held = useRef(false);
  const callback = useRef(onPointing);
  callback.current = onPointing;

  const handle = useCallback((e: OrientationEventWithCompass) => {
    if (held.current || e.beta === null || e.gamma === null || !location.current) return;
    const alpha = e.webkitCompassHeading !== undefined ? 360 - e.webkitCompassHeading : e.alpha;
    if (alpha === null) return;
    const horizontal = deviceOrientationToHorizontal(alpha, e.beta, e.gamma);
    const pointing = horizontalToEquatorial(horizontal, location.current.lat, location.current.lon, new Date());
    if (smoothed.current) {
      const distance = angularSeparation(smoothed.current, pointing);
      if (distance < DEAD_ZONE_DEG) return;
      smoothed.current = smoothPointing(smoothed.current, pointing, adaptiveSmoothing(distance));
    } else {
      smoothed.current = pointing;
    }
    // Sensors fire faster than the screen refreshes; push at most one update per frame.
    if (frame.current === null)
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        if (smoothed.current) callback.current(smoothed.current);
      });
  }, []);

  const stop = useCallback(() => {
    window.removeEventListener('deviceorientationabsolute', handle as EventListener);
    window.removeEventListener('deviceorientation', handle as EventListener);
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
    smoothed.current = null;
    held.current = false;
    setStatus('idle');
  }, [handle]);

  /** Freeze the view where the phone points now, so the user can zoom in and explore. */
  const toggleHold = useCallback(() => {
    held.current = !held.current;
    if (!held.current) smoothed.current = null;
    setStatus(held.current ? 'held' : 'active');
  }, []);

  const start = useCallback(async () => {
    if (!('DeviceOrientationEvent' in window) || !navigator.geolocation) {
      setStatus('unsupported');
      return;
    }
    setStatus('requesting');
    const Orientation = DeviceOrientationEvent as unknown as PermissionAwareOrientation;
    if (typeof Orientation.requestPermission === 'function') {
      const result = await Orientation.requestPermission().catch(() => 'denied' as const);
      if (result !== 'granted') {
        setStatus('denied');
        return;
      }
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        location.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
        window.addEventListener(eventName, handle as EventListener);
        setStatus('active');
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, [handle]);

  useEffect(() => stop, [stop]);

  return { status, start, stop, toggleHold };
}
