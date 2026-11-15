import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { shareLink, type ShareOutcome } from '../lib/share';

export function ShareButton() {
  const { t } = useI18n();
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);

  useEffect(() => {
    if (!outcome) return;
    const id = window.setTimeout(() => setOutcome(null), 2200);
    return () => window.clearTimeout(id);
  }, [outcome]);

  const label = outcome === 'copied' ? t.shareCopied : outcome === 'failed' ? t.shareFailed : t.share;
  return (
    <button
      type="button"
      className={`icon-button share-button${outcome === 'copied' ? ' copied' : ''}`}
      onClick={() => void shareLink(window.location.href, document.title).then(setOutcome)}
      aria-label={label}
      title={label}
      aria-live="polite"
    >
      {outcome === 'copied' ? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M8 10V2m0 0L5 5m3-3l3 3M3 8v5a1 1 0 001 1h8a1 1 0 001-1V8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
