import { ShareButton } from './ShareButton';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { CHALLENGE_TARGETS, type Target } from '../data/targets';
import type { ObservationsState } from '../hooks/useObservations';
import { dateToMjd, predictPosition, type Equatorial } from '../lib/astro';
import { formatEpochSummary, type Epoch } from '../lib/epochs';
import { SpectralControls } from './SpectralControls';
import { useI18n } from '../lib/i18n';
import type { SmallBodiesState } from '../hooks/useSmallBodies';
import { shortName, skyRate } from '../lib/solarSystem';
import { mjdToDate } from '../lib/epochs';
import { resolveSearch } from '../lib/resolver';
import { suggestFor } from '../lib/suggestions';
import type { Suggestion } from '../data/suggestions';
import type { ViewState } from '../lib/urlState';
import { ObservationsPanel } from './ObservationsPanel';

interface Props {
  view: ViewState;
  onChange: (patch: Partial<ViewState>) => void;
  showGaia: boolean;
  onToggleGaia: () => void;
  showSolarSystem: boolean;
  onToggleSolarSystem: () => void;
  smallBodies: SmallBodiesState;
  gaiaMotion: { years: number; count: number } | null;
  pointingStatus: string;
  onToggleHold: () => void;
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
  hidden: boolean;
  onToggleHidden: () => void;
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
  showSolarSystem,
  onToggleSolarSystem,
  smallBodies,
  gaiaMotion,
  pointingStatus,
  onToggleHold,
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
  hidden,
  onToggleHidden,
  onOpenSpectrum,
}: Props) {
  const { t, lang, setLang } = useI18n();
  const arActive = pointingStatus === 'active' || pointingStatus === 'held';
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const suggestions = searchFocused ? suggestFor(query, lang) : [];
  const pickSuggestion = (item: Suggestion) => {
    setQuery(item.name[lang]);
    setError(null);
    setSearchFocused(false);
    onChange({ ra: item.ra, dec: item.dec, fov: item.fov, target: null });
  };
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
    <aside className={`controls${mobileTab ? ' mobile-expanded' : ''}${hidden ? ' controls-hidden' : ''}`} data-mobile-tab={mobileTab ?? 'collapsed'}>
      <div className="controls-heading">
        <h1 className="controls-title">
          SPHEREx SkyLens
          <small>{t.tagline}</small>
        </h1>
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
          <ShareButton />
          <button type="button" className="icon-button help-button" onClick={onShowHelp} aria-label={t.help}>
            ?
          </button>
          <button
            type="button"
            className="icon-button panel-toggle"
            onClick={onToggleHidden}
            aria-expanded={!hidden}
            aria-label={t.panel(hidden)}
            title={t.panel(hidden)}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d={hidden ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
            placeholder={t.search.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchFocused(false);
              if (e.key === 'Enter' && suggestions.length === 1) {
                e.preventDefault();
                pickSuggestion(suggestions[0]);
              }
            }}
            enterKeyHint="search"
            aria-autocomplete="list"
            aria-controls="search-suggestions"
          />
          <button type="submit" disabled={searching}>
            {searching ? '…' : t.search.go}
          </button>
        </form>
        {suggestions.length > 0 && (
          <ul id="search-suggestions" className="suggestions" role="listbox" aria-label={t.search.suggestions}>
            {suggestions.map((item) => (
              <li key={item.id} role="option" aria-selected={false}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickSuggestion(item)}>
                  <span>{item.name[lang]}</span>
                  <small>{t.search.kinds[item.kind] ?? ''}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="error">{error}</p>}

        <div className="start-here" role="group" aria-label={t.targets.label}>
          <p className="section-label">{t.targets.label}</p>
          <ul className="target-list">
            {CHALLENGE_TARGETS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="target-card"
                  aria-pressed={view.target === item.id}
                  onClick={() => goToTarget(item.id)}
                >
                  <span className="target-name">{item.name}</span>
                  <span className="target-blurb">{t.targets.blurbs[item.id]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

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
          <kbd>−</kbd> {t.keys.zoom} · <kbd>H</kbd> {t.keys.panel} · <kbd>?</kbd> {t.keys.help} · <kbd>␣</kbd>{' '}
          {t.keys.play}
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
          <button
            type="button"
            onClick={() => onChange({ wise: view.wise > 0 ? 0 : 0.5 })}
            aria-pressed={view.wise > 0}
          >
            {t.wise(view.wise > 0)}
          </button>
          <button type="button" onClick={onToggleGaia} aria-pressed={showGaia}>
            {t.gaia(showGaia)}
          </button>
          <button type="button" onClick={onToggleSolarSystem} aria-pressed={showSolarSystem}>
            {t.solarSystem(showSolarSystem)}
          </button>
          <button type="button" onClick={onTogglePointing} aria-pressed={arActive}>
            {t.ar(arActive)}
          </button>
        </div>
        {arActive && (
          <div className="ar-panel">
            <button type="button" className="primary" onClick={onToggleHold} aria-pressed={pointingStatus === 'held'}>
              {t.arHold(pointingStatus === 'held')}
            </button>
            <small className="hint">{pointingStatus === 'held' ? t.arHeldHint : t.arHint}</small>
          </div>
        )}
        {gaiaMotion && <p className="readout">{t.gaiaMotion(gaiaMotion.years, gaiaMotion.count)}</p>}
        {showSolarSystem && <SmallBodiesReadout state={smallBodies} />}
        {view.wise > 0 && (
          <label>
            {t.wiseOpacity(Math.round(view.wise * 100))}
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={Math.round(view.wise * 100)}
              onChange={(e) => onChange({ wise: Number(e.target.value) / 100 })}
            />
            <small className="hint">{t.wiseHint}</small>
          </label>
        )}
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

function SmallBodiesReadout({ state }: { state: SmallBodiesState }) {
  const { t } = useI18n();
  const s = t.solarSystemLayer;
  if (state.status === 'loading' || state.status === 'idle') return <p className="readout">{s.loading}</p>;
  if (state.status === 'error') return <p className="error">{s.error}</p>;
  const date = mjdToDate(state.mjd).toLocaleDateString(t.locale, { day: 'numeric', month: 'short', year: 'numeric' });
  if (state.bodies.length === 0) return <p className="readout">{s.none(date)}</p>;
  const shown = state.bodies.slice(0, 6);
  return (
    <div className="readout">
      <p>{s.found(state.bodies.length, date)}</p>
      <ul className="body-list">
        {shown.map((body) => {
          const rate = skyRate(body);
          return (
            <li key={body.name}>
              <span className="body-name">{shortName(body.name)}</span>
              <span className="body-meta">
                {body.kind === 'comet' ? s.comet : s.asteroid}
                {body.vmag !== null && ` · V ${body.vmag.toFixed(1)}`}
                {rate !== null && ` · ${s.rate(rate)}`}
              </span>
            </li>
          );
        })}
      </ul>
      {state.bodies.length > shown.length && <p className="hint">{s.more(state.bodies.length - shown.length)}</p>}
      <p className="hint">{s.hint}</p>
    </div>
  );
}
