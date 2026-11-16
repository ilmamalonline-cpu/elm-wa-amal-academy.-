import Link from 'next/link'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { SoundWaveMark } from '@/components/ui/SoundWaveMark'
import { SignOutButton } from '@/components/auth/SignOutButton'
import type { PortalRole } from '@/lib/auth/getPortal'
import type { Locale } from '@/lib/academy/domain'

const roleNames: Record<PortalRole, Record<Locale, string>> = {
  guardian: { ar: 'حساب وليّ الأمر', en: 'Guardian portal' },
  teacher: { ar: 'حساب المعلم', en: 'Teacher portal' },
  admin: { ar: 'إدارة الأكاديمية', en: 'Academy administration' },
}

export function PortalShell({ role, locale, children }: { role: PortalRole; locale: Locale; children: React.ReactNode }) {
  const home = `/dashboard/${role}`
  return (
    <div className="min-h-screen bg-parchment">
      <header className="border-b border-mist-dark bg-white/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={home} className="flex items-center gap-3" aria-label="أكاديمية علم وعمل">
            <span className="rounded-xl bg-sidr-50 p-2 text-sidr-700"><SoundWaveMark className="h-7 w-7" /></span>
            <span>
              <span className="block font-display text-lg font-bold text-sidr-900">أكاديمية علم وعمل</span>
              <span className="block text-xs font-semibold text-gold-700">{roleNames[role][locale]}</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-gold-300 bg-gold-100 px-3 py-1 text-xs font-semibold text-gold-700 sm:inline">
              {locale === 'ar' ? 'المدفوعات تجريبية فقط' : 'Payments are simulated only'}
            </span>
            <LanguageToggle locale={locale} />
            <SignOutButton locale={locale} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-mist-dark bg-white/70 px-4 py-5 text-center text-xs text-ink-soft">
        {locale === 'ar'
          ? 'لا تُخزّن المنصة مواد القرآن أو التجويد أو نور البيان. تفاصيل Zoom يشاركها المعلم خارج المنصة.'
          : 'Quran, Tajweed and Nur al-Bayan materials stay outside the platform. Teachers share Zoom details externally.'}
      </footer>
    </div>
  )
}
