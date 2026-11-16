import Link from 'next/link'
import { getLocale } from '@/lib/i18n/server'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { LoginForm } from '@/components/auth/LoginForm'

export default async function LoginPage() {
  const locale = await getLocale()
  const ar = locale === 'ar'
  return <main className="flex min-h-screen items-center justify-center bg-parchment px-4 py-10"><div className="w-full max-w-md"><div className="mb-5 flex justify-end"><LanguageToggle locale={locale} /></div><div className="card overflow-hidden"><div className="h-2 bg-gradient-to-l from-gold-500 via-gold-300 to-sidr-700" /><div className="p-7 sm:p-9"><p className="badge-gold">{ar ? 'مرحبًا بعودتك' : 'Welcome back'}</p><h1 className="mt-4 font-display text-3xl font-bold text-sidr-900">{ar ? 'تسجيل الدخول' : 'Sign in'}</h1><div className="mt-7"><LoginForm locale={locale} /></div></div></div><p className="mt-5 text-center text-sm text-ink-soft">{ar ? 'لا تملك حسابًا؟' : 'New to the academy?'} <Link href="/register" className="font-bold text-sidr-700 underline decoration-gold-500 underline-offset-4">{ar ? 'إنشاء حساب وليّ أمر' : 'Create a guardian account'}</Link></p></div></main>
}
