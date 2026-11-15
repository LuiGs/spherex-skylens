import { useEffect, useRef, useState } from 'react';
import A from 'aladin-lite';
import { angularDistance, normalizeDeg, type Equatorial } from '../lib/astro';
import { SPHEREX_HIPS_URL } from '../lib/spherex';
import type { ViewState } from '../lib/urlState';

interface Props {
  view: ViewState;
  showGaia: boolean;
  onViewChange: (patch: Partial<ViewState>) => void;
  targetPosition: Equatorial | null;
  timelapseBox: (Equatorial & { size: number }) | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- aladin-lite ships without types */
export function SkyView({ view, showGaia, onViewChange, targetPosition, timelapseBox }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const aladin = useRef<any>(null);
  const survey = useRef<any>(null);
  const gaia = useRef<any>(null);
  const markerOverlay = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const gaiaQuery = useRef<{ ra: number; dec: number; radius: number } | null>(null);
  const onChange = useRef(onViewChange);
  onChange.current = onViewChange;
  const frame = useRef(view.frame);
  frame.current = view.frame;

  useEffect(() => {
    let cancelled = false;
    A.init.then(() => {
      if (cancelled || !container.current) return;
      const instance = A.aladin(container.current, {
        fov: view.fov,
        target: `${view.ra} ${view.dec}`,
        cooFrame: 'ICRS',
        showReticle: true,
        showCooGrid: false,
        showProjectionControl: false,
        showFrame: false,
        showLayersControl: false,
        showFullscreenControl: false,
      });
      // Aladin ignores setSliceNumber until the survey is loaded, so apply the frame once it is.
      const hips = instance.newImageSurvey(SPHEREX_HIPS_URL, {
        name: 'SPHEREx DR1',
        successCallback: (layer: any) => layer.setSliceNumber?.(frame.current),
      });
      instance.setBaseImageLayer(hips);
      instance.on('positionChanged', ({ ra, dec }: { ra: number; dec: number }) => onChange.current({ ra, dec }));
      instance.on('zoomChanged', (fov: number) => onChange.current({ fov }));
      aladin.current = instance;
      survey.current = hips;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Aladin is created once; later prop changes are pushed imperatively below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = aladin.current;
    if (!instance) return;
    const [ra, dec] = instance.getRaDec();
    if (Math.abs(ra - view.ra) > 1e-6 || Math.abs(dec - view.dec) > 1e-6) instance.gotoRaDec(view.ra, view.dec);
    if (Math.abs(instance.getFov()[0] - view.fov) > 1e-6) instance.setFoV(view.fov);
  }, [view.ra, view.dec, view.fov]);

  useEffect(() => {
    survey.current?.setSliceNumber?.(view.frame);
  }, [view.frame]);

  useEffect(() => {
    const instance = aladin.current;
    if (!instance) return;
    if (markerOverlay.current) {
      instance.removeOverlay(markerOverlay.current);
      markerOverlay.current = null;
    }
    if (!targetPosition) return;

    const color = '#f6ad55';
    const overlay = A.graphicOverlay({ name: 'Posición esperada', color, lineWidth: 2 });
    const ra = targetPosition.ra;
    const dec = targetPosition.dec;
    const halfCrosshairDeg = 3 / 3600;
    const raHalfCrosshairDeg = halfCrosshairDeg / Math.cos((dec * Math.PI) / 180);
    instance.addOverlay(overlay);
    markerOverlay.current = overlay;
    overlay.add(A.circle(ra, dec, 12 / 3600, { color, lineWidth: 2, fill: false }));
    overlay.add(
      A.polyline(
        [
          [normalizeDeg(ra - raHalfCrosshairDeg), dec],
          [normalizeDeg(ra + raHalfCrosshairDeg), dec],
        ],
        { color, lineWidth: 2 },
      ),
    );
    overlay.add(
      A.polyline(
        [
          [ra, dec - halfCrosshairDeg],
          [ra, dec + halfCrosshairDeg],
        ],
        { color, lineWidth: 2 },
      ),
    );
    return () => {
      instance.removeOverlay(overlay);
      if (markerOverlay.current === overlay) markerOverlay.current = null;
    };
  }, [ready, targetPosition]);

  useEffect(() => {
    const instance = aladin.current;
    if (!instance || !timelapseBox) return;
    const { ra, dec, size } = timelapseBox;
    const half = size / 2;
    const raHalf = half / Math.cos((dec * Math.PI) / 180);
    const overlay = A.graphicOverlay({ name: 'Timelapse', color: '#a18cff', lineWidth: 2 });
    instance.addOverlay(overlay);
    overlay.add(
      A.polyline(
        [
          [normalizeDeg(ra - raHalf), dec - half],
          [normalizeDeg(ra + raHalf), dec - half],
          [normalizeDeg(ra + raHalf), dec + half],
          [normalizeDeg(ra - raHalf), dec + half],
          [normalizeDeg(ra - raHalf), dec - half],
        ],
        { color: '#a18cff', lineWidth: 2 },
      ),
    );
    return () => instance.removeOverlay(overlay);
  }, [ready, timelapseBox]);

  useEffect(() => {
    const instance = aladin.current;
    if (!instance) return;
    const clear = () => {
      if (!gaia.current) return;
      instance.removeLayer?.(gaia.current);
      gaia.current = null;
      gaiaQuery.current = null;
    };
    if (!showGaia) {
      clear();
      return;
    }
    const q = gaiaQuery.current;
    if (q && angularDistance(q, { ra: view.ra, dec: view.dec }) <= q.radius / 2) return;
    // Debounced so a continuous pan issues one VizieR query once the view settles.
    const timer = setTimeout(() => {
      clear();
      const radius = Math.min(view.fov, 0.5);
      gaia.current = A.catalogFromVizieR('I/355/gaiadr3', `${view.ra} ${view.dec}`, radius, {
        name: 'Gaia DR3',
        sourceSize: 8,
        color: '#4fd1c5',
        onClick: 'showTable',
      });
      gaiaQuery.current = { ra: view.ra, dec: view.dec, radius };
      instance.addCatalog(gaia.current);
    }, 500);
    return () => clearTimeout(timer);
  }, [showGaia, view.ra, view.dec, view.fov]);

  // Aladin forces `position: relative` on its container, so it needs a sized wrapper.
  return (
    <div className="sky-view" aria-label="SPHEREx sky viewer">
      <div ref={container} className="sky-canvas" />
    </div>
  );
}
