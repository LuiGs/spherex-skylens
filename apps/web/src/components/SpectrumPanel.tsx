import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import type { Equatorial } from '../lib/astro';
import {
  fetchSpectrum,
  fluxRange,
  scale,
  SPECTRAL_FEATURES,
  WAVELENGTH_RANGE,
  type SpectrumResponse,
} from '../lib/spectrum';

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: SpectrumResponse }
  | { status: 'error'; error: ApiError };

const DETECTOR_COLORS = ['#8ab4ff', '#7ee0c3', '#c6e57a', '#ffd166', '#ff9f6e', '#ff6b8b'];
const WIDTH = 320;
const HEIGHT = 190;
const MARGIN = { left: 40, right: 8, top: 18, bottom: 26 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;
const TICKS = [1, 2, 3, 4, 5];

interface Props {
  position: Equatorial;
  label: string | null;
  onClose: () => void;
}

export function SpectrumPanel({ position, label, onClose }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    fetchSpectrum(position, controller.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          error: error instanceof ApiError ? error : new ApiError('No se pudo conectar con la API.', 'network'),
        });
      })
      .finally(() => window.clearInterval(timer));
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [position, attempt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const points = state.status === 'ready' ? state.data.points : [];
  const yRange = fluxRange(points);
  const x = (um: number) => MARGIN.left + scale(um, WAVELENGTH_RANGE, PLOT_W);
  const y = (flux: number) => MARGIN.top + scale(Math.min(yRange[1], Math.max(yRange[0], flux)), yRange, PLOT_H, true);

  return (
    <section className="timelapse spectrum" aria-label="Espectro SPHEREx">
      <header className="timelapse-header">
        <div>
          <h2>Espectro SPHEREx{label ? ` · ${label}` : ''}</h2>
          <p>
            RA {position.ra.toFixed(4)}° Dec {position.dec.toFixed(4)}° · 0.75–5 µm
          </p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar espectro">
          ✕
        </button>
      </header>

      {state.status === 'loading' && (
        <div className="timelapse-message spectrum-message" aria-live="polite" aria-busy="true">
          <div className="spinner" aria-hidden="true" />
          <p>
            Leyendo un píxel de cada foto de SPHEREx… {elapsed} s
            <br />
            <small>Unas 60 imágenes de los 6 detectores; la primera vez tarda ~30 s.</small>
          </p>
        </div>
      )}
      {state.status === 'error' && (
        <div className="timelapse-message spectrum-message">
          <p>
            {state.error.kind === 'busy'
              ? 'IRSA (el archivo de la NASA) está ocupado. Probá de nuevo en unos segundos.'
              : state.error.message}
          </p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Reintentar
          </button>
        </div>
      )}
      {state.status === 'ready' && !points.length && (
        <div className="timelapse-message spectrum-message">
          <p>
            {state.data.n_saturated > state.data.n_images / 2
              ? 'Este objeto es tan brillante que satura el detector de SPHEREx (está pensado para objetos débiles), así que no se puede medir su espectro. Probá con un objeto más tenue.'
              : 'No hay imágenes de SPHEREx utilizables en este punto todavía.'}
          </p>
        </div>
      )}
      {state.status === 'ready' && points.length > 0 && (
        <>
          <svg
            className="spectrum-chart"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-label={`Espectro con ${points.length} mediciones entre 0.75 y 5 micrones`}
          >
            {SPECTRAL_FEATURES.map((feature) => (
              <g key={`${feature.label}-${feature.um}`} className="spectrum-feature">
                <line x1={x(feature.um)} x2={x(feature.um)} y1={MARGIN.top} y2={MARGIN.top + PLOT_H} />
                <text x={x(feature.um)} y={MARGIN.top - 5}>
                  {feature.label}
                </text>
              </g>
            ))}
            <line
              className="spectrum-axis"
              x1={MARGIN.left}
              x2={MARGIN.left + PLOT_W}
              y1={MARGIN.top + PLOT_H}
              y2={MARGIN.top + PLOT_H}
            />
            {yRange[0] < 0 && (
              <line className="spectrum-zero" x1={MARGIN.left} x2={MARGIN.left + PLOT_W} y1={y(0)} y2={y(0)} />
            )}
            {TICKS.map((tick) => (
              <text key={tick} className="spectrum-tick" x={x(tick)} y={HEIGHT - 10}>
                {tick}
              </text>
            ))}
            <text className="spectrum-tick" x={MARGIN.left + PLOT_W} y={HEIGHT - 1} textAnchor="end">
              µm
            </text>
            <text className="spectrum-tick" x={MARGIN.left - 4} y={MARGIN.top + 4} textAnchor="end">
              {yRange[1].toPrecision(2)}
            </text>
            <text className="spectrum-tick" x={MARGIN.left - 4} y={MARGIN.top + 14} textAnchor="end">
              MJy/sr
            </text>
            {points.map((point) => (
              <g key={point.obs_id} fill={DETECTOR_COLORS[point.detector - 1]} stroke={DETECTOR_COLORS[point.detector - 1]}>
                <line x1={x(point.wavelength_um)} x2={x(point.wavelength_um)} y1={y(point.flux - point.error)} y2={y(point.flux + point.error)} strokeOpacity={0.5} />
                <circle cx={x(point.wavelength_um)} cy={y(point.flux)} r={2.4} stroke="none">
                  <title>
                    {point.wavelength_um.toFixed(3)} µm · {point.flux.toFixed(3)} ± {point.error.toFixed(3)} MJy/sr · D
                    {point.detector}
                  </title>
                </circle>
              </g>
            ))}
          </svg>
          <p className="timelapse-caption">
            {points.length} mediciones de {state.data.n_images} imágenes · brillo en MJy/sr sin luz zodiacal ·{' '}
            {state.data.n_available} imágenes disponibles en IRSA
            {state.data.n_saturated > 0 && ` · ${state.data.n_saturated} descartadas por saturación`}
          </p>
          <div className="detector-legend" aria-hidden="true">
            {DETECTOR_COLORS.map((color, index) => (
              <span key={color}>
                <i style={{ background: color }} />D{index + 1}
              </span>
            ))}
          </div>
        </>
      )}
      <p className="timelapse-hint">
        Cada punto es una foto distinta: SPHEREx tiene filtros que cambian de color a lo largo del detector, así que
        cada vez que pasa, el objeto cae en otra longitud de onda. Juntando las fotos se arma el espectro, la “huella
        química” del objeto: las caídas marcan moléculas como agua (H₂O) o metano (CH₄), típicas de enanas marrones.
      </p>
    </section>
  );
}
