import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { OWNER_EMAIL } from '@/lib/academy/domain'

export type PortalRole = 'admin' | 'teacher' | 'guardian'

export async function getPortalRole(): Promise<{ role: PortalRole; user: User }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminResult = await supabase.from('academy_admins').select('id').eq('id', user.id).maybeSingle()
  if (adminResult.error) throw new Error('Unable to resolve academy administrator access.')
  let admin = adminResult.data

  // Existing owners may already have a guardian profile and therefore never see
  // the profile-completion screen. RLS independently checks the verified owner
  // identity before permitting this idempotent insert.
  if (!admin && user.email_confirmed_at && user.email?.trim().toLowerCase() === OWNER_EMAIL) {
    const { error: bootstrapError } = await supabase.from('academy_admins').upsert(
      { id: user.id },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (bootstrapError) throw new Error('Unable to initialize owner administrator access.')
    const result = await supabase.from('academy_admins').select('id').eq('id', user.id).maybeSingle()
    if (result.error || !result.data) throw new Error('Unable to verify owner administrator access.')
    admin = result.data
  }
  if (admin) return { role: 'admin', user }

  const { data: teacher, error: teacherError } = await supabase.from('academy_teachers').select('id').eq('id', user.id).eq('status', 'active').maybeSingle()
  if (teacherError) throw new Error('Unable to resolve academy teacher access.')
  return { role: teacher ? 'teacher' : 'guardian', user }
}
