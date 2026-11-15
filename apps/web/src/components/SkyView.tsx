import { useEffect, useRef, useState } from 'react';
import A from 'aladin-lite';
import { angularDistance, normalizeDeg, type Equatorial } from '../lib/astro';
import { GAIA_VIZIER_MIRRORS, gaiaConeUrl, motionArrows } from '../lib/gaia';
import { SPHEREX_HIPS_URL, WISE_HIPS_URL } from '../lib/spherex';
import type { ViewState } from '../lib/urlState';

interface Props {
  view: ViewState;
  showGaia: boolean;
  onViewChange: (patch: Partial<ViewState>) => void;
  targetPosition: Equatorial | null;
  timelapseBox: (Equatorial & { size: number }) | null;
  /** Reports the time span and number of Gaia motion arrows drawn, or null when hidden. */
  onGaiaMotion?: (motion: { years: number; count: number } | null) => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- aladin-lite ships without types */
export function SkyView({ view, showGaia, onViewChange, targetPosition, timelapseBox, onGaiaMotion }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const aladin = useRef<any>(null);
  const survey = useRef<any>(null);
  const gaia = useRef<any>(null);
  const gaiaArrows = useRef<any>(null);
  const onMotion = useRef(onGaiaMotion);
  onMotion.current = onGaiaMotion;
  const wise = useRef<any>(null);
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
    if (view.wise <= 0) {
      if (wise.current) instance.removeImageLayer?.('wise');
      wise.current = null;
      return;
    }
    if (!wise.current) {
      wise.current = instance.newImageSurvey(WISE_HIPS_URL, { name: 'AllWISE' });
      instance.setOverlayImageLayer(wise.current, 'wise');
    }
    wise.current.setOpacity?.(view.wise);
  }, [ready, view.wise]);

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
      if (gaiaArrows.current) instance.removeOverlay(gaiaArrows.current);
      gaiaArrows.current = null;
      if (!gaia.current) return;
      instance.removeLayer?.(gaia.current);
      gaia.current = null;
      gaiaQuery.current = null;
      onMotion.current?.(null);
    };
    const drawMotion = (catalog: any, fov: number) => {
      const stars = (catalog.getSources?.() ?? []).map((s: any) => ({
        ra: s.ra,
        dec: s.dec,
        pmRA: Number(s.data?.pmRA),
        pmDE: Number(s.data?.pmDE),
      }));
      const { years, arrows } = motionArrows(stars, fov);
      const style = { color: '#f687b3', lineWidth: 1.5 };
      const overlay = A.graphicOverlay({ name: 'Gaia DR3 motion', ...style });
      instance.addOverlay(overlay);
      for (const { from, to, head } of arrows) {
        overlay.add(
          A.polyline(
            [
              [from.ra, from.dec],
              [to.ra, to.dec],
            ],
            style,
          ),
        );
        overlay.add(
          A.polyline(
            [
              [head[0].ra, head[0].dec],
              [to.ra, to.dec],
              [head[1].ra, head[1].dec],
            ],
            style,
          ),
        );
      }
      gaiaArrows.current = overlay;
      onMotion.current?.({ years, count: arrows.length });
    };
    const load = (ra: number, dec: number, radius: number, fov: number, mirror: number) => {
      const catalog = A.catalogFromURL(
        gaiaConeUrl(ra, dec, radius, mirror),
        { name: 'Gaia DR3', sourceSize: 8, color: '#4fd1c5', onClick: 'showTable' },
        (loaded: any) => {
          if (gaia.current !== catalog) return;
          // A mirror that lost its database answers 200 with an empty table.
          if (loaded.getSources?.().length === 0 && mirror + 1 < GAIA_VIZIER_MIRRORS.length) {
            instance.removeLayer?.(catalog);
            load(ra, dec, radius, fov, mirror + 1);
            return;
          }
          drawMotion(loaded, fov);
        },
        () => {
          if (gaia.current !== catalog) return;
          instance.removeLayer?.(catalog);
          if (mirror + 1 < GAIA_VIZIER_MIRRORS.length) load(ra, dec, radius, fov, mirror + 1);
          else onMotion.current?.(null);
        },
        false,
      );
      gaia.current = catalog;
      instance.addCatalog(catalog);
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
      const radius = Math.min(view.fov * 0.6, 0.5);
      load(view.ra, view.dec, radius, view.fov, 0);
      gaiaQuery.current = { ra: view.ra, dec: view.dec, radius };
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
