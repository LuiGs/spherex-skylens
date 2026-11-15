import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { CHALLENGE_TARGETS, type Target } from '../data/targets';
import type { ObservationsState } from '../hooks/useObservations';
import { dateToMjd, predictPosition, type Equatorial } from '../lib/astro';
import { formatEpochSummary, type Epoch } from '../lib/epochs';
import { approxWavelength, frameToBandChannel, SPHEREX_CUBE_DEPTH } from '../lib/spherex';
import { resolveSearch } from '../lib/resolver';
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
  onOpenTimelapse: () => void;
  timelapseOpen: boolean;
  onShowHelp: () => void;
  onOpenSpectrum: () => void;
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
  onOpenTimelapse,
  timelapseOpen,
  onShowHelp,
  onOpenSpectrum,
}: Props) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);
  const { band, channel } = frameToBandChannel(view.frame);
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const result = await resolveSearch(query);
      if (!result) setError(`No encontré “${query.trim()}”. Probá con otro nombre o con coordenadas RA Dec.`);
      else if (result.kind === 'target') goToTarget(result.target.id);
      else onChange({ ...result.position, target: null });
    } catch {
      setError('No se pudo consultar el buscador de nombres (CDS). Probá con coordenadas RA Dec.');
    } finally {
      setSearching(false);
    }
  };

  const goToTarget = (id: string) => {
    const t = CHALLENGE_TARGETS.find((x) => x.id === id);
    if (!t) return;
    onChange({ ...predictPosition(t, dateToMjd(new Date())), fov: t.fov, target: t.id });
  };

  return (
    <aside className={`controls${mobileTab ? ' mobile-expanded' : ''}`} data-mobile-tab={mobileTab ?? 'collapsed'}>
      <div className="controls-heading">
        <h1 className="controls-title">SPHEREx SkyLens</h1>
        <button type="button" className="icon-button help-button" onClick={onShowHelp} aria-label="Cómo se usa">
          ?
        </button>
      </div>
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
        <form onSubmit={submit} className="coords" role="search">
          <input
            type="search"
            aria-label="Buscar un objeto por nombre o coordenadas"
            placeholder="M31, Barnard, 08h55m10s -7d14m42s"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
          />
          <button type="submit" disabled={searching}>
            {searching ? '…' : 'Ir'}
          </button>
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
            <div className="toggles">
              <button type="button" onClick={onOpenTimelapse} disabled={timelapseOpen}>
                ▶ Ver si se mueve
              </button>
              <button type="button" onClick={onOpenSpectrum}>
                Espectro
              </button>
              <button type="button" className="remove-marker" onClick={onClearTarget}>
                Quitar marcador
              </button>
            </div>
          </>
        ) : (
          <p className="readout">
            RA {view.ra.toFixed(5)}° · Dec {view.dec.toFixed(5)}° · FoV {view.fov.toFixed(3)}°
          </p>
        )}
        <p className="readout keyboard-hint">
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> o flechas para moverte · <kbd>+</kbd>
          <kbd>−</kbd> zoom
        </p>
      </section>

      <section id="controls-layers" className="control-section layers-section" role="tabpanel" aria-labelledby="tab-layers">
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
          <button type="button" onClick={onOpenSpectrum}>
            Espectro en el centro
          </button>
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
          onOpenTimelapse={onOpenTimelapse}
          timelapseOpen={timelapseOpen}
        />
      </section>
    </aside>
  );
}
