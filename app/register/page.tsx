import Link from 'next/link'
import { getLocale } from '@/lib/i18n/config'
import { dictionary } from '@/lib/i18n/dictionary'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { SoundWaveMark } from '@/components/ui/SoundWaveMark'

export default async function RegisterPage() {
  const locale = await getLocale()
  const t = dictionary[locale]

  return (
    <main className="flex min-h-screen items-center justify-center bg-parchment px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="text-sidr-700">
            <SoundWaveMark className="h-7 w-7" />
          </span>
          <span className="font-display text-lg font-bold text-sidr-900">{t.academy.name}</span>
        </Link>

        <div className="card p-8">
          <h1 className="font-display text-center text-2xl font-bold text-sidr-900">
            {t.auth.registerTitle}
          </h1>
          <div className="mt-6">
            <RegisterForm locale={locale} />
          </div>
        </div>

        <p className="text-ink-soft mt-6 text-center text-sm">
          {t.auth.hasAccount}{' '}
          <Link href="/login" className="font-semibold text-sidr-700 hover:text-sidr-600">
            {t.auth.loginLink}
          </Link>
        </p>
      </div>
    </main>
  )
}
