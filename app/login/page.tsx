import Link from 'next/link'
import { Suspense } from 'react'
import { getLocale } from '@/lib/i18n/config'
import { dictionary } from '@/lib/i18n/dictionary'
import { LoginForm } from '@/components/auth/LoginForm'
import { SoundWaveMark } from '@/components/ui/SoundWaveMark'

export default async function LoginPage() {
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
            {t.auth.loginTitle}
          </h1>
          <div className="mt-6">
            <Suspense
              fallback={<div className="text-ink-soft text-center text-sm">{t.common.loading}</div>}
            >
              <LoginForm locale={locale} />
            </Suspense>
          </div>
        </div>

        <p className="text-ink-soft mt-6 text-center text-sm">
          {t.auth.noAccount}{' '}
          <Link href="/register" className="font-semibold text-sidr-700 hover:text-sidr-600">
            {t.auth.registerLink}
          </Link>
        </p>
      </div>
    </main>
  )
}
 
