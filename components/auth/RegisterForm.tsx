'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { dictionary } from '@/lib/i18n/dictionary'
import type { Locale } from '@/lib/i18n/config'

export function RegisterForm({ locale }: { locale: Locale }) {
  const t = dictionary[locale]
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Note: only full_name is passed in metadata. Role is intentionally
    // omitted — the database trigger always creates 'student' accounts on
    // public signup, regardless of what a client sends. See
    // supabase/schema.sql -> handle_new_user().
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (signUpError) {
      const msg = signUpError.message.toLowerCase()
      setError(
        msg.includes('already registered') || msg.includes('already exists')
          ? t.auth.emailInUse
          : msg.includes('password')
            ? t.auth.weakPassword
            : t.common.error
      )
      setLoading(false)
      return
    }

    // If email confirmation is required in this Supabase project, there
    // will be no session yet — show a "check your email" message instead
    // of redirecting to a dashboard the user can't access.
    if (!data.session) {
      setNeedsEmailConfirm(true)
      setLoading(false)
      return
    }

    router.push('/dashboard/student')
    router.refresh()
  }

  if (needsEmailConfirm) {
    return (
      <div className="card p-6 text-center">
        <p className="font-medium text-sidr-900">{t.auth.checkEmail}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="fullName" className="mb-1.5 block text-sm font-semibold text-sidr-900">
          {t.auth.fullName}
        </label>
        <input
          id="fullName"
          type="text"
          required
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="input-field"
        />
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-sidr-900">
          {t.auth.email}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          dir="ltr"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-sidr-900">
          {t.auth.password}
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field"
          dir="ltr"
        />
      </div>

      {error && <p className="text-danger text-sm font-medium">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? t.common.loading : t.auth.registerCta}
      </button>
    </form>
  )
}

