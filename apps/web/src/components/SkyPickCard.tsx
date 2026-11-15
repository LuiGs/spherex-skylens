import type { Equatorial } from '../lib/astro';
import { simbadPageUrl } from '../lib/simbad';
import type { SkyPickState } from '../hooks/useSkyPick';
import { useI18n } from '../lib/i18n';

interface Props {
  position: Equatorial;
  state: SkyPickState | null;
  onCenter: () => void;
  onSpectrum: () => void;
  onClose: () => void;
}

function formatSeparation(arcsec: number): string {
  if (arcsec < 60) return `${arcsec.toFixed(0)}″`;
  return `${(arcsec / 60).toFixed(1)}′`;
}

export function SkyPickCard({ position, state, onCenter, onSpectrum, onClose }: Props) {
  const { t } = useI18n();
  const p = t.pick;
  const object = state?.status === 'ready' ? state.object : null;

  return (
    <section className="sky-pick" aria-live="polite" aria-label={p.title}>
      <header className="sky-pick-head">
        <div>
          <p className="section-label">{p.title}</p>
          {object ? (
            <h2 className="sky-pick-name">{object.name}</h2>
          ) : (
            <h2 className="sky-pick-name muted">
              {state?.status === 'loading' && p.loading}
              {state?.status === 'error' && p.error}
              {state?.status === 'ready' && p.none(formatSeparation(state.radiusDeg * 3600))}
            </h2>
          )}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={p.close}>
          ×
        </button>
      </header>
      {object && (
        <p className="sky-pick-meta">
          {p.types[object.category]}
          {object.separationArcsec > 1 ? ` · ${p.separation(formatSeparation(object.separationArcsec))}` : ''}
          {' · '}
          <a href={simbadPageUrl(object.name)} target="_blank" rel="noreferrer">
            {p.more}
          </a>
        </p>
      )}
      <p className="sky-pick-coords">
        RA {position.ra.toFixed(4)}° · Dec {position.dec.toFixed(4)}°
      </p>
      <div className="sky-pick-actions">
        <button type="button" onClick={onCenter}>
          {p.center}
        </button>
        <button type="button" className="primary" onClick={onSpectrum}>
          {p.spectrum}
        </button>
      </div>
    </section>
  );
}
