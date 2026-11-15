import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { CHALLENGE_TARGETS, type Target } from '../data/targets';
import type { ObservationsState } from '../hooks/useObservations';
import { dateToMjd, predictPosition, type Equatorial } from '../lib/astro';
import { formatEpochSummary, type Epoch } from '../lib/epochs';
import { SpectralControls } from './SpectralControls';
import { useI18n } from '../lib/i18n';
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
  const { t, lang, setLang } = useI18n();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab | null>(null);
  const observationCount = observationsState.status === 'ready' ? observationsState.data.count : 0;
  const summary =
    observationsState.status === 'ready'
      ? formatEpochSummary(observationsState.epochs, t.locale, t.observations.epochs)
      : observationsState.status === 'idle' || observationsState.status === 'loading'
        ? t.summary.loading
        : observationsState.status === 'empty'
          ? t.summary.empty
          : observationsState.status === 'error'
            ? t.summary.error
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
      if (!result) setError(t.search.notFound(query.trim()));
      else if (result.kind === 'target') goToTarget(result.target.id);
      else onChange({ ...result.position, target: null });
    } catch {
      setError(t.search.resolverDown);
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
        <div className="heading-actions">
          <button
            type="button"
            className="icon-button lang-button"
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            aria-label={t.switchTo}
            title={t.switchTo}
          >
            {lang === 'es' ? 'EN' : 'ES'}
          </button>
          <button type="button" className="icon-button help-button" onClick={onShowHelp} aria-label={t.help}>
            ?
          </button>
        </div>
      </div>
      <div className="mobile-tabs" role="tablist" aria-label={t.tabs.label}>
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
            {tab.key === 'observations' ? `${t.tabs[tab.key]} · ${observationCount}` : t.tabs[tab.key]}
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
            aria-label={t.search.label}
            placeholder="M31, Barnard, 08h55m10s -7d14m42s"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            enterKeyHint="search"
          />
          <button type="submit" disabled={searching}>
            {searching ? '…' : t.search.go}
          </button>
        </form>
        {error && <p className="error">{error}</p>}

        <label>
          {t.targets.label}
          <select value={view.target ?? ''} onChange={(e) => goToTarget(e.target.value)}>
            <option value="" disabled>
              {t.targets.placeholder}
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
              {t.expected} · {target.name} · {targetDate}: RA {targetPosition.ra.toFixed(6)}° Dec{' '}
              {targetPosition.dec.toFixed(6)}°
            </p>
            <p className="readout target-source">{target.source}</p>
            <div className="toggles">
              <button type="button" onClick={onOpenTimelapse} disabled={timelapseOpen}>
                {t.moves}
              </button>
              <button type="button" onClick={onOpenSpectrum}>
                {t.spectrum}
              </button>
              <button type="button" className="remove-marker" onClick={onClearTarget}>
                {t.clearMarker}
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
          <kbd>D</kbd> {t.keys.move} · <kbd>+</kbd>
          <kbd>−</kbd> {t.keys.zoom}
        </p>
      </section>

      <section id="controls-layers" className="control-section layers-section" role="tabpanel" aria-labelledby="tab-layers">
        <fieldset className="projection-control">
          <legend>{t.projection.title}</legend>
          <div className="projection-options">
            <button
              type="button"
              aria-pressed={view.projection === 'SIN'}
              title={t.projection.sinHint}
              onClick={() => onChange({ projection: 'SIN' })}
            >
              {t.projection.sin}
            </button>
            <button
              type="button"
              aria-pressed={view.projection === 'TAN'}
              title={t.projection.tanHint}
              onClick={() => onChange({ projection: 'TAN' })}
            >
              {t.projection.tan}
            </button>
          </div>
        </fieldset>

        <SpectralControls view={view} onChange={onChange} />

        <div className="toggles">
          <button type="button" onClick={onOpenSpectrum}>
            {t.spectrumHere}
          </button>
          <button type="button" onClick={onToggleGaia} aria-pressed={showGaia}>
            {t.gaia(showGaia)}
          </button>
          <button type="button" onClick={onTogglePointing} aria-pressed={pointingStatus === 'active'}>
            {t.ar(pointingStatus === 'active')}
          </button>
        </div>
        {(pointingStatus === 'denied' || pointingStatus === 'unsupported') && (
          <p className="error">{t.sensors(pointingStatus)}</p>
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
