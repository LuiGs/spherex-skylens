import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controls } from './components/Controls';
import { Onboarding } from './components/Onboarding';
import { SkyView } from './components/SkyView';
import { SpectrumPanel } from './components/SpectrumPanel';
import { TimelapsePlayer } from './components/TimelapsePlayer';
import { CHALLENGE_TARGETS } from './data/targets';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useObservations } from './hooks/useObservations';
import { useSkyPointing } from './hooks/useSkyPointing';
import { dateToMjd, predictPosition, type Equatorial } from './lib/astro';
import { mjdToDate, type Epoch } from './lib/epochs';
import { hasSeenOnboarding } from './lib/onboarding';
import { defaultTimelapseSize } from './lib/timelapse';
import { readViewState, writeViewState, type ViewState } from './lib/urlState';

export default function App() {
  const [view, setView] = useState<ViewState>(() => readViewState(window.location.search));
  const [showGaia, setShowGaia] = useState(false);
  const [selectedEpoch, setSelectedEpoch] = useState<Epoch | null>(null);
  const [spectrumAt, setSpectrumAt] = useState<Equatorial | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());
  const { state: observationsState, retry } = useObservations(view.ra, view.dec, view.fov);

  // The timelapse is centred where it was opened, so panning the sky does not refetch it.
  const [timelapseCenter, setTimelapseCenter] = useState(() => ({ ra: view.ra, dec: view.dec }));

  const update = useCallback((patch: Partial<ViewState>) => {
    setView((v) => ({ ...v, ...patch }));
    if (patch.ra !== undefined || patch.dec !== undefined || patch.fov !== undefined) setSelectedEpoch(null);
  }, []);
  const openTimelapse = useCallback(() => {
    setSpectrumAt(null);
    setTimelapseCenter({ ra: view.ra, dec: view.dec });
    setView((v) => ({ ...v, timelapse: v.timelapse ?? defaultTimelapseSize(v.fov) }));
  }, [view.ra, view.dec]);
  const closeTimelapse = useCallback(() => setView((v) => ({ ...v, timelapse: null })), []);
  const openSpectrum = useCallback(() => {
    setView((v) => ({ ...v, timelapse: null }));
    setSpectrumAt({ ra: view.ra, dec: view.dec });
  }, [view.ra, view.dec]);
  const closeSpectrum = useCallback(() => setSpectrumAt(null), []);
  const pointing = useSkyPointing(update);
  useKeyboardNavigation(view, update, { allowArrows: view.timelapse === null, enabled: !showOnboarding });
  const target = CHALLENGE_TARGETS.find((candidate) => candidate.id === view.target) ?? null;
  const markerMjd = useMemo(() => {
    if (selectedEpoch) return (selectedEpoch.mjdStart + selectedEpoch.mjdEnd) / 2;
    if (observationsState.status === 'ready' && observationsState.epochs.length) {
      const lastEpoch = observationsState.epochs[observationsState.epochs.length - 1];
      return (lastEpoch.mjdStart + lastEpoch.mjdEnd) / 2;
    }
    return dateToMjd(new Date());
  }, [observationsState, selectedEpoch]);
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
        onViewChange={update}
        targetPosition={targetPosition}
        timelapseBox={timelapseBox}
      />
      <Controls
        view={view}
        onChange={update}
        showGaia={showGaia}
        onToggleGaia={() => setShowGaia((s) => !s)}
        pointingStatus={pointing.status}
        onTogglePointing={() => (pointing.status === 'active' ? pointing.stop() : pointing.start())}
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
      {spectrumAt && (
        <SpectrumPanel
          position={spectrumAt}
          label={target && view.ra === spectrumAt.ra && view.dec === spectrumAt.dec ? target.name : null}
          onClose={closeSpectrum}
        />
      )}
      {showOnboarding && <Onboarding onClose={() => setShowOnboarding(false)} />}
    </main>
  );
}
