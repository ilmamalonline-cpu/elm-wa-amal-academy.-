// app/api/bookings/cancel/route.ts
//
// Cancels a booking through the cancel_booking() RPC (student, teacher or
// admin; only CONFIRMED bookings). Afterwards the Zoom meeting is deleted
// best-effort — unless a classmate in the same group slot still uses it.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteZoomMeeting } from '@/lib/zoom/client'
import { getLocale } from '@/lib/i18n/server'
import { dictionary } from '@/lib/i18n/dictionary'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  let body: { booking_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  if (typeof body.booking_id !== 'string' || !UUID_RE.test(body.booking_id)) {
    return NextResponse.json({ error: 'MISSING_BOOKING_ID' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('cancel_booking', { p_booking_id: body.booking_id })

  if (error || !data) {
    const message = error?.message ?? ''
    if (message.includes('NOT_AUTHORIZED')) return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: 403 })
    if (message.includes('BOOKING_NOT_FOUND')) return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 })
    if (message.includes('BOOKING_NOT_CANCELLABLE')) return NextResponse.json({ error: t.cancelNotAllowed }, { status: 409 })
    console.error('cancel_booking RPC failed:', error)
    return NextResponse.json({ error: dictionary[locale].common.error }, { status: 500 })
  }

  // Best-effort Zoom cleanup — a failure here must never fail the cancellation.
  if (data.zoom_meeting_id) {
    try {
      const admin = createAdminClient()
      const { count } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('zoom_meeting_id', data.zoom_meeting_id)
        .eq('status', 'confirmed')
        .neq('id', data.id)
      if ((count ?? 0) === 0) {
        await deleteZoomMeeting(data.zoom_meeting_id)
      }
    } catch (err) {
      console.error('Zoom meeting cleanup after cancel failed (booking is cancelled anyway):', err)
    }
  }

  return NextResponse.json({ booking: data })
}
