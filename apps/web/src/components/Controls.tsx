import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { CHALLENGE_TARGETS, type Target } from '../data/targets';
import type { ObservationsState } from '../hooks/useObservations';
import { dateToMjd, parseDec, parseRa, predictPosition, type Equatorial } from '../lib/astro';
import { formatEpochSummary, type Epoch } from '../lib/epochs';
import { SpectralControls } from './SpectralControls';
import type { ViewState } from '../lib/urlState';
import { ObservationsPanel } from './ObservationsPanel';

interface Props {
  view: ViewState;
  onChange: (patch: Partial<ViewState>) => void;
  showGaia: boolean;
  onToggleGaia: () => void;
  pointingStatus: string;
  onTogglePointing: () => void;
  observationsState: ObservationsState;
  retry: () => void;
  selectedEpoch: Epoch | null;
  onSelectEpoch: (epoch: Epoch) => void;
  target: Target | null;
  targetPosition: Equatorial | null;
  targetDate: string;
  onClearTarget: () => void;
}

const TABS = [
  { key: 'search', label: 'Buscar', panelId: 'controls-search' },
  { key: 'observations', label: 'Observaciones', panelId: 'controls-observations' },
  { key: 'layers', label: 'Capas', panelId: 'controls-layers' },
] as const;
type MobileTab = (typeof TABS)[number]['key'];

export function Controls({
  view,
  onChange,
  showGaia,
  onToggleGaia,
  pointingStatus,
  onTogglePointing,
  observationsState,
  retry,
  selectedEpoch,
  onSelectEpoch,
  target,
  targetPosition,
  targetDate,
  onClearTarget,
}: Props) {
  const [raInput, setRaInput] = useState('');
  const [decInput, setDecInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);
  const observationCount = observationsState.status === 'ready' ? observationsState.data.count : 0;
  const summary =
    observationsState.status === 'ready'
      ? formatEpochSummary(observationsState.epochs)
      : observationsState.status === 'idle' || observationsState.status === 'loading'
        ? 'Buscando observaciones…'
        : observationsState.status === 'empty'
          ? 'Sin observaciones'
          : observationsState.status === 'error'
            ? 'Observaciones no disponibles'
            : '';

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: MobileTab) => {
    const index = TABS.findIndex((tab) => tab.key === current);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = TABS[nextIndex];
    setMobileTab(nextTab.key);
    window.requestAnimationFrame(() => document.getElementById(`tab-${nextTab.key}`)?.focus());
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ra = parseRa(raInput);
    const dec = parseDec(decInput);
    if (ra === null || dec === null) {
      setError('Formato inválido. Ej: 08h55m10.831s / -7d14m42.53s o grados decimales.');
      return;
    }
    setError(null);
    onChange({ ra, dec, target: null });
  };

  const goToTarget = (id: string) => {
    const t = CHALLENGE_TARGETS.find((x) => x.id === id);
    if (!t) return;
    onChange({ ...predictPosition(t, dateToMjd(new Date())), fov: t.fov, target: t.id });
  };

  return (
    <aside className={`controls${mobileTab ? ' mobile-expanded' : ''}`} data-mobile-tab={mobileTab ?? 'collapsed'}>
      <h1 className="controls-title">SPHEREx SkyLens</h1>
      <div className="mobile-tabs" role="tablist" aria-label="Controles del mapa">
        {TABS.map((tab, index) => (
          <button
            id={`tab-${tab.key}`}
            key={tab.key}
            type="button"
            role="tab"
            aria-controls={tab.panelId}
            aria-selected={mobileTab === tab.key}
            tabIndex={mobileTab === tab.key || (mobileTab === null && index === 0) ? 0 : -1}
            onClick={() => setMobileTab((current) => (current === tab.key ? null : tab.key))}
            onKeyDown={(event) => handleTabKeyDown(event, tab.key)}
          >
            {tab.key === 'observations' ? `${tab.label} · ${observationCount}` : tab.label}
          </button>
        ))}
      </div>
      {summary && (
        <p className="mobile-summary" aria-live="polite">
          {summary}
        </p>
      )}

      <section
        id="controls-search"
        className="control-section search-section"
        role="tabpanel"
        aria-labelledby="tab-search"
      >
        <form onSubmit={submit} className="coords">
          <input
            aria-label="Ascensión recta"
            placeholder="RA (08h55m10.8s)"
            value={raInput}
            onChange={(e) => setRaInput(e.target.value)}
          />
          <input
            aria-label="Declinación"
            placeholder="Dec (-7d14m42s)"
            value={decInput}
            onChange={(e) => setDecInput(e.target.value)}
          />
          <button type="submit">Ir</button>
        </form>
        {error && <p className="error">{error}</p>}

        <label>
          Objetivos del challenge
          <select value={view.target ?? ''} onChange={(e) => goToTarget(e.target.value)}>
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

        {target && targetPosition ? (
          <>
            <p className="readout target-readout">
              Posición esperada · {target.name} · {targetDate}: RA {targetPosition.ra.toFixed(6)}° Dec{' '}
              {targetPosition.dec.toFixed(6)}°
            </p>
            <p className="readout target-source">{target.source}</p>
            <button type="button" className="remove-marker" onClick={onClearTarget}>
              Quitar marcador
            </button>
          </>
        ) : (
          <p className="readout">
            RA {view.ra.toFixed(5)}° · Dec {view.dec.toFixed(5)}° · FoV {view.fov.toFixed(3)}°
          </p>
        )}
      </section>

      <section id="controls-layers" className="control-section layers-section" role="tabpanel" aria-labelledby="tab-layers">
        <fieldset className="projection-control">
          <legend>Proyección del cielo</legend>
          <div className="projection-options">
            <button
              type="button"
              aria-pressed={view.projection === 'SIN'}
              title="SIN: mapa ortográfico del cielo"
              onClick={() => onChange({ projection: 'SIN' })}
            >
              SIN · mapa
            </button>
            <button
              type="button"
              aria-pressed={view.projection === 'TAN'}
              title="TAN: perspectiva desde el observador"
              onClick={() => onChange({ projection: 'TAN' })}
            >
              TAN · perspectiva
            </button>
          </div>
        </fieldset>

        <SpectralControls view={view} onChange={onChange} />

        <div className="toggles">
          <button type="button" onClick={onToggleGaia} aria-pressed={showGaia}>
            {showGaia ? 'Ocultar' : 'Mostrar'} Gaia DR3
          </button>
          <button type="button" onClick={onTogglePointing} aria-pressed={pointingStatus === 'active'}>
            {pointingStatus === 'active' ? 'Detener modo AR' : 'Modo AR: apuntar con el celular'}
          </button>
        </div>
        {(pointingStatus === 'denied' || pointingStatus === 'unsupported') && (
          <p className="error">Sensores no disponibles ({pointingStatus}). Usá HTTPS y permití ubicación/orientación.</p>
        )}
      </section>

      <section
        id="controls-observations"
        className="control-section observations-section"
        role="tabpanel"
        aria-labelledby="tab-observations"
      >
        <ObservationsPanel
          state={observationsState}
          retry={retry}
          selectedEpoch={selectedEpoch}
          onSelectEpoch={onSelectEpoch}
        />
      </section>
    </aside>
  );
}
