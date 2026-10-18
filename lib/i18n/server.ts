// lib/i18n/server.ts
//
// Server-only: reads the locale chosen with <LanguageToggle /> from the
// NEXT_LOCALE cookie. (The old getLocale() never read the cookie, so the
// server always rendered Arabic and the toggle appeared to do nothing.)
// Use in Server Components, layouts and Route Handlers.

import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from '@/lib/i18n/config'

export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return value === 'en' || value === 'ar' ? value : DEFAULT_LOCALE
}
