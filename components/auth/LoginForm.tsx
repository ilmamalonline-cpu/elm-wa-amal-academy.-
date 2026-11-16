'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/academy/domain'

export function LoginForm({ locale }: { locale: Locale }) {
  const ar = locale === 'ar'
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error: signInError } = await createClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (signInError) {
      setError(ar ? 'البريد أو كلمة المرور غير صحيحة، أو لم يتم تأكيد البريد.' : 'Email or password is incorrect, or the email is not confirmed.')
      setBusy(false)
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  return <form onSubmit={handleSubmit} className="space-y-5">
    <div><label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-sidr-900">{ar ? 'البريد الإلكتروني' : 'Email address'}</label><input id="login-email" className="input-field" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
    <div><label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-sidr-900">{ar ? 'كلمة المرور' : 'Password'}</label><input id="login-password" className="input-field" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
    {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
    <button className="btn-primary w-full" disabled={busy} type="submit">{busy ? (ar ? 'جارٍ الدخول…' : 'Signing in…') : (ar ? 'دخول' : 'Sign in')}</button>
  </form>
}
