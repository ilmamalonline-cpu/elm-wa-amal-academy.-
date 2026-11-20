import Link from 'next/link'
import { getLocale } from '@/lib/i18n/server'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { TeacherInviteForm } from '@/components/auth/TeacherInviteForm'

export default async function TeacherInvitePage({ searchParams }: { searchParams: Promise<{ confirmed?: string }> }) {
  const locale = await getLocale()
  const ar = locale === 'ar'
  const params = await searchParams
  const emailConfirmed = params.confirmed === '1'

  return <main className="flex min-h-screen items-center justify-center bg-parchment px-4 py-10">
    <div className="w-full max-w-xl">
      <div className="mb-5 flex justify-end"><LanguageToggle locale={locale} /></div>
      <div className="card overflow-hidden">
        <div className="h-2 bg-gradient-to-l from-gold-500 via-gold-300 to-sidr-700" />
        <div className="p-7 sm:p-10">
          <span className="badge-gold">{ar ? 'دعوة خاصة للمعلم' : 'Private teacher invitation'}</span>
          <h1 className="mt-4 font-display text-3xl font-bold text-sidr-900">{ar ? 'تفعيل حساب المعلم' : 'Activate a teacher account'}</h1>
          <p className="mt-3 leading-7 text-ink-soft">{ar ? 'الدعوة لمرة واحدة ومربوطة بالبريد الذي أدخله مسؤول الأكاديمية. المنصة لا ترسلها بالبريد؛ يمكن للمسؤول نسخ الرابط وإرساله بنفسه.' : 'This invitation is single-use and bound to the email entered by the academy administrator. The platform does not email it; the administrator can copy and forward the link.'}</p>
          <div className="mt-7"><TeacherInviteForm locale={locale} emailConfirmed={emailConfirmed} /></div>
        </div>
      </div>
      <p className="mt-5 text-center text-sm text-ink-soft"><Link href="/login" className="font-bold text-sidr-700 underline decoration-gold-500 underline-offset-4">{ar ? 'لديك حساب بالفعل؟ سجّل الدخول ثم افتح رابط الدعوة مجددًا.' : 'Already registered? Sign in, then reopen this invitation link.'}</Link></p>
    </div>
  </main>
}
