import Link from 'next/link'
import { getLocale } from '@/lib/i18n/server'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default async function RegisterPage() {
  const locale = await getLocale()
  const ar = locale === 'ar'
  return <main className="flex min-h-screen items-center justify-center bg-parchment px-4 py-10"><div className="w-full max-w-xl"><div className="mb-5 flex justify-end"><LanguageToggle locale={locale} /></div><div className="card overflow-hidden"><div className="bg-sidr-900 px-7 py-8 text-white sm:px-10"><span className="badge-gold">{ar ? 'حساب الأسرة' : 'Family account'}</span><h1 className="mt-4 font-display text-3xl font-bold">{ar ? 'إنشاء حساب وليّ أمر' : 'Create a guardian account'}</h1><p className="mt-2 leading-7 text-white/75">{ar ? 'وليّ الأمر وحده يسجّل الدخول ويدير ملفات أطفاله.' : 'Only the guardian signs in and manages child profiles.'}</p></div><div className="p-7 sm:p-10"><RegisterForm locale={locale} /></div></div><p className="mt-5 text-center text-sm text-ink-soft">{ar ? 'لديك حساب؟' : 'Already have an account?'} <Link href="/login" className="font-bold text-sidr-700 underline decoration-gold-500 underline-offset-4">{ar ? 'سجّل الدخول' : 'Sign in'}</Link></p></div></main>
}
