'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/academy/domain'

export function TeacherInviteForm({ locale, emailConfirmed = false }: { locale: Locale; emailConfirmed?: boolean }) {
  const ar = locale === 'ar'
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [signedInEmail, setSignedInEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const inviteToken = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
    if (inviteToken) {
      const timer = window.setTimeout(() => setToken(inviteToken), 0)
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
      void supabase.auth.getUser().then(({ data: { user } }) => setSignedInEmail(user?.email ?? ''))
      return () => window.clearTimeout(timer)
    }
    void supabase.auth.getUser().then(({ data: { user } }) => setSignedInEmail(user?.email ?? ''))
  }, [supabase])

  async function acceptInvite() {
    if (!token) { setError(ar ? 'رابط الدعوة غير صالح.' : 'This invitation link is invalid.'); return }
    setBusy(true); setError(''); setNotice('')
    const { error: acceptError } = await supabase.rpc('academy_accept_teacher_invite', { p_token: token, p_time_zone: 'Africa/Cairo' })
    if (acceptError) {
      const text = acceptError.message.toLowerCase()
      setError(text.includes('verified_email_required')
        ? (ar ? 'أكّد بريدك الإلكتروني أولًا، ثم سجّل الدخول وافتح رابط الدعوة مجددًا.' : 'Confirm your email first, then sign in and reopen this invitation link.')
        : (ar ? 'تعذّر قبول الدعوة. تأكد من البريد المستخدم وأن الرابط لم تنتهِ صلاحيته أو يُستخدم من قبل.' : 'Could not accept the invitation. Check the invited email and whether this link expired or was already used.'))
      setBusy(false); return
    }
    router.replace('/dashboard/teacher')
    router.refresh()
  }

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    const callback = new URL('/auth/callback', window.location.origin)
    callback.searchParams.set('next', '/teacher-invite?confirmed=1')
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: name.trim() }, emailRedirectTo: callback.toString() },
    })
    if (signUpError) {
      const text = signUpError.message.toLowerCase()
      setError(text.includes('already registered') || text.includes('already exists')
        ? (ar ? 'هذا البريد مسجّل بالفعل. سجّل الدخول ثم افتح رابط الدعوة مجددًا.' : 'This email is already registered. Sign in, then reopen the invitation link.')
        : (ar ? 'تعذّر إنشاء الحساب. تحقق من البريد وكلمة المرور.' : 'Could not create the account. Check the email and password.'))
      setBusy(false); return
    }
    if (!data.session) {
      setNotice(ar ? 'تحقّق من بريد الدعوة لتأكيد الحساب. بعد ذلك سجّل الدخول وافتح رابط الدعوة نفسه لقبوله.' : 'Check the invited email to confirm the account. Then sign in and reopen this same link to accept it.')
      setBusy(false); return
    }
    setSignedInEmail(data.user?.email ?? email)
    const { error: acceptError } = await supabase.rpc('academy_accept_teacher_invite', { p_token: token, p_time_zone: 'Africa/Cairo' })
    if (acceptError) {
      setError(ar ? 'تم إنشاء الحساب، لكن تعذّر قبول الدعوة. سجّل الدخول وافتح الرابط مجددًا.' : 'Account created, but the invitation could not be accepted. Sign in and reopen this link.')
      setBusy(false); return
    }
    router.replace('/dashboard/teacher')
    router.refresh()
  }

  if (!token) return emailConfirmed
    ? <p role="status" className="rounded-xl bg-sidr-50 p-4 text-sm leading-6 text-sidr-700">{ar ? 'تم تأكيد البريد. افتح رابط الدعوة الأصلي مرة أخرى لتفعيل الحساب.' : 'Your email is confirmed. Reopen the original invitation link to activate your account.'}</p>
    : <p role="alert" className="rounded-xl bg-danger/10 p-4 text-sm text-danger">{ar ? 'الرابط غير مكتمل. اطلب من مسؤول الأكاديمية رابط دعوة جديدًا.' : 'The link is incomplete. Ask the academy administrator for a new invitation.'}</p>

  if (signedInEmail) return <div className="space-y-4"><p className="rounded-xl bg-sidr-50 p-4 text-sm text-sidr-700">{ar ? 'مسجّل الدخول بالبريد:' : 'Signed in as:'} <bdi dir="ltr">{signedInEmail}</bdi></p><button className="btn-primary w-full" disabled={busy} onClick={() => void acceptInvite()}>{busy ? (ar ? 'جارٍ التفعيل…' : 'Activating…') : (ar ? 'قبول الدعوة وتفعيل حساب المعلم' : 'Accept invitation and activate teacher account')}</button>{error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}</div>

  return <form onSubmit={register} className="space-y-4"><div><label className="mb-1.5 block text-sm font-semibold text-sidr-900">{ar ? 'الاسم' : 'Name'}</label><input className="input-field" required maxLength={200} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></div><div><label className="mb-1.5 block text-sm font-semibold text-sidr-900">{ar ? 'البريد الذي استقبل الدعوة' : 'Email address that received the invitation'}</label><input className="input-field" type="email" dir="ltr" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div><label className="mb-1.5 block text-sm font-semibold text-sidr-900">{ar ? 'كلمة المرور (8 أحرف على الأقل)' : 'Password (at least 8 characters)'}</label><input className="input-field" type="password" dir="ltr" minLength={8} required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div>{error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}{notice && <p role="status" className="rounded-lg bg-sidr-50 px-3 py-2 text-sm leading-6 text-sidr-700">{notice}</p>}<button className="btn-primary w-full" disabled={busy}>{busy ? (ar ? 'جارٍ تفعيل الحساب…' : 'Activating account…') : (ar ? 'إنشاء حساب المعلم وقبول الدعوة' : 'Create teacher account and accept invitation')}</button><p className="text-center text-xs leading-5 text-ink-soft">{ar ? 'ستُفعّل الدعوة بعد تأكيد البريد، ولا يتم إرسال رابط الدعوة من المنصة.' : 'The invitation is activated after email confirmation. The platform does not send the invitation link.'} <Link href="/login" className="font-semibold text-sidr-700 underline">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></p></form>
}
