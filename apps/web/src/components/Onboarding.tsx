import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { markOnboardingSeen } from '../lib/onboarding';


export function Onboarding({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const STEPS = t.onboarding.steps;
  const [step, setStep] = useState(0);
  const primary = useRef<HTMLButtonElement>(null);
  const last = step === STEPS.length - 1;

  const finish = () => {
    markOnboardingSeen();
    onClose();
  };

  useEffect(() => primary.current?.focus(), [step]);

  return (
    <div className="onboarding-backdrop" role="presentation" onKeyDown={(e) => e.key === 'Escape' && finish()}>
      <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <p className="onboarding-step">
          {step + 1} / {STEPS.length}
        </p>
        <h2 id="onboarding-title">{STEPS[step].title}</h2>
        <p>{STEPS[step].body}</p>
        <div className="onboarding-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'is-active' : ''} />
          ))}
        </div>
        <div className="onboarding-actions">
          <button type="button" className="secondary" onClick={finish}>
            {t.onboarding.skip}
          </button>
          {step > 0 && (
            <button type="button" className="secondary" onClick={() => setStep(step - 1)}>
              {t.onboarding.back}
            </button>
          )}
          <button ref={primary} type="button" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? t.onboarding.start : t.onboarding.next}
          </button>
        </div>
      </div>
    </div>
  );
}
