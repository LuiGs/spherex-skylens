import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controls } from './components/Controls';
import { Onboarding } from './components/Onboarding';
import { SkyView } from './components/SkyView';
import { SpectrumPanel } from './components/SpectrumPanel';
import { TimelapsePlayer } from './components/TimelapsePlayer';
import { CHALLENGE_TARGETS } from './data/targets';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useObservations } from './hooks/useObservations';
import { useSmallBodies } from './hooks/useSmallBodies';
import { useSkyPick } from './hooks/useSkyPick';
import { SkyPickCard } from './components/SkyPickCard';

const AR_FOV_DEG = 60;
import { useSkyPointing } from './hooks/useSkyPointing';
import { dateToMjd, predictPosition, type Equatorial } from './lib/astro';
import { mjdToDate, type Epoch } from './lib/epochs';
import { hasSeenOnboarding } from './lib/onboarding';
import { defaultTimelapseSize } from './lib/timelapse';
import { readViewState, writeViewState, type ViewState } from './lib/urlState';
import { clampFov } from './lib/projection';

export default function App() {
  const [view, setView] = useState<ViewState>(() => readViewState(window.location.search));
  const [showGaia, setShowGaia] = useState(false);
  const [gaiaMotion, setGaiaMotion] = useState<{ years: number; count: number } | null>(null);
  const [showSolarSystem, setShowSolarSystem] = useState(false);
  const [selectedEpoch, setSelectedEpoch] = useState<Epoch | null>(null);
  const [spectrumAt, setSpectrumAt] = useState<Equatorial | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());
  const { state: observationsState, retry } = useObservations(view.ra, view.dec, view.fov);

  // The timelapse is centred where it was opened, so panning the sky does not refetch it.
  const [timelapseCenter, setTimelapseCenter] = useState(() => ({ ra: view.ra, dec: view.dec }));

  const [pick, setPick] = useState<Equatorial | null>(null);
  const [spectrumLabel, setSpectrumLabel] = useState<string | null>(null);
  const pickState = useSkyPick(pick, view.fov);
  const update = useCallback((patch: Partial<ViewState>) => {
    setView((v) => {
      const next = { ...v, ...patch };
      return { ...next, fov: clampFov(next.fov, next.projection) };
    });
    if (patch.ra !== undefined || patch.dec !== undefined || patch.fov !== undefined) setSelectedEpoch(null);
  }, []);
  const openTimelapse = useCallback(() => {
    setSpectrumAt(null);
    setPick(null);
    setTimelapseCenter({ ra: view.ra, dec: view.dec });
    setView((v) => ({ ...v, timelapse: v.timelapse ?? defaultTimelapseSize(v.fov) }));
  }, [view.ra, view.dec]);
  const closeTimelapse = useCallback(() => setView((v) => ({ ...v, timelapse: null })), []);
  const openSpectrum = useCallback(() => {
    setView((v) => ({ ...v, timelapse: null }));
    setSpectrumLabel(null);
    setSpectrumAt({ ra: view.ra, dec: view.dec });
  }, [view.ra, view.dec]);
  const openSpectrumAtPick = useCallback(() => {
    if (!pick) return;
    setView((v) => ({ ...v, timelapse: null }));
    setSpectrumLabel(pickState?.status === 'ready' ? (pickState.object?.name ?? null) : null);
    setSpectrumAt(pick);
    setPick(null);
  }, [pick, pickState]);
  const closeSpectrum = useCallback(() => setSpectrumAt(null), []);
  const pointing = useSkyPointing(update);
  // A phone camera spans tens of degrees; opening the field that wide keeps hand motion in proportion.
  const fovBeforePointing = useRef<number | null>(null);
  const startPointing = useCallback(() => {
    fovBeforePointing.current = view.fov;
    setView((v) => ({ ...v, fov: Math.max(v.fov, AR_FOV_DEG), timelapse: null }));
    setSpectrumAt(null);
    void pointing.start();
  }, [pointing, view.fov]);
  const stopPointing = useCallback(() => {
    pointing.stop();
    const previous = fovBeforePointing.current;
    if (previous !== null) setView((v) => ({ ...v, fov: previous }));
  }, [pointing]);
  const [panelHidden, setPanelHidden] = useState(false);
  const togglePanel = useCallback(() => setPanelHidden((hidden) => !hidden), []);
  useKeyboardNavigation(view, update, {
    allowArrows: view.timelapse === null,
    enabled: !showOnboarding,
    actions: {
      togglePanel,
      help: () => setShowOnboarding(true),
      timelapse: view.timelapse === null ? openTimelapse : undefined,
    },
  });
  const target = CHALLENGE_TARGETS.find((candidate) => candidate.id === view.target) ?? null;
  const markerMjd = useMemo(() => {
    if (selectedEpoch) return (selectedEpoch.mjdStart + selectedEpoch.mjdEnd) / 2;
    if (observationsState.status === 'ready' && observationsState.epochs.length) {
      const lastEpoch = observationsState.epochs[observationsState.epochs.length - 1];
      return (lastEpoch.mjdStart + lastEpoch.mjdEnd) / 2;
    }
    return dateToMjd(new Date());
  }, [observationsState, selectedEpoch]);
  const smallBodies = useSmallBodies(showSolarSystem, view.ra, view.dec, markerMjd);
  const targetPosition = useMemo(() => (target ? predictPosition(target, markerMjd) : null), [target, markerMjd]);
  const targetDate = useMemo(() => mjdToDate(markerMjd).toISOString().slice(0, 10), [markerMjd]);
  const timelapseBox = useMemo(
    () => (view.timelapse ? { ...timelapseCenter, size: view.timelapse } : null),
    [timelapseCenter, view.timelapse],
  );

  useEffect(() => {
    const id = window.setTimeout(() => window.history.replaceState(null, '', writeViewState(view)), 300);
    return () => window.clearTimeout(id);
  }, [view]);

  return (
    <main className="app">
      <SkyView
        view={view}
        showGaia={showGaia}
        smallBodies={smallBodies.status === 'ready' ? smallBodies.bodies : null}
        onViewChange={update}
        targetPosition={targetPosition}
        timelapseBox={timelapseBox}
        pick={pick}
        onPick={setPick}
        onGaiaMotion={setGaiaMotion}
      />
      <Controls
        view={view}
        hidden={panelHidden}
        onToggleHidden={togglePanel}
        onChange={update}
        showGaia={showGaia}
        onToggleGaia={() => setShowGaia((s) => !s)}
        gaiaMotion={showGaia ? gaiaMotion : null}
        showSolarSystem={showSolarSystem}
        onToggleSolarSystem={() => setShowSolarSystem((s) => !s)}
        smallBodies={smallBodies}
        pointingStatus={pointing.status}
        onTogglePointing={() => (pointing.status === 'active' || pointing.status === 'held' ? stopPointing() : startPointing())}
        onToggleHold={pointing.toggleHold}
        observationsState={observationsState}
        retry={retry}
        selectedEpoch={selectedEpoch}
        onSelectEpoch={setSelectedEpoch}
        target={target}
        targetPosition={targetPosition}
        targetDate={targetDate}
        onClearTarget={() => update({ target: null })}
        onOpenTimelapse={openTimelapse}
        timelapseOpen={view.timelapse !== null}
        onShowHelp={() => setShowOnboarding(true)}
        onOpenSpectrum={openSpectrum}
      />
      {view.timelapse !== null && (
        <TimelapsePlayer
          center={timelapseCenter}
          size={view.timelapse}
          onSizeChange={(size) => update({ timelapse: size })}
          detector={view.detector}
          onDetectorChange={(detector) => update({ detector })}
          target={target}
          onClose={closeTimelapse}
        />
      )}
      {pick && (
        <SkyPickCard
          position={pick}
          state={pickState}
          onCenter={() => update({ ra: pick.ra, dec: pick.dec })}
          onSpectrum={openSpectrumAtPick}
          onClose={() => setPick(null)}
        />
      )}
      {spectrumAt && (
        <SpectrumPanel
          position={spectrumAt}
          label={
            spectrumLabel ?? (target && view.ra === spectrumAt.ra && view.dec === spectrumAt.dec ? target.name : null)
          }
          onClose={closeSpectrum}
        />
      )}
      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}
    </main>
  );
}
