// app/api/admin/users/route.ts
//
// Admin-only. Creates teacher accounts directly (no self-registration for
// teachers — see RegisterForm.tsx, which always creates students), lists,
// suspends/activates, and deletes users.
//
// Create flow: create the auth user via the admin client (service role) with
// email_confirm: true so the teacher can log in immediately, which the
// handle_new_user trigger turns into a 'student' profile row — then this
// route promotes that row to 'teacher' in the same request.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/types/database'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLES: UserRole[] = ['admin', 'teacher', 'student']

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401 as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin' || profile.is_active === false) {
    return { ok: false as const, status: 403 as const }
  }

  return { ok: true as const, userId: user.id }
}

export async function GET() {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: check.status })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'LOAD_FAILED' }, { status: 500 })
  return NextResponse.json({ users: data })
}

export async function POST(request: Request) {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: check.status })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''

  if (!email || !password || !fullName) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'WEAK_PASSWORD' }, { status: 400 })
  }

  let price: number | null = null
  if (body.price_per_session !== undefined && body.price_per_session !== null) {
    if (typeof body.price_per_session !== 'number' || !Number.isFinite(body.price_per_session) || body.price_per_session < 0) {
      return NextResponse.json({ error: 'INVALID_PRICE' }, { status: 400 })
    }
    price = body.price_per_session
  }
  const bio = typeof body.bio === 'string' && body.bio.trim() ? body.bio.trim().slice(0, 2000) : null

  const admin = createAdminClient()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !created.user) {
    const isDuplicate = createError?.message.toLowerCase().includes('already')
    return NextResponse.json(
      { error: isDuplicate ? 'EMAIL_IN_USE' : 'CREATE_FAILED' },
      { status: isDuplicate ? 409 : 500 }
    )
  }

  // The handle_new_user trigger already inserted a 'student' profile row for
  // this id — promote it to 'teacher' and fill in teacher-only fields.
  const { data: profile, error: updateError } = await admin
    .from('profiles')
    .update({ role: 'teacher', bio, price_per_session: price })
    .eq('id', created.user.id)
    .select()
    .single()

  if (updateError) {
    // Roll back the orphaned auth user rather than leaving a stuck
    // student-role account with no way to become a teacher through the UI.
    await admin.auth.admin.deleteUser(created.user.id)
    console.error('Promoting new user to teacher failed:', updateError)
    return NextResponse.json({ error: 'CREATE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ user: profile })
}

export async function PATCH(request: Request) {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: check.status })

  let body: { user_id?: unknown; is_active?: unknown; role?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  if (typeof body.user_id !== 'string' || !UUID_RE.test(body.user_id)) {
    return NextResponse.json({ error: 'MISSING_USER_ID' }, { status: 400 })
  }

  const updates: { is_active?: boolean; role?: UserRole } = {}
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
  if (body.role !== undefined) {
    if (typeof body.role !== 'string' || !ROLES.includes(body.role as UserRole)) {
      return NextResponse.json({ error: 'INVALID_ROLE' }, { status: 400 })
    }
    updates.role = body.role as UserRole
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'NOTHING_TO_UPDATE' }, { status: 400 })
  }

  // An admin can't lock themselves out by suspending or demoting their own account.
  if (body.user_id === check.userId) {
    return NextResponse.json({ error: 'CANNOT_MODIFY_SELF' }, { status: 400 })
  }

  // Uses the caller's own (admin) session — profiles_update_admin RLS allows
  // this, and the profiles guard trigger re-checks that the caller is an admin.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', body.user_id)
    .select()
    .single()

  if (error) {
    console.error('Admin profile update failed:', error)
    return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 })
  }
  return NextResponse.json({ user: data })
}

export async function DELETE(request: Request) {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: check.status })

  const userId = new URL(request.url).searchParams.get('user_id')
  if (!userId || !UUID_RE.test(userId)) return NextResponse.json({ error: 'MISSING_USER_ID' }, { status: 400 })
  if (userId === check.userId) return NextResponse.json({ error: 'CANNOT_MODIFY_SELF' }, { status: 400 })

  const admin = createAdminClient()

  const { data: target } = await admin.from('profiles').select('id, role').eq('id', userId).maybeSingle()
  if (!target) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })
  if (target.role === 'admin') {
    // Demote first (PATCH role) — deleting an admin in one click is too easy to do by mistake.
    return NextResponse.json({ error: 'CANNOT_DELETE_ADMIN' }, { status: 409 })
  }

  // bookings.availability_slot_id is `on delete restrict`, so deleting a TEACHER
  // who has bookings would be blocked at the slot rows. Remove their bookings
  // first. Deleting a STUDENT cascades their bookings, but would leave those
  // slots flagged is_booked forever — so free them.
  if (target.role === 'teacher') {
    const { error } = await admin.from('bookings').delete().eq('teacher_id', userId)
    if (error) {
      console.error('Deleting teacher bookings failed:', error)
      return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })
    }
  } else {
    const { data: theirBookings } = await admin
      .from('bookings')
      .select('availability_slot_id')
      .eq('student_id', userId)
      .eq('status', 'confirmed')
    const slotIds = [...new Set((theirBookings ?? []).map((b) => b.availability_slot_id))]
    const { error } = await admin.from('bookings').delete().eq('student_id', userId)
    if (error) {
      console.error('Deleting student bookings failed:', error)
      return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })
    }
    if (slotIds.length > 0) {
      await admin.from('teacher_availability').update({ is_booked: false }).in('id', slotIds)
    }
  }

  // `profiles.id references auth.users(id) on delete cascade` removes the profile row.
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    console.error('Deleting auth user failed:', error)
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
