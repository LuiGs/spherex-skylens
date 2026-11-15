import { useEffect, useRef, useState } from 'react';
import A from 'aladin-lite';
import { angularDistance, normalizeDeg, type Equatorial } from '../lib/astro';
import { createNavigationGrid } from '../lib/navigationGrid';
import { MAX_FOV, MIN_FOV } from '../lib/projection';
import { SPHEREX_HIPS_URL } from '../lib/spherex';
import type { ViewState } from '../lib/urlState';

interface Props {
  view: ViewState;
  showGaia: boolean;
  onViewChange: (patch: Partial<ViewState>) => void;
  targetPosition: Equatorial | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- aladin-lite ships without types */
export function SkyView({ view, showGaia, onViewChange, targetPosition }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const aladin = useRef<any>(null);
  const survey = useRef<any>(null);
  const gaia = useRef<any>(null);
  const markerOverlay = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const gaiaQuery = useRef<{ ra: number; dec: number; radius: number } | null>(null);
  const onChange = useRef(onViewChange);
  onChange.current = onViewChange;
  const latestView = useRef(view);
  latestView.current = view;

  useEffect(() => {
    let cancelled = false;
    let cleanupNavigation: (() => void) | undefined;
    A.init.then(() => {
      if (cancelled || !container.current) return;
      const element = container.current;
      const initialView = latestView.current;
      const instance = A.aladin(container.current, {
        fov: initialView.fov,
        target: `${initialView.ra} ${initialView.dec}`,
        projection: initialView.projection,
        cooFrame: 'ICRS',
        showReticle: true,
        showCooGrid: false,
        gridOpacity: 0,
        gridOptions: { enabled: false, color: '#8bbcff', opacity: 0, thickness: 1, labelSize: 12, showLabels: true },
        showProjectionControl: false,
        showFrame: false,
        showLayersControl: false,
        showFullscreenControl: false,
      });
      // Aladin ignores setSliceNumber until the survey is loaded, so apply the frame once it is.
      const hips = instance.newImageSurvey(SPHEREX_HIPS_URL, {
        name: 'SPHEREx DR1',
        successCallback: (layer: any) => layer.setSliceNumber?.(latestView.current.frame),
      });
      instance.setBaseImageLayer(hips);
      const grid = createNavigationGrid((options) => instance.setCooGrid(options));
      const drag = (event: PointerEvent) => {
        if (event.buttons || event.pointerType === 'touch') grid.show();
      };
      element.addEventListener('pointerdown', grid.show, { capture: true, passive: true });
      element.addEventListener('pointermove', drag, { capture: true, passive: true });
      element.addEventListener('wheel', grid.show, { capture: true, passive: true });
      instance.on('positionChanged', ({ ra, dec }: { ra: number; dec: number }) => {
        grid.show();
        onChange.current({ ra, dec });
      });
      instance.on('zoomChanged', (fov: number) => {
        grid.show();
        onChange.current({ fov });
      });
      instance.on('rotationChanged', grid.show);
      instance.on('projectionChanged', grid.show);
      cleanupNavigation = () => {
        grid.dispose();
        element.removeEventListener('pointerdown', grid.show, true);
        element.removeEventListener('pointermove', drag, true);
        element.removeEventListener('wheel', grid.show, true);
        for (const event of ['positionChanged', 'zoomChanged', 'rotationChanged', 'projectionChanged']) {
          instance.on(event, undefined);
        }
      };
      aladin.current = instance;
      survey.current = hips;
      grid.show();
      setReady(true);
    });
    return () => {
      cancelled = true;
      cleanupNavigation?.();
    };
    // Aladin is created once; later prop changes are pushed imperatively below.
  }, []);

  useEffect(() => {
    if (!ready) return;
    const instance = aladin.current;
    instance.setProjection(view.projection);
    instance.setFoVRange(MIN_FOV, MAX_FOV[view.projection]);
  }, [ready, view.projection]);

  useEffect(() => {
    const instance = aladin.current;
    if (!instance) return;
    const [ra, dec] = instance.getRaDec();
    if (Math.abs(ra - view.ra) > 1e-6 || Math.abs(dec - view.dec) > 1e-6) instance.gotoRaDec(view.ra, view.dec);
    if (Math.abs(instance.getFov()[0] - view.fov) > 1e-6) instance.setFoV(view.fov);
  }, [ready, view.ra, view.dec, view.fov]);

  useEffect(() => {
    survey.current?.setSliceNumber?.(view.frame);
  }, [ready, view.frame]);

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
  }, [ready, showGaia, view.ra, view.dec, view.fov]);

  // Aladin forces `position: relative` on its container, so it needs a sized wrapper.
  return (
    <div className="sky-view" aria-label="SPHEREx sky viewer">
      <div ref={container} className="sky-canvas" />
    </div>
  );
}
