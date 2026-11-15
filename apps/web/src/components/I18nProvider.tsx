import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nContext, initialLang, MESSAGES, storeLang, type Lang } from '../lib/i18n';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.querySelector('meta[name="description"]')?.setAttribute('content', MESSAGES[lang].appDescription);
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      t: MESSAGES[lang],
      setLang: (next: Lang) => {
        storeLang(next);
        setLangState(next);
      },
    }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
