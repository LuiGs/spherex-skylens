import { useEffect, useMemo, useRef, useState } from 'react';
import type { Target } from '../data/targets';
import { useTimelapse } from '../hooks/useTimelapse';
import { predictPosition, type Equatorial } from '../lib/astro';
import { formatEpochRange } from '../lib/epochs';
import { useI18n } from '../lib/i18n';
import { differencePixels, nextFrame, skyToFrame, TIMELAPSE_SIZES, type TimelapseMode } from '../lib/timelapse';

interface Props {
  center: Equatorial;
  size: number;
  onSizeChange: (size: number) => void;
  detector: number | null;
  onDetectorChange: (detector: number | null) => void;
  target: Target | null;
  onClose: () => void;
}

const MODE_KEYS: TimelapseMode[] = ['play', 'blink', 'diff'];
const SPEEDS = [0.5, 1, 2, 4];

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return target.type !== 'range';
  return target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || target.isContentEditable;
}

export function TimelapsePlayer({ center, size, onSizeChange, detector, onDetectorChange, target, onClose }: Props) {
  const { t } = useI18n();
  const tl = t.timelapse;
  const { state, retry } = useTimelapse(center.ra, center.dec, size, detector);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState<TimelapseMode>('play');
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [diffError, setDiffError] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  const count = state.status === 'ready' ? state.frames.length : 0;
  const blinkPair: [number, number] = [0, Math.max(0, count - 1)];
  const sizeInfo = TIMELAPSE_SIZES.find((option) => option.deg === size) ?? TIMELAPSE_SIZES[0];

  useEffect(() => {
    setIndex(0);
    if (state.status !== 'loading') return;
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state.status]);

  useEffect(() => {
    if (!playing || mode === 'diff' || count < 2) return;
    const pair: [number, number] = [0, count - 1];
    const timer = window.setInterval(() => setIndex((current) => nextFrame(current, count, mode, pair)), 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, mode, count, speed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onClose();
      if (isTyping(event.target) || count === 0) return;
      if (event.key === ' ') {
        event.preventDefault();
        setPlaying((value) => !value);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        setPlaying(false);
        setIndex((current) => (current + (event.key === 'ArrowRight' ? 1 : count - 1)) % count);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, onClose]);

  useEffect(() => {
    if (mode !== 'diff' || state.status !== 'ready' || !canvas.current) return;
    const { width, height } = state.data;
    const scratch = document.createElement('canvas');
    scratch.width = width;
    scratch.height = height;
    const context = scratch.getContext('2d', { willReadFrequently: true });
    const output = canvas.current.getContext('2d');
    if (!context || !output) return;
    try {
      const read = (image: HTMLImageElement) => {
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        return context.getImageData(0, 0, width, height).data;
      };
      const first = read(state.frames[0]);
      const last = read(state.frames[state.frames.length - 1]);
      output.putImageData(new ImageData(differencePixels(first, last), width, height), 0, 0);
      setDiffError(false);
    } catch {
      setDiffError(true);
    }
  }, [mode, state]);

  const markers = useMemo(() => {
    if (!target || state.status !== 'ready') return [];
    return state.data.epochs.map((epoch) => skyToFrame(predictPosition(target, epoch.mjd_mid), center, size));
  }, [target, state, center, size]);

  const shown = mode === 'diff' ? blinkPair[1] : index;
  const epoch = state.status === 'ready' ? state.data.epochs[shown] : null;
  const visibleMarkers = mode === 'diff' ? [blinkPair[0], blinkPair[1]] : [shown];

  return (
    <section className="timelapse" aria-label={tl.title}>
      <header className="timelapse-header">
        <div>
          <h2>{tl.title}</h2>
          <p>
            {tl.sizes[size] ?? sizeInfo.label} · {Math.round(size * 3600)}″ {tl.side} · RA {center.ra.toFixed(4)}° Dec {center.dec.toFixed(4)}°
          </p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={tl.close}>
          ✕
        </button>
      </header>

      <div className="timelapse-stage">
        {state.status === 'loading' && (
          <div className="timelapse-message" aria-live="polite" aria-busy="true">
            <div className="spinner" aria-hidden="true" />
            <p>
              {tl.loading(elapsed)}
              <br />
              <small>{tl.loadingHint(sizeInfo.seconds)}</small>
            </p>
          </div>
        )}
        {state.status === 'empty' && (
          <div className="timelapse-message">
            <p>{tl.empty}</p>
          </div>
        )}
        {state.status === 'error' && (
          <div className="timelapse-message">
            <p>
              {state.error.kind === 'busy'
                ? t.errors.busy
                : state.error.status
                  ? t.errors.http(state.error.status)
                  : t.errors.network}
            </p>
            <button type="button" onClick={retry}>
              {t.errors.retry}
            </button>
          </div>
        )}
        {state.status === 'ready' && (
          <>
            {mode === 'diff' ? (
              <canvas ref={canvas} width={state.data.width} height={state.data.height} aria-label={tl.modes.diff.label} />
            ) : (
              <img src={state.frames[shown].src} alt={tl.epochOf(shown + 1, count)} />
            )}
            <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
              {markers.length > 1 && (
                <polyline points={markers.map((m) => `${m.x},${m.y}`).join(' ')} className="timelapse-trail" />
              )}
              {markers.map((marker, i) =>
                visibleMarkers.includes(i) ? (
                  <circle key={i} cx={marker.x} cy={marker.y} r={0.06} className="timelapse-marker" />
                ) : null,
              )}
              <path d="M0.5 0.44V0.47M0.5 0.53V0.56M0.44 0.5H0.47M0.53 0.5H0.56" className="timelapse-center" />
            </svg>
            {diffError && mode === 'diff' && (
              <p className="timelapse-badge error">{tl.diffError}</p>
            )}
            <span className="timelapse-compass" aria-hidden="true">
              {tl.compass}
            </span>
          </>
        )}
      </div>

      {epoch && (
        <p className="timelapse-caption" aria-live="polite">
          <strong>
            {mode === 'diff' ? tl.lastMinusFirst : tl.epochOf(shown + 1, count)}
          </strong>{' '}
          · {formatEpochRange(epoch.mjd_start, epoch.mjd_end, t.locale)} · {tl.images(epoch.n_images)} (
          {epoch.detectors.map((d) => `D${d}`).join(' ')})
        </p>
      )}

      {state.status === 'ready' && (
        <>
          <div className="timelapse-transport">
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              disabled={mode === 'diff' || count < 2}
              aria-label={playing ? tl.pause : tl.play}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, count - 1)}
              value={shown}
              disabled={mode !== 'play'}
              aria-label={tl.epoch}
              onChange={(e) => {
                setPlaying(false);
                setIndex(Number(e.target.value));
              }}
            />
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label={tl.speed}>
              {SPEEDS.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </div>
          <div className="segmented" role="radiogroup" aria-label={tl.modeLabel}>
            {MODE_KEYS.map((key) => (
              ({ key, ...tl.modes[key] })
            )).map((option) => (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={mode === option.key}
                title={option.hint}
                disabled={option.key !== 'play' && count < 2}
                onClick={() => {
                  setMode(option.key);
                  setPlaying(option.key !== 'diff');
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="timelapse-hint">{tl.modes[mode].hint}</p>
        </>
      )}

      <div className="timelapse-options">
        <label>
          {tl.cutout}
          <select value={size} onChange={(e) => onSizeChange(Number(e.target.value))}>
            {TIMELAPSE_SIZES.map((option) => (
              <option key={option.deg} value={option.deg}>
                {tl.sizes[option.deg] ?? option.label} ({Math.round(option.deg * 3600)}″, ~{option.seconds} s)
              </option>
            ))}
          </select>
        </label>
        <label>
          {tl.detector}
          <select
            value={detector ?? ''}
            onChange={(e) => onDetectorChange(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{tl.allDetectors}</option>
            {[1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                D{d}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="timelapse-hint">
        {tl.hint}
        {target && tl.markerHint(target.name)}
      </p>
    </section>
  );
}
