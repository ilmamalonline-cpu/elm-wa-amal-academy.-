// app/api/bookings/create/route.ts
//
// Single entry point for "Confirm & Subscribe". In order:
// 1. Atomically claim the availability slot and insert the booking row via
//    the book_slot() RPC (row-locked in Postgres, validated: not in the
//    past, not already yours, recurrence sane, accounts active).
// 2. Create a REAL Zoom meeting (or, for a group slot that already has one,
//    reuse it so every student in the group joins the SAME meeting).
// 3. Attach the Zoom meeting id + join URL to the booking row.
//
// If anything after step 1 fails, the booking is cancelled through the
// user's own session (cancel_booking RPC) — which also frees the slot — so
// nobody is left with a "confirmed" session that has no working link.
// Everything after step 1 is inside ONE try/catch (previously
// createAdminClient() sat outside it, so a missing service key left a
// confirmed booking with no Zoom link and no rollback).
//
// The host (start) link is never stored or returned: teachers get a fresh
// one on demand from /api/bookings/start.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createZoomMeeting, deleteZoomMeeting, ZoomApiError } from '@/lib/zoom/client'
import { cairoWallTimeToUtcIso } from '@/lib/utils/datetime'
import { getLocale } from '@/lib/i18n/server'
import { dictionary } from '@/lib/i18n/dictionary'
import type { RecurrencePattern } from '@/types/database'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

interface CreateBookingBody {
  slot_id?: unknown
  recurring?: unknown
  recurrence_pattern?: unknown
  recurrence_end_date?: unknown
}

export async function POST(request: Request) {
  const locale = await getLocale()
  const t = dictionary[locale].booking

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: t.unauthenticated }, { status: 401 })
  }

  let body: CreateBookingBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  // ---- validate input (the DB validates again; this gives clean 400s) ----
  if (typeof body.slot_id !== 'string' || !UUID_RE.test(body.slot_id)) {
    return NextResponse.json({ error: 'MISSING_SLOT_ID' }, { status: 400 })
  }
  const recurring = body.recurring === true
  let pattern: RecurrencePattern = 'none'
  let endDate: string | null = null
  if (recurring) {
    if (body.recurrence_pattern !== 'weekly' && body.recurrence_pattern !== 'biweekly') {
      return NextResponse.json({ error: t.invalidRecurrence }, { status: 400 })
    }
    pattern = body.recurrence_pattern
    // The date <input> can be cleared, which sends '' — treat that as missing.
    if (typeof body.recurrence_end_date !== 'string' || !DATE_RE.test(body.recurrence_end_date)) {
      return NextResponse.json({ error: t.invalidRecurrence }, { status: 400 })
    }
    endDate = body.recurrence_end_date
  }

  // ---- Step 1: atomically claim the slot + create the booking row ----
  const { data: booking, error: bookError } = await supabase.rpc('book_slot', {
    p_slot_id: body.slot_id,
    p_recurring: recurring,
    p_recurrence_pattern: pattern,
    p_recurrence_end_date: endDate,
  })

  if (bookError || !booking) {
    const message = bookError?.message ?? ''
    if (message.includes('SLOT_ALREADY_BOOKED')) return NextResponse.json({ error: t.slotTaken }, { status: 409 })
    if (message.includes('SLOT_FULL')) return NextResponse.json({ error: t.slotFull }, { status: 409 })
    if (message.includes('ALREADY_BOOKED_BY_YOU')) return NextResponse.json({ error: t.alreadyBooked }, { status: 409 })
    if (message.includes('SLOT_NOT_FOUND')) return NextResponse.json({ error: t.notFound }, { status: 404 })
    if (message.includes('SLOT_IN_PAST')) return NextResponse.json({ error: t.slotInPast }, { status: 409 })
    if (message.includes('INVALID_RECURRENCE')) return NextResponse.json({ error: t.invalidRecurrence }, { status: 400 })
    if (message.includes('ACCOUNT_DISABLED')) return NextResponse.json({ error: t.accountDisabled }, { status: 403 })
    if (message.includes('NOT_AUTHENTICATED')) return NextResponse.json({ error: t.unauthenticated }, { status: 401 })
    console.error('book_slot RPC failed:', bookError)
    return NextResponse.json({ error: dictionary[locale].common.error }, { status: 500 })
  }

  // ---- Steps 2 & 3: Zoom meeting + attach, or roll back ----
  let createdMeetingId: string | null = null
  try {
    const admin = createAdminClient()

    // Group slot: if a classmate already has a meeting for this slot, join the same one.
    let zoomMeetingId: string | null = null
    let zoomJoinUrl: string | null = null

    if (booking.session_type === 'group') {
      const { data: sibling } = await admin
        .from('bookings')
        .select('zoom_meeting_id, zoom_join_url')
        .eq('availability_slot_id', booking.availability_slot_id)
        .eq('status', 'confirmed')
        .neq('id', booking.id)
        .not('zoom_meeting_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (sibling?.zoom_meeting_id && sibling.zoom_join_url) {
        zoomMeetingId = sibling.zoom_meeting_id
        zoomJoinUrl = sibling.zoom_join_url
      }
    }

    if (!zoomMeetingId) {
      const [{ data: teacher }, { data: student }] = await Promise.all([
        admin.from('profiles').select('full_name').eq('id', booking.teacher_id).single(),
        admin.from('profiles').select('full_name').eq('id', booking.student_id).single(),
      ])

      const topic =
        booking.session_type === 'group'
          ? `أكاديمية علم وعمل | ${teacher?.full_name ?? 'معلم'} — جلسة جماعية`
          : `أكاديمية علم وعمل | ${teacher?.full_name ?? 'معلم'} × ${student?.full_name ?? 'طالب'}`

      const zoomMeeting = await createZoomMeeting({
        topic,
        startTimeIso: cairoWallTimeToUtcIso(booking.scheduled_date, booking.time_slot),
        durationMinutes: booking.duration_minutes,
        agenda: 'جلسة تصحيح نطق وتلاوة — أكاديمية علم وعمل',
        recurrence:
          booking.is_recurring && booking.recurrence_end_date && booking.recurrence_pattern !== 'none'
            ? {
                pattern: booking.recurrence_pattern as 'weekly' | 'biweekly',
                dayOfWeek: booking.day_of_week,
                endDate: booking.recurrence_end_date,
              }
            : undefined,
      })
      createdMeetingId = String(zoomMeeting.id)
      zoomMeetingId = createdMeetingId
      zoomJoinUrl = zoomMeeting.joinUrl
    }

    const { data: updatedBooking, error: updateError } = await admin
      .from('bookings')
      .update({ zoom_meeting_id: zoomMeetingId, zoom_join_url: zoomJoinUrl })
      .eq('id', booking.id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ booking: updatedBooking, message: t.confirmed })
  } catch (err) {
    if (err instanceof ZoomApiError) {
      console.error('Zoom meeting creation failed:', err.message, 'status:', err.status, 'zoomCode:', err.zoomCode)
    } else {
      console.error('Unexpected error while creating/attaching the Zoom meeting:', err)
    }

    // Don't leave an orphaned meeting behind if we created one this request.
    if (createdMeetingId) {
      await deleteZoomMeeting(createdMeetingId).catch((e) => console.error('Zoom cleanup failed:', e))
    }

    // Roll back through the user's own session: cancels the booking AND frees the slot.
    const { error: rollbackError } = await supabase.rpc('cancel_booking', { p_booking_id: booking.id })
    if (rollbackError) {
      console.error('Rollback via cancel_booking failed:', rollbackError)
      // Last resort: try the service role (may itself be what's misconfigured).
      try {
        const admin = createAdminClient()
        await admin.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)
        await admin.from('teacher_availability').update({ is_booked: false }).eq('id', booking.availability_slot_id)
      } catch (adminErr) {
        console.error('Admin rollback failed too — booking', booking.id, 'needs manual cleanup:', adminErr)
      }
    }

    return NextResponse.json({ error: t.zoomFailed }, { status: 502 })
  }
}
