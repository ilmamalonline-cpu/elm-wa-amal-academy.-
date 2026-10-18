import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/types/database'

/**
 * Server-side helper for dashboard layouts: returns the signed-in user's
 * profile row, or redirects.
 *
 * proxy.ts already gates unauthenticated access, deactivated accounts and
 * cross-role access to /dashboard/*, but layouts are the last line of
 * defense, so this re-checks them. Pass the role the layout is for
 * (e.g. 'admin') and anyone else is sent to their own dashboard.
 */
export async function getProfileOrRedirect(expectedRole?: UserRole): Promise<Profile> {
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

  // proxy.ts signs suspended users out when it sees this redirect.
  if (profile.is_active === false) {
    redirect('/login?deactivated=1')
  }

  if (expectedRole && profile.role !== expectedRole) {
    redirect(`/dashboard/${profile.role}`)
  }

  return profile
}
