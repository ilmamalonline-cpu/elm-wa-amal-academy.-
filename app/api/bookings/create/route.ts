// app/api/bookings/create/route.ts
//
// This is the single entry point for "Confirm & Subscribe". It does three
// things in order, and only in order:
// 1. Atomically claim the availability slot and insert the booking row,
// via the book_slot() RPC (row-locked in Postgres — two students
// clicking the same slot at once cannot both win).
// 2. Create a REAL Zoom meeting via Server-to-Server OAuth.
// 3. Attach the Zoom join/start URLs to the booking row.
//
// If step 2 or 3 fails, the booking created in step 1 is cancelled and the
// slot is freed — a student should never end up with a "confirmed"
// session that has no working meeting link. Per the original spec,
// payment itself is fully simulated (no charge is ever attempted); the
// Zoom meeting is the one part of "Confirm & Subscribe" that is real.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createZoomMeeting, ZoomApiError } from '@/lib/zoom/client'
import { cairoWallTimeToUtcIso } from '@/lib/utils/datetime'
import { getLocale } from '@/lib/i18n/config'
import { dictionary } from '@/lib/i18n/dictionary'
import type { RecurrencePattern } from '@/types/database'

interface CreateBookingBody {
  slot_id: string
  recurring?: boolean
  recurrence_pattern?: RecurrencePattern
  recurrence_end_date?: string | null
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

  if (!body.slot_id) {
    return NextResponse.json({ error: 'MISSING_SLOT_ID' }, { status: 400 })
  }

  // ---- Step 1: atomically claim the slot + create the booking row ----
  const { data: booking, error: bookError } = await supabase.rpc('book_slot', {
    p_slot_id: body.slot_id,
    p_recurring: body.recurring ?? false,
    p_recurrence_pattern: body.recurrence_pattern ?? 'none',
    p_recurrence_end_date: body.recurrence_end_date ?? null,
  })

  if (bookError || !booking) {
    const message = bookError?.message ?? ''
    if (message.includes('SLOT_ALREADY_BOOKED')) {
      return NextResponse.json({ error: t.slotTaken }, { status: 409 })
    }
    if (message.includes('SLOT_FULL')) {
      return NextResponse.json({ error: t.slotFull }, { status: 409 })
    }
    if (message.includes('SLOT_NOT_FOUND')) {
      return NextResponse.json({ error: t.notFound }, { status: 404 })
    }
    console.error('book_slot RPC failed:', bookError)
    return NextResponse.json({ error: dictionary[locale].common.error }, { status: 500 })
  }

  // From here on we use the admin (service-role) client. The booking was
  // already created under the user's own auth context above, so RLS has
  // already done its job — this is just attaching/rolling back Zoom
  // metadata on a row we know this request legitimately just created.
  const admin = createAdminClient()

  const [{ data: teacher }, { data: student }] = await Promise.all([
    admin.from('profiles').select('full_name, email').eq('id', booking.teacher_id).single(),
    admin.from('profiles').select('full_name, email').eq('id', booking.student_id).single(),
  ])

  // ---- Step 2 & 3: create the real Zoom meeting, attach it, or roll back ----
  try {
    const zoomMeeting = await createZoomMeeting({
      topic: `أكاديمية علم وعمل | ${teacher?.full_name ?? 'معلم'} × ${student?.full_name ?? 'طالب'}`,
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

    const { data: updatedBooking, error: updateError } = await admin
      .from('bookings')
      .update({
        zoom_meeting_id: String(zoomMeeting.id),
        zoom_join_url: zoomMeeting.joinUrl,
        zoom_start_url: zoomMeeting.startUrl,
      })
      .eq('id', booking.id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ booking: updatedBooking, message: t.confirmed })
  } catch (err) {
    // Roll back: free the slot and cancel the booking so nothing is left
    // in a "confirmed but unusable" state.
    await admin
      .from('teacher_availability')
      .update({ is_booked: false })
      .eq('id', booking.availability_slot_id)
    await admin.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)

    if (err instanceof ZoomApiError) {
      console.error('Zoom meeting creation failed:', err.message, 'status:', err.status, 'zoomCode:', err.zoomCode)
    } else {
      console.error('Unexpected error while attaching Zoom details:', err)
    }

    return NextResponse.json({ error: t.zoomFailed }, { status: 502 })
  }
}
