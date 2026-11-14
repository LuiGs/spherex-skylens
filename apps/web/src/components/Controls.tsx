import { useState, type FormEvent } from 'react';
import { CHALLENGE_TARGETS } from '../data/targets';
import { applyProperMotion, parseDec, parseRa } from '../lib/astro';
import { approxWavelength, frameToBandChannel, SPHEREX_CUBE_DEPTH } from '../lib/spherex';
import type { ViewState } from '../lib/urlState';

interface Props {
  view: ViewState;
  onChange: (patch: Partial<ViewState>) => void;
  showGaia: boolean;
  onToggleGaia: () => void;
  pointingStatus: string;
  onTogglePointing: () => void;
}

const SPHEREX_EPOCH = 2025.8;

export function Controls({ view, onChange, showGaia, onToggleGaia, pointingStatus, onTogglePointing }: Props) {
  const [raInput, setRaInput] = useState('');
  const [decInput, setDecInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { band, channel } = frameToBandChannel(view.frame);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ra = parseRa(raInput);
    const dec = parseDec(decInput);
    if (ra === null || dec === null) {
      setError('Formato inválido. Ej: 08h55m10.831s / -7d14m42.53s o grados decimales.');
      return;
    }
    setError(null);
    onChange({ ra, dec });
  };

  const goToTarget = (id: string) => {
    const t = CHALLENGE_TARGETS.find((x) => x.id === id);
    if (!t) return;
    const pos =
      t.pmRa !== undefined && t.pmDec !== undefined
        ? applyProperMotion(t, t.pmRa, t.pmDec, t.epoch, SPHEREX_EPOCH)
        : { ra: t.ra, dec: t.dec };
    onChange({ ...pos, fov: t.fov });
  };

  return (
    <aside className="controls">
      <h1>SPHEREx SkyLens</h1>
      <form onSubmit={submit} className="coords">
        <input aria-label="Ascensión recta" placeholder="RA (08h55m10.8s)" value={raInput} onChange={(e) => setRaInput(e.target.value)} />
        <input aria-label="Declinación" placeholder="Dec (-7d14m42s)" value={decInput} onChange={(e) => setDecInput(e.target.value)} />
        <button type="submit">Ir</button>
      </form>
      {error && <p className="error">{error}</p>}

      <label>
        Objetivos del challenge
        <select defaultValue="" onChange={(e) => goToTarget(e.target.value)}>
          <option value="" disabled>
            Elegí un objeto…
          </option>
          {CHALLENGE_TARGETS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Banda D{band} · canal {channel} · ~{approxWavelength(view.frame).toFixed(2)} µm
        <input
          type="range"
          min={0}
          max={SPHEREX_CUBE_DEPTH - 1}
          value={view.frame}
          onChange={(e) => onChange({ frame: Number(e.target.value) })}
        />
      </label>

      <div className="toggles">
        <button type="button" onClick={onToggleGaia} aria-pressed={showGaia}>
          {showGaia ? 'Ocultar' : 'Mostrar'} Gaia DR3
        </button>
        <button type="button" onClick={onTogglePointing} aria-pressed={pointingStatus === 'active'}>
          {pointingStatus === 'active' ? 'Detener' : 'Apuntar con el celular'}
        </button>
      </div>
      {(pointingStatus === 'denied' || pointingStatus === 'unsupported') && (
        <p className="error">Sensores no disponibles ({pointingStatus}). Usá HTTPS y permití ubicación/orientación.</p>
      )}

      <p className="readout">
        RA {view.ra.toFixed(5)}° · Dec {view.dec.toFixed(5)}° · FoV {view.fov.toFixed(3)}°
      </p>
    </aside>
  );
}
