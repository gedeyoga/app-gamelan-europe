import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { LOCALE_KEY, isLocale, type SupportedLocale } from './types';

export interface UseLanguageResult {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
}

/**
 * Source-of-truth untuk locale aktif.
 * Dipakai oleh `LanguageSwitcher` (components/shared) dan halaman mana pun
 * yang butuh baca/ubah bahasa. Implementasi tinggal di `src/i18n/` agar
 * komponen shared hanya mengimpor dari `components/ui`, `lib`, dan `i18n`
 * (tanpa import lintas-fitur `@/features/*`).
 */
export function useLanguage(): UseLanguageResult {
  const { i18n } = useTranslation();

  const locale: SupportedLocale = isLocale(i18n.language) ? i18n.language : 'en';

  const setLocale = useCallback(
    async (next: SupportedLocale) => {
      await i18n.changeLanguage(next);
      try {
        localStorage.setItem(LOCALE_KEY, next);
      } catch {
        // Storage unavailable — language still applies for this session.
      }
      if (typeof document !== 'undefined') {
        document.documentElement.lang = next;
      }
    },
    [i18n],
  );

  return { locale, setLocale };
}
