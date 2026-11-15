import type { ObservationsState } from '../hooks/useObservations';
import { formatEpochRange, type Epoch } from '../lib/epochs';

interface Props {
  state: ObservationsState;
  retry: () => void;
  selectedEpoch: Epoch | null;
  onSelectEpoch: (epoch: Epoch) => void;
}

function collectionLabel(collection: string): string {
  const known: Record<string, string> = { spherex_dr1: 'DR1', spherex_qr3: 'QR3' };
  return known[collection] ?? collection.toUpperCase();
}

export function ObservationsPanel({ state, retry, selectedEpoch, onSelectEpoch }: Props) {
  return (
    <section className="observations-panel" aria-label="Observaciones SPHEREx">
      <h2>Observaciones SPHEREx</h2>
      {(state.status === 'idle' || state.status === 'loading') && (
        <div className="observations-loading" aria-busy="true">
          <p>Buscando observaciones…</p>
          {[0, 1, 2].map((row) => (
            <div className="observation-skeleton" aria-hidden="true" key={row} />
          ))}
        </div>
      )}
      {state.status === 'empty' && (
        <div className="observations-message">
          <h3>Sin observaciones</h3>
          <p>SPHEREx todavía no publicó imágenes de esta zona en DR1. Probá otro punto o uno de los objetivos.</p>
        </div>
      )}
      {state.status === 'error' && (
        <div className="observations-message">
          {state.error.kind === 'busy' ? (
            <>
              <h3>IRSA está ocupado</h3>
              <p>El archivo de la NASA no respondió (502/503). Los datos no se perdieron: probá de nuevo en unos segundos.</p>
            </>
          ) : (
            <>
              <h3>No se pudo conectar con la API</h3>
              <p>
                {state.error.status
                  ? `La API respondió con estado ${state.error.status}.`
                  : 'Revisá tu conexión e intentá de nuevo.'}
              </p>
            </>
          )}
          <button type="button" onClick={retry}>
            Reintentar
          </button>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <p className="observations-badge">
            {state.data.observations.length
              ? [...new Set(state.data.observations.map((observation) => observation.collection))]
                  .map(collectionLabel)
                  .join(', ')
              : 'SPHEREx'}{' '}
            · {state.data.count}
          </p>
          <ul className="epoch-list">
            {state.epochs.map((epoch) => (
              <li key={epoch.index}>
                <button
                  type="button"
                  className={`epoch-card${selectedEpoch?.index === epoch.index ? ' is-selected' : ''}`}
                  aria-pressed={selectedEpoch?.index === epoch.index}
                  onClick={() => onSelectEpoch(epoch)}
                >
                  <span className="epoch-card-heading">
                    <strong>Época {epoch.index + 1}</strong>
                    <span>{epoch.count} {epoch.count === 1 ? 'imagen' : 'imágenes'}</span>
                  </span>
                  <span className="epoch-date">{formatEpochRange(epoch.mjdStart, epoch.mjdEnd)}</span>
                  <span className="detector-chips">
                    {Object.entries(epoch.byDetector)
                      .filter(([, count]) => count > 0)
                      .map(([detector, count]) => (
                        <span className="detector-chip" key={detector}>
                          D{detector}:{count}
                        </span>
                      ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
