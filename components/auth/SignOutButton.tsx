'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Locale } from '@/lib/academy/domain'

export function SignOutButton({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      className="btn-secondary px-3 py-2 text-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await createClient().auth.signOut()
        router.replace('/login')
        router.refresh()
      }}
    >
      {busy ? (locale === 'ar' ? 'جارٍ الخروج…' : 'Signing out…') : (locale === 'ar' ? 'تسجيل الخروج' : 'Sign out')}
    </button>
  )
}
