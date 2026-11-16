import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type PortalRole = 'admin' | 'teacher' | 'guardian'

export async function getPortalRole(): Promise<{ role: PortalRole; user: User }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: admin } = await supabase.from('academy_admins').select('id').eq('id', user.id).maybeSingle()
  if (admin) return { role: 'admin', user }

  const { data: teacher } = await supabase.from('academy_teachers').select('id').eq('id', user.id).eq('status', 'active').maybeSingle()
  return { role: teacher ? 'teacher' : 'guardian', user }
}
