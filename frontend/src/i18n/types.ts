export type SupportedLocale = 'en' | 'id';

export const LOCALE_KEY = 'app.locale' as const;

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'id'] as const;

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export function isLocale(value: unknown): value is SupportedLocale {
  return value === 'en' || value === 'id';
}

export function resolveInitialLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // localStorage unavailable (SSR/private mode) — fall through to navigator.
  }
  try {
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith('id')) return 'id';
  } catch {
    // navigator unavailable — fall through to default.
  }
  return DEFAULT_LOCALE;
}
