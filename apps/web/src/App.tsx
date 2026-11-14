import { useCallback, useEffect, useState } from 'react';
import { Controls } from './components/Controls';
import { SkyView } from './components/SkyView';
import { useSkyPointing } from './hooks/useSkyPointing';
import { readViewState, writeViewState, type ViewState } from './lib/urlState';

export default function App() {
  const [view, setView] = useState<ViewState>(() => readViewState(window.location.search));
  const [showGaia, setShowGaia] = useState(false);

  const update = useCallback((patch: Partial<ViewState>) => setView((v) => ({ ...v, ...patch })), []);
  const pointing = useSkyPointing(update);

  useEffect(() => {
    const id = window.setTimeout(() => window.history.replaceState(null, '', writeViewState(view)), 300);
    return () => window.clearTimeout(id);
  }, [view]);

  return (
    <main className="app">
      <SkyView view={view} showGaia={showGaia} onViewChange={update} />
      <Controls
        view={view}
        onChange={update}
        showGaia={showGaia}
        onToggleGaia={() => setShowGaia((s) => !s)}
        pointingStatus={pointing.status}
        onTogglePointing={() => (pointing.status === 'active' ? pointing.stop() : pointing.start())}
      />
    </main>
  );
}
