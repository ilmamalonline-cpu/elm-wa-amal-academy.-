// lib/i18n/config.ts
import { cookies } from 'next/headers'

export type Locale = 'ar' | 'en'
export const DEFAULT_LOCALE: Locale = 'ar'
export const LOCALE_COOKIE = 'elm_locale'

/** Read the active locale from a cookie on the server. Defaults to Arabic. */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const value = cookieStore.get(LOCALE_COOKIE)?.value
  return value === 'en' ? 'en' : DEFAULT_LOCALE
}

export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}
