'use client'

import { useRouter } from 'next/navigation'
import { LOCALE_COOKIE, type Locale } from '@/lib/i18n/config'

export function LanguageToggle({ locale }: { locale: Locale }) {
  const router = useRouter()

  function switchTo(next: Locale) {
    if (next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000`
    router.refresh()
  }

  return (
    <div className="inline-flex items-center rounded-pill border border-sidr-700/20 p-0.5 text-sm font-medium">
      <button
        type="button"
        onClick={() => switchTo('ar')}
        aria-pressed={locale === 'ar'}
        className={`rounded-pill px-3 py-1 transition-colors ${
          locale === 'ar' ? 'bg-sidr-700 text-gold-100' : 'text-sidr-700 hover:bg-sidr-50'
        }`}
      >
        عربي
      </button>
      <button
        type="button"
        onClick={() => switchTo('en')}
        aria-pressed={locale === 'en'}
        className={`rounded-pill px-3 py-1 transition-colors ${
          locale === 'en' ? 'bg-sidr-700 text-gold-100' : 'text-sidr-700 hover:bg-sidr-50'
        }`}
      >
        EN
      </button>
    </div>
  )
}
