import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

/** * Server-side helper for dashboard layouts: returns the signed-in user's * profile row, or redirects to /login. proxy.ts already gates * unauthenticated access to /dashboard/*, so hitting the redirect here * would only happen in an edge case (e.g. the profile row itself is * missing) — but layouts should never assume the network/DB call * succeeds without checking. */
export async function getProfileOrRedirect(): Promise<Profile> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  if (!profile) {
    redirect('/login')
  }

  return profile
}
