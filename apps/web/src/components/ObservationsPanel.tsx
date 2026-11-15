import type { ObservationsState } from '../hooks/useObservations';
import { formatEpochRange, mjdToDate, type Epoch } from '../lib/epochs';
import type { Observation } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface Props {
  state: ObservationsState;
  retry: () => void;
  selectedEpoch: Epoch | null;
  onSelectEpoch: (epoch: Epoch) => void;
  onOpenTimelapse: () => void;
  timelapseOpen: boolean;
}

function formatTime(mjd: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hourCycle: 'h23',
  }).format(mjdToDate(mjd));
}

function ImageList({ observations, locale }: { observations: Observation[]; locale: string }) {
  const { t } = useI18n();
  const o = t.observations;
  return (
    <details className="epoch-details">
      <summary>{o.details(observations.length)}</summary>
      <p className="hint">{o.detailsHint}</p>
      <ul className="image-list">
        {observations.map((obs) => (
          <li key={obs.obs_id + obs.detector}>
            <span className="image-meta">
              <strong>D{obs.detector}</strong> · {obs.wavelength_min_um.toFixed(2)}–{obs.wavelength_max_um.toFixed(2)} µm ·{' '}
              {formatTime(obs.mjd_start, locale)} UTC · {collectionLabel(obs.collection)}
            </span>
            <span className="image-id">{obs.obs_id}</span>
            <a href={obs.access_url} target="_blank" rel="noreferrer">
              {o.fits}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function collectionLabel(collection: string): string {
  const known: Record<string, string> = { spherex_dr1: 'DR1', spherex_qr3: 'QR3' };
  return known[collection] ?? collection.toUpperCase();
}

export function ObservationsPanel({ state, retry, selectedEpoch, onSelectEpoch, onOpenTimelapse, timelapseOpen }: Props) {
  const { t } = useI18n();
  const o = t.observations;
  return (
    <section className="observations-panel" aria-label={o.title}>
      <h2>{o.title}</h2>
      {(state.status === 'idle' || state.status === 'loading') && (
        <div className="observations-loading" aria-busy="true">
          <p>{o.loading}</p>
          {[0, 1, 2].map((row) => (
            <div className="observation-skeleton" aria-hidden="true" key={row} />
          ))}
        </div>
      )}
      {state.status === 'empty' && (
        <div className="observations-message">
          <h3>{o.emptyTitle}</h3>
          <p>{o.emptyBody}</p>
        </div>
      )}
      {state.status === 'error' && (
        <div className="observations-message">
          {state.error.kind === 'busy' ? (
            <>
              <h3>{o.busyTitle}</h3>
              <p>{o.busyBody}</p>
            </>
          ) : (
            <>
              <h3>{o.apiTitle}</h3>
              <p>
                {state.error.status ? t.errors.http(state.error.status) : t.errors.network}
              </p>
            </>
          )}
          <button type="button" onClick={retry}>
            {t.errors.retry}
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
          {state.epochs.length > 1 && (
            <button type="button" className="timelapse-cta" onClick={onOpenTimelapse} disabled={timelapseOpen}>
              {o.timelapse(state.epochs.length)}
            </button>
          )}
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
                    <strong>{o.epoch(epoch.index + 1)}</strong>
                    <span>{o.images(epoch.count)}</span>
                  </span>
                  <span className="epoch-date">{formatEpochRange(epoch.mjdStart, epoch.mjdEnd, t.locale)}</span>
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
                {selectedEpoch?.index === epoch.index && (
                  <ImageList observations={epoch.observations} locale={t.locale} />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
