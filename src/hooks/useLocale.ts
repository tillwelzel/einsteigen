import { useEffect, useState } from 'react';
import { TRANSLATIONS } from '../i18n';
import type { Locale } from '../types';

const STORAGE_KEY = 'einsteigen-locale';

function detectInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'de' || saved === 'en') return saved;
  } catch {}
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('de')) {
    return 'de';
  }
  return 'en';
}

export function useLocale() {
  const [locale, setLocale] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {}
  }, [locale]);

  const toggleLocale = () => setLocale((prev) => (prev === 'de' ? 'en' : 'de'));

  return {
    locale,
    setLocale,
    toggleLocale,
    t: TRANSLATIONS[locale],
  };
}
