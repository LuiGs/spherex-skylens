import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controls } from './components/Controls';
import { SkyView } from './components/SkyView';
import { CHALLENGE_TARGETS } from './data/targets';
import { useObservations } from './hooks/useObservations';
import { useSkyPointing } from './hooks/useSkyPointing';
import { dateToMjd, predictPosition } from './lib/astro';
import { mjdToDate, type Epoch } from './lib/epochs';
import { readViewState, writeViewState, type ViewState } from './lib/urlState';

export default function App() {
  const [view, setView] = useState<ViewState>(() => readViewState(window.location.search));
  const [showGaia, setShowGaia] = useState(false);
  const [selectedEpoch, setSelectedEpoch] = useState<Epoch | null>(null);
  const { state: observationsState, retry } = useObservations(view.ra, view.dec, view.fov);

  const update = useCallback((patch: Partial<ViewState>) => {
    setView((v) => ({ ...v, ...patch }));
    if (patch.ra !== undefined || patch.dec !== undefined || patch.fov !== undefined) setSelectedEpoch(null);
  }, []);
  const pointing = useSkyPointing(update);
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

  useEffect(() => {
    const id = window.setTimeout(() => window.history.replaceState(null, '', writeViewState(view)), 300);
    return () => window.clearTimeout(id);
  }, [view]);

  return (
    <main className="app">
      <SkyView view={view} showGaia={showGaia} onViewChange={update} targetPosition={targetPosition} />
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
      />
    </main>
  );
}
