export type Locale = 'ar' | 'en';
export const DEFAULT_LOCALE: Locale = 'ar';

export async function getLocale(): Promise<Locale> {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('NEXT_LOCALE') as Locale;
    return saved === 'en' ? 'en' : 'ar';
  }
  return DEFAULT_LOCALE;
}

export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
