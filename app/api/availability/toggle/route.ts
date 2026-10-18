// app/api/availability/toggle/route.ts
//
// Lets a teacher open ("open") or close ("close") a single hour block on
// their weekly grid.
//
// open:  validates the input, refuses slots that have already started, and —
//        if that exact day/time is already committed to an active recurring
//        subscription — creates the slot already booked so the teacher can't
//        double-promise the hour. Re-opening a previously closed slot
//        re-uses its row (see close).
// close: refuses if the slot is booked. A slot that never had a booking is
//        deleted; one that did (even a cancelled one) can't be deleted
//        because bookings.availability_slot_id is `on delete restrict`, so it
//        is soft-closed (is_closed = true) instead.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addDaysToDateKey, isOccurringOnDate, msUntil } from '@/lib/utils/datetime'
import type { SessionType } from '@/types/database'

interface ToggleBody {
  action?: unknown
  week_start_date?: unknown
  day_of_week?: unknown
  start_time?: unknown
  end_time?: unknown
  session_type?: unknown
  max_students_group?: unknown
  slot_id?: unknown
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/** '06:00' -> '06:00:00' so string comparison and DB equality both work. */
function normalizeTime(t: string): string {
  return t.length === 5 ? `${t}:00` : t
}

/** true only for a real calendar date that falls on a Sunday. */
function isSunday(dateKey: string): boolean {
  const d = new Date(`${dateKey}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateKey && d.getUTCDay() === 0
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (profile?.role !== 'teacher' || profile.is_active === false) {
    return NextResponse.json({ error: 'NOT_A_TEACHER' }, { status: 403 })
  }

  let body: ToggleBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  // ------------------------------------------------------------------ close
  if (body.action === 'close') {
    if (typeof body.slot_id !== 'string' || !UUID_RE.test(body.slot_id)) {
      return NextResponse.json({ error: 'MISSING_SLOT_ID' }, { status: 400 })
    }

    const { data: slot } = await supabase
      .from('teacher_availability')
      .select('id, is_booked')
      .eq('id', body.slot_id)
      .eq('teacher_id', user.id)
      .maybeSingle()
    if (!slot) return NextResponse.json({ error: 'SLOT_NOT_FOUND' }, { status: 404 })

    const { data: active } = await supabase
      .from('bookings')
      .select('id')
      .eq('availability_slot_id', slot.id)
      .eq('status', 'confirmed')
      .limit(1)
    if (slot.is_booked || (active && active.length > 0)) {
      return NextResponse.json({ error: 'SLOT_HAS_ACTIVE_BOOKING' }, { status: 409 })
    }

    const { error: deleteError } = await supabase.from('teacher_availability').delete().eq('id', slot.id)
    if (!deleteError) return NextResponse.json({ success: true, softClosed: false })

    const isRestricted = deleteError.code === '23503' || deleteError.message.toLowerCase().includes('foreign key')
    if (!isRestricted) return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })

    // The slot has booking history (cancelled/completed) — keep the row, hide it.
    const { data: closed, error: closeError } = await supabase
      .from('teacher_availability')
      .update({ is_closed: true, is_booked: false })
      .eq('id', slot.id)
      .select()
      .single()
    if (closeError) return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })
    return NextResponse.json({ success: true, softClosed: true, slot: closed })
  }

  if (body.action !== 'open') {
    return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
  }

  // ------------------------------------------------------------------- open
  if (
    typeof body.week_start_date !== 'string' ||
    typeof body.start_time !== 'string' ||
    typeof body.end_time !== 'string' ||
    typeof body.day_of_week !== 'number'
  ) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }

  const weekStart = body.week_start_date
  const day = body.day_of_week
  if (!DATE_RE.test(weekStart) || !isSunday(weekStart) || !Number.isInteger(day) || day < 0 || day > 6) {
    return NextResponse.json({ error: 'INVALID_FIELDS' }, { status: 400 })
  }
  if (!TIME_RE.test(body.start_time) || !TIME_RE.test(body.end_time)) {
    return NextResponse.json({ error: 'INVALID_FIELDS' }, { status: 400 })
  }
  const startTime = normalizeTime(body.start_time)
  const endTime = normalizeTime(body.end_time)
  if (endTime <= startTime) {
    return NextResponse.json({ error: 'INVALID_FIELDS' }, { status: 400 })
  }

  const sessionType: SessionType = body.session_type === 'group' ? 'group' : 'individual'
  let maxGroup = 1
  if (sessionType === 'group') {
    const n = body.max_students_group
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 2 || n > 50) {
      return NextResponse.json({ error: 'INVALID_FIELDS' }, { status: 400 })
    }
    maxGroup = n
  }

  // Slot times are Cairo wall-clock; you can't open a slot that already started.
  const slotDate = addDaysToDateKey(weekStart, day)
  if (msUntil(slotDate, startTime) <= 0) {
    return NextResponse.json({ error: 'SLOT_IN_PAST' }, { status: 400 })
  }

  // Is this exact day/time already committed to an active recurring subscription?
  const { data: candidates } = await supabase
    .from('bookings')
    .select('scheduled_date, is_recurring, recurrence_end_date, recurrence_pattern')
    .eq('teacher_id', user.id)
    .eq('day_of_week', day)
    .eq('time_slot', startTime)
    .eq('is_recurring', true)
    .eq('status', 'confirmed')
    .lte('scheduled_date', slotDate)
  const lockedByRecurringStudent = (candidates ?? []).some((b) => isOccurringOnDate(b, slotDate))

  const { data: existing } = await supabase
    .from('teacher_availability')
    .select('id, is_closed')
    .eq('teacher_id', user.id)
    .eq('week_start_date', weekStart)
    .eq('day_of_week', day)
    .eq('start_time', startTime)
    .maybeSingle()

  if (existing) {
    if (!existing.is_closed) return NextResponse.json({ error: 'SLOT_ALREADY_EXISTS' }, { status: 409 })

    // Re-open a soft-closed slot.
    const { data: reopened, error: reopenError } = await supabase
      .from('teacher_availability')
      .update({
        is_closed: false,
        is_booked: lockedByRecurringStudent,
        session_type: sessionType,
        max_students_group: maxGroup,
        end_time: endTime,
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (reopenError) return NextResponse.json({ error: 'INSERT_FAILED' }, { status: 500 })
    return NextResponse.json({ slot: reopened, lockedByRecurringStudent })
  }

  const { data: slot, error: insertError } = await supabase
    .from('teacher_availability')
    .insert({
      teacher_id: user.id,
      week_start_date: weekStart,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      session_type: sessionType,
      max_students_group: maxGroup,
      is_booked: lockedByRecurringStudent,
    })
    .select()
    .single()

  if (insertError) {
    const isDuplicate = insertError.code === '23505' || insertError.message.toLowerCase().includes('duplicate')
    return NextResponse.json(
      { error: isDuplicate ? 'SLOT_ALREADY_EXISTS' : 'INSERT_FAILED' },
      { status: isDuplicate ? 409 : 500 }
    )
  }

  return NextResponse.json({ slot, lockedByRecurringStudent })
}
