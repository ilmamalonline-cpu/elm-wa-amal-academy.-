import Link from 'next/link'
import { getLocale } from '@/lib/i18n/server'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { LoginForm } from '@/components/auth/LoginForm'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const locale = await getLocale()
  const ar = locale === 'ar'
  const params = await searchParams
  const confirmationError = params.error === 'confirmation'

  return <main className="flex min-h-screen items-center justify-center bg-parchment px-4 py-10">
    <div className="w-full max-w-md">
      <div className="mb-5 flex justify-end"><LanguageToggle locale={locale} /></div>
      <div className="card overflow-hidden">
        <div className="h-2 bg-gradient-to-l from-gold-500 via-gold-300 to-sidr-700" />
        <div className="p-7 sm:p-9">
          <p className="badge-gold">{ar ? 'مرحبًا بعودتك' : 'Welcome back'}</p>
          <h1 className="mt-4 font-display text-3xl font-bold text-sidr-900">{ar ? 'تسجيل الدخول' : 'Sign in'}</h1>
          {confirmationError && <p role="alert" className="mt-5 rounded-lg bg-danger/10 px-3 py-2 text-sm leading-6 text-danger">{ar ? 'تعذّر تأكيد الرابط؛ قد يكون منتهي الصلاحية أو مستخدمًا. اطلب رسالة تأكيد جديدة ثم أعد المحاولة.' : 'The confirmation link could not be verified. It may have expired or already been used. Request a new confirmation email and try again.'}</p>}
          <div className="mt-7"><LoginForm locale={locale} /></div>
        </div>
      </div>
      <p className="mt-5 text-center text-sm text-ink-soft">{ar ? 'لا تملك حسابًا؟' : 'New to the academy?'} <Link href="/register" className="font-bold text-sidr-700 underline decoration-gold-500 underline-offset-4">{ar ? 'إنشاء حساب وليّ أمر' : 'Create a guardian account'}</Link></p>
    </div>
  </main>
}
