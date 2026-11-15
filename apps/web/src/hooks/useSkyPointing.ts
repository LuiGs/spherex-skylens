import { useCallback, useEffect, useRef, useState } from 'react';
import { deviceOrientationToHorizontal, horizontalToEquatorial, smoothPointing, type Equatorial } from '../lib/astro';

// Weight of each new sensor reading; lower is steadier but laggier.
const SMOOTHING = 0.2;

type Status = 'idle' | 'requesting' | 'active' | 'unsupported' | 'denied';

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
  const callback = useRef(onPointing);
  callback.current = onPointing;

  const handle = useCallback((e: OrientationEventWithCompass) => {
    if (e.beta === null || e.gamma === null || !location.current) return;
    const alpha = e.webkitCompassHeading !== undefined ? 360 - e.webkitCompassHeading : e.alpha;
    if (alpha === null) return;
    const horizontal = deviceOrientationToHorizontal(alpha, e.beta, e.gamma);
    const pointing = horizontalToEquatorial(horizontal, location.current.lat, location.current.lon, new Date());
    smoothed.current = smoothPointing(smoothed.current, pointing, SMOOTHING);
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
    setStatus('idle');
  }, [handle]);

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

  return { status, start, stop };
}
