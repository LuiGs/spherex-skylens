import { useEffect, useRef, useState } from 'react';
import { markOnboardingSeen } from '../lib/onboarding';

const STEPS = [
  {
    title: 'El cielo infrarrojo de SPHEREx',
    body: 'SPHEREx es un telescopio de la NASA que mapea todo el cielo en 102 colores infrarrojos, invisibles para el ojo. Acá ves sus imágenes reales, servidas por NASA/IPAC IRSA.',
  },
  {
    title: 'Movete por el cielo',
    body: 'Arrastrá para moverte y usá la rueda o el pellizco para hacer zoom. En PC también podés usar W A S D o las flechas, y + / − para el zoom. En el celular, activá el modo AR y apuntá el teléfono al cielo.',
  },
  {
    title: 'Encontrá lo que se mueve',
    body: 'Las estrellas lejanas parecen fijas; las enanas marrones cercanas o un posible “Planeta X” cambian de lugar entre las pasadas de SPHEREx. Elegí un objetivo del challenge y tocá “Ver si se mueve” para comparar las épocas.',
  },
];

export function Onboarding({ onClose }: { onClose: () => void }) {
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
            Saltar
          </button>
          {step > 0 && (
            <button type="button" className="secondary" onClick={() => setStep(step - 1)}>
              Atrás
            </button>
          )}
          <button ref={primary} type="button" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? 'Empezar a explorar' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
