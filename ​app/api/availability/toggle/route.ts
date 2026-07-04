// app/api/availability/toggle/route.ts
//
// Lets a teacher open ("add") or close ("remove") a single hour block on
// their weekly grid. Before opening a slot, checks whether that exact
// teacher + day_of_week + start_time is already committed to an active
// recurring subscription (see book_slot's "is_recurring" flow) — if so,
// the slot is created already booked so the teacher can't double-promise
// that hour to a second student.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SessionType } from '@/types/database'

interface ToggleBody {
  action: 'open' | 'close'
  week_start_date: string
  day_of_week: number
  start_time: string
  end_time: string
  session_type?: SessionType
  max_students_group?: number
  slot_id?: string // required for 'close'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'teacher') {
    return NextResponse.json({ error: 'NOT_A_TEACHER' }, { status: 403 })
  }

  let body: ToggleBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  if (body.action === 'close') {
    if (!body.slot_id) {
      return NextResponse.json({ error: 'MISSING_SLOT_ID' }, { status: 400 })
    }
    // RLS (availability_owner_all) already scopes this delete to rows
    // where teacher_id = auth.uid(), and the booking's FK is `on delete
    // restrict`, so this will fail loudly instead of silently orphaning
    // an active booking if the slot is already taken.
    const { error } = await supabase.from('teacher_availability').delete().eq('id', body.slot_id)
    if (error) {
      const isRestricted = error.message.toLowerCase().includes('foreign key')
      return NextResponse.json(
        { error: isRestricted ? 'SLOT_HAS_ACTIVE_BOOKING' : 'DELETE_FAILED' },
        { status: isRestricted ? 409 : 500 }
      )
    }
    return NextResponse.json({ success: true })
  }

  // ---- action === 'open' ----
  if (!body.week_start_date || body.day_of_week === undefined || !body.start_time || !body.end_time) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }

  // Check for a standing recurring commitment at this exact day/time —
  // if one exists and is still active as of this week, the new slot must
  // be created pre-booked rather than open.
  const { data: recurringMatch } = await supabase
    .from('bookings')
    .select('id, recurrence_end_date')
    .eq('teacher_id', user.id)
    .eq('day_of_week', body.day_of_week)
    .eq('time_slot', body.start_time)
    .eq('is_recurring', true)
    .eq('status', 'confirmed')
    .is('parent_booking_id', null)
    .gte('recurrence_end_date', body.week_start_date)
    .maybeSingle()

  const { data: slot, error: insertError } = await supabase
    .from('teacher_availability')
    .insert({
      teacher_id: user.id,
      week_start_date: body.week_start_date,
      day_of_week: body.day_of_week,
      start_time: body.start_time,
      end_time: body.end_time,
      session_type: body.session_type ?? 'individual',
      max_students_group: body.max_students_group ?? 1,
      is_booked: !!recurringMatch,
    })
    .select()
    .single()

  if (insertError) {
    const isDuplicate = insertError.message.toLowerCase().includes('duplicate')
    return NextResponse.json(
      { error: isDuplicate ? 'SLOT_ALREADY_EXISTS' : 'INSERT_FAILED' },
      { status: isDuplicate ? 409 : 500 }
    )
  }

  return NextResponse.json({ slot, lockedByRecurringStudent: !!recurringMatch })
}
