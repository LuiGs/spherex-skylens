import type { KeyboardEvent } from 'react';
import { CHANNELS, WAVELENGTHS, channelColor, nearestChannel } from '../lib/spherex';
import type { ViewState } from '../lib/urlState';

interface Props { view: ViewState; onChange: (patch: Partial<ViewState>) => void }
const start = WAVELENGTHS[0], end = WAVELENGTHS[101];
const position = (wavelength: number) => (wavelength - start) / (end - start) * 100;

export function SpectralControls({ view, onChange }: Props) {
  const color = view.spectralMode === 'color';
  const low = color ? view.minFrame : view.frame, high = color ? view.maxFrame : view.frame;
  const selected = CHANNELS.filter((c) => c.available && c.frame >= low && c.frame <= high);
  const change = (key: 'frame' | 'minFrame' | 'maxFrame', frame: number) => {
    if (key === 'minFrame') onChange({ minFrame: Math.min(frame, view.maxFrame) });
    else if (key === 'maxFrame') onChange({ maxFrame: Math.max(frame, view.minFrame) });
    else onChange({ frame });
  };
  const keyboard = (e: KeyboardEvent<HTMLInputElement>, key: 'frame' | 'minFrame' | 'maxFrame', frame: number) => {
    const delta = ['ArrowRight', 'ArrowUp'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(e.key) ? -1 : 0;
    if (!delta && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    let next = e.key === 'Home' ? 0 : e.key === 'End' ? 101 : frame + delta;
    while (CHANNELS[next] && !CHANNELS[next].available) next += delta || 1;
    change(key, Math.max(0, Math.min(101, next)));
  };
  const slider = (label: string, key: 'frame' | 'minFrame' | 'maxFrame', frame: number) => (
    <label className="spectral-slider">
      <span>{label} <strong>{WAVELENGTHS[frame].toFixed(3)} µm</strong></span>
      <input type="range" min={start} max={end} step={0.001} value={WAVELENGTHS[frame]}
        aria-label={label} aria-valuetext={`${WAVELENGTHS[frame]} micrómetros, D${CHANNELS[frame].band}, canal ${CHANNELS[frame].channel}`}
        onChange={(e) => change(key, nearestChannel(Number(e.target.value)))}
        onKeyDown={(e) => keyboard(e, key, frame)} />
      <small>D{CHANNELS[frame].band} · canal {CHANNELS[frame].channel}</small>
    </label>
  );
  return (
    <fieldset className="spectral-control">
      <legend>Luz infrarroja</legend>
      <label className="spectral-toggle">
        <input type="checkbox" role="switch" checked={color} onChange={(e) => onChange({ spectralMode: e.target.checked ? 'color' : 'mono' })} />
        {color ? 'Varios canales' : 'Un canal'}
      </label>
      {slider(color ? 'Mínimo' : 'Canal', color ? 'minFrame' : 'frame', low)}
      {color && slider('Máximo', 'maxFrame', high)}
      <div className="spectral-strip" aria-label="Bandas y canales por longitud de onda">
        {CHANNELS.map((c, i) => {
          const left = i ? (WAVELENGTHS[i - 1] + c.wavelength) / 2 : start;
          const right = i < 101 ? (c.wavelength + WAVELENGTHS[i + 1]) / 2 : end;
          const active = c.frame >= low && c.frame <= high;
          return <span key={i} className={c.available ? '' : 'spectral-blank'}
            title={`D${c.band} · canal ${c.channel} · ${c.wavelength} µm${c.available ? '' : ' · sin datos'}`}
            style={{ left: `${position(left)}%`, width: `${position(right) - position(left)}%`, backgroundColor: active && c.available ? (color ? channelColor(i, low, high) : '#dce4ef') : '#252a3e' }} />;
        })}
      </div>
      <div className="spectral-bands" aria-label="Bandas incluidas">
        {[1, 2, 3, 4, 5, 6].map((band) => {
          const a = (band - 1) * 17, b = a + 16;
          const left = a ? (WAVELENGTHS[a - 1] + WAVELENGTHS[a]) / 2 : start;
          const right = b < 101 ? (WAVELENGTHS[b] + WAVELENGTHS[b + 1]) / 2 : end;
          return <span key={band} style={{ left: `${position(left)}%`, width: `${position(right) - position(left)}%` }}
            data-selected={selected.some((c) => c.band === band)}>D{band}</span>;
        })}
      </div>
    </fieldset>
  );
}
