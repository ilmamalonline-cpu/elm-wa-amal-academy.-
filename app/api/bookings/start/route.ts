// app/api/bookings/start/route.ts
//
// GET /api/bookings/start?booking_id=...
//
// Teacher (or admin) opens this in a new tab. We fetch a FRESH host/start URL
// from Zoom and redirect to it. The start URL is never stored in the
// database and never reaches a student: it is the host link, and a stored
// copy would be both readable by students (RLS can't hide one column) and
// stale (Zoom start URLs are short-lived).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getZoomStartUrl, ZoomApiError } from '@/lib/zoom/client'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })

  const bookingId = new URL(request.url).searchParams.get('booking_id')
  if (!bookingId || !UUID_RE.test(bookingId)) {
    return NextResponse.json({ error: 'MISSING_BOOKING_ID' }, { status: 400 })
  }

  // RLS lets the student, the teacher and admins read this row — so check
  // explicitly that the caller is the TEACHER (or an admin), never the student.
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, teacher_id, status, zoom_meeting_id')
    .eq('id', bookingId)
    .maybeSingle()
  if (!booking) return NextResponse.json({ error: 'BOOKING_NOT_FOUND' }, { status: 404 })

  if (booking.teacher_id !== user.id) {
    const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'admin' || profile.is_active === false) {
      return NextResponse.json({ error: 'NOT_AUTHORIZED' }, { status: 403 })
    }
  }

  if (booking.status !== 'confirmed') return NextResponse.json({ error: 'BOOKING_NOT_ACTIVE' }, { status: 409 })
  if (!booking.zoom_meeting_id) return NextResponse.json({ error: 'NO_ZOOM_MEETING' }, { status: 404 })

  try {
    const startUrl = await getZoomStartUrl(booking.zoom_meeting_id)
    // Only ever redirect to Zoom itself.
    const host = new URL(startUrl).hostname
    if (!/(^|\.)(zoom\.us|zoomgov\.com)$/.test(host)) {
      console.error('Refusing to redirect to non-Zoom host:', host)
      return NextResponse.json({ error: 'ZOOM_ERROR' }, { status: 502 })
    }
    return NextResponse.redirect(startUrl, 302)
  } catch (err) {
    console.error('Fetching Zoom start URL failed:', err instanceof ZoomApiError ? `${err.message} (status ${err.status})` : err)
    return NextResponse.json({ error: 'ZOOM_ERROR' }, { status: 502 })
  }
}
