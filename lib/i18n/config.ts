// lib/i18n/config.ts
//
// Client-safe locale constants/types. This file is imported by Client
// Components (e.g. LanguageToggle), so it must NOT import `next/headers`.
// The server-side reader lives in lib/i18n/server.ts.

export type Locale = 'ar' | 'en'
export const DEFAULT_LOCALE: Locale = 'ar'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}
