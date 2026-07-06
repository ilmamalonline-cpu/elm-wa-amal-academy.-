// app/api/admin/users/route.ts
//
// Admin-only. Creates a teacher account directly (no self-registration
// for teachers — see RegisterForm.tsx, which always creates students).
//
// Flow: create the auth user via the admin client (service role) with
// email_confirm: true so the teacher can log in immediately without
// clicking a confirmation email, which the auto-provisioning trigger
// (handle_new_user in schema.sql) turns into a 'student' profile row —
// then this route promotes that row to 'teacher' in the same request.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401 as const }

  const { data: profiles } = await supabase.from('profiles').select('role').eq('id', user.id);
const profile = profiles?.[0] as any;
  
if (!profile || profile.role !== 'admin') return { ok: false as const, status: 403 as const };

  return { ok: true as const }
}

export async function GET() {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: check.status })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

interface CreateTeacherBody {
  email: string
  password: string
  full_name: string
  bio?: string
  price_per_session?: number
}

export async function POST(request: Request) {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: check.status })

  let body: CreateTeacherBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  if (!body.email || !body.password || !body.full_name) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }
  if (body.password.length < 6) {
    return NextResponse.json({ error: 'WEAK_PASSWORD' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.full_name },
  })

  if (createError || !created.user) {
    const isDuplicate = createError?.message.toLowerCase().includes('already registered')
    return NextResponse.json(
      { error: isDuplicate ? 'EMAIL_IN_USE' : (createError?.message ?? 'CREATE_FAILED') },
      { status: isDuplicate ? 409 : 500 }
    )
  }

  // The handle_new_user trigger already inserted a 'student' profile row
  // for this id — promote it to 'teacher' and fill in teacher-only fields.
  const { data: profile, error: updateError } = await admin
    .from('profiles')
    .update({
      role: 'teacher',
      bio: body.bio ?? null,
      price_per_session: body.price_per_session ?? null,
    })
    .eq('id', created.user.id)
    .select()
    .single()

  if (updateError) {
    // Roll back the orphaned auth user rather than leaving a stuck
    // student-role account with no way to become a teacher through the UI.
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ user: profile })
}

export async function PATCH(request: Request) {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: check.status })

  let body: { user_id?: string; is_active?: boolean; role?: 'admin' | 'teacher' | 'student' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  if (!body.user_id) {
    return NextResponse.json({ error: 'MISSING_USER_ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const updates: Record<string, unknown> = {}
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
  if (body.role) updates.role = body.role

  // Uses the caller's own (admin) session — profiles_update_admin RLS
  // policy allows this, and prevent_unauthorized_role_change confirms the
  // caller really is an admin before letting the role column move.
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', body.user_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}

export async function DELETE(request: Request) {
  const check = await requireAdmin()
  if (!check.ok) return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: check.status })

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'MISSING_USER_ID' }, { status: 400 })

  const admin = createAdminClient()
  // Deletes the auth user; `profiles.id references auth.users(id) on
  // delete cascade` (see schema.sql) removes the profile row automatically.
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
