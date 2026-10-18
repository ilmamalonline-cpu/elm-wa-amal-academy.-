'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { dictionary } from '@/lib/i18n/dictionary'
import type { Locale } from '@/lib/i18n/config'

/**
 * Only follow a `next` value that is a same-site path under /dashboard.
 * Anything else — an absolute URL ("https://evil.example"), a
 * protocol-relative one ("//evil.example"), a backslash trick — is ignored,
 * otherwise a crafted /login?next=... link would send a freshly
 * logged-in user to an attacker's site (open redirect).
 */
function safeNextPath(next: string | null): string | null {
  if (!next) return null
  try {
    // Resolve against a dummy origin: if the result leaves that origin, it
    // wasn't a plain same-site path (the URL parser also normalizes tricks
    // like "/\\evil.example" into "//evil.example", which is caught here).
    const base = 'http://localhost'
    const url = new URL(next, base)
    if (url.origin !== base) return null
    if (!url.pathname.startsWith('/dashboard')) return null
    return url.pathname + url.search
  } catch {
    return null
  }
}

export function LoginForm({ locale }: { locale: Locale }) {
  const t = dictionary[locale]
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deactivated = searchParams.get('deactivated') === '1'
  const nextPath = safeNextPath(searchParams.get('next'))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes('invalid')
          ? t.auth.invalidCredentials
          : t.common.error
      )
      setLoading(false)
      return
    }

    // Resolve the role-specific home unless a safe `next` path was given.
    let destination = nextPath || '/dashboard/student'
    if (!nextPath && data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()
      if (profile) destination = `/dashboard/${profile.role}`
    }

    router.push(destination)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {deactivated && (
        <p className="bg-danger/10 text-danger rounded-button border border-danger/20 px-4 py-3 text-sm">
          {t.auth.deactivated}
        </p>
      )}

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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field"
          dir="ltr"
        />
      </div>

      {error && <p className="text-danger text-sm font-medium">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? t.common.loading : t.auth.loginCta}
      </button>
    </form>
  )
}
