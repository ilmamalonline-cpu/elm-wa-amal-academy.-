'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CONSENT_VERSION, OWNER_EMAIL, normalizeEmail, type Locale } from '@/lib/academy/domain'

export function RegisterForm({ locale }: { locale: Locale }) {
  const ar = locale === 'ar'
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    const supabase = createClient()
    const cleanEmail = normalizeEmail(email)
    const callback = new URL('/auth/callback', window.location.origin)
    callback.searchParams.set('next', '/dashboard')
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { display_name: name.trim(), locale, consent_version: CONSENT_VERSION }, emailRedirectTo: callback.toString() },
    })
    if (signUpError) {
      const text = signUpError.message.toLowerCase()
      setError(text.includes('owner_only') || text.includes('registration_owner_only')
        ? (ar ? 'التسجيل في هذه المعاينة متاح لبريد المالك فقط.' : 'Registration in this preview is limited to the owner email.')
        : text.includes('already registered') || text.includes('already exists')
          ? (ar ? 'هذا البريد مسجّل بالفعل. جرّب تسجيل الدخول.' : 'This email is already registered. Try signing in.')
          : (ar ? 'تعذّر إنشاء الحساب. راجع البيانات وحاول مرة أخرى.' : 'Account creation failed. Check the details and try again.'))
      setBusy(false)
      return
    }
    if (!data.session || !data.user) {
      setMessage(ar ? 'تحقّق من بريدك لتأكيد الحساب، ثم سجّل الدخول لإكمال ملف الأسرة.' : 'Check your email to confirm the account, then sign in to finish the family profile.')
      setBusy(false)
      return
    }
    const { error: guardianError } = await supabase.from('academy_guardians').upsert({
      id: data.user.id,
      display_name: name.trim(),
      locale,
      consent_version: CONSENT_VERSION,
      consented_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (guardianError) {
      setError(ar ? 'تم إنشاء الحساب، لكن لم يكتمل ملف وليّ الأمر. سجّل الدخول وحاول مجددًا.' : 'Account created, but the guardian profile did not finish. Sign in and try again.')
      setBusy(false)
      return
    }
    const adminLookup = await supabase.from('academy_admins').select('id').eq('id', data.user.id).maybeSingle()
    if (!adminLookup.data && cleanEmail === OWNER_EMAIL) {
      await supabase.from('academy_admins').insert({ id: data.user.id })
    }
    router.replace('/dashboard')
    router.refresh()
  }

  return <form onSubmit={handleSubmit} className="space-y-5">
    {process.env.NEXT_PUBLIC_ACADEMY_PREVIEW === 'true' && <p className="rounded-xl border border-gold-300 bg-gold-100 p-3 text-sm leading-6 text-gold-700">{ar ? 'بيئة معاينة خاصة: التسجيل الحقيقي مقيّد ببريد المالك.' : 'Private preview: real sign-up is limited to the owner email.'}</p>}
    <div><label htmlFor="guardian-name" className="mb-1.5 block text-sm font-semibold text-sidr-900">{ar ? 'اسم وليّ الأمر' : 'Guardian name'}</label><input id="guardian-name" className="input-field" autoComplete="name" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></div>
    <div><label htmlFor="guardian-email" className="mb-1.5 block text-sm font-semibold text-sidr-900">{ar ? 'البريد الإلكتروني' : 'Email address'}</label><input id="guardian-email" className="input-field" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
    <div><label htmlFor="guardian-password" className="mb-1.5 block text-sm font-semibold text-sidr-900">{ar ? 'كلمة المرور (8 أحرف على الأقل)' : 'Password (at least 8 characters)'}</label><input id="guardian-password" className="input-field" type="password" dir="ltr" minLength={8} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
    <label className="flex items-start gap-3 rounded-xl border border-mist-dark bg-parchment p-4 text-sm leading-6 text-ink-soft"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-sidr-700" /><span>{ar ? 'أوافق على إنشاء حساب وليّ أمر واستخدام بيانات الأسرة لإدارة الملفات والمواعيد ونتائج الجلسات.' : 'I agree to create a guardian account and use family data to manage profiles, schedules and session outcomes.'}</span></label>
    {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-sidr-50 px-3 py-2 text-sm leading-6 text-sidr-700">{message}</p>}
    <button className="btn-primary w-full" disabled={busy || !consent} type="submit">{busy ? (ar ? 'جارٍ إنشاء الحساب…' : 'Creating account…') : (ar ? 'إنشاء حساب وليّ الأمر' : 'Create guardian account')}</button>
    <p className="text-center text-xs leading-5 text-ink-soft">{ar ? 'الأطفال لا ينشئون حسابات ولا يسجّلون الدخول بأنفسهم.' : 'Children do not create accounts or sign in independently.'}</p>
  </form>
}
