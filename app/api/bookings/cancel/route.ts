// app/api/bookings/cancel/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }

  let body: { booking_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  if (!body.booking_id) {
    return NextResponse.json({ error: 'MISSING_BOOKING_ID' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('cancel_booking', {
    p_booking_id: body.booking_id,
  })

  if (error) {
    const status = error.message.includes('NOT_AUTHORIZED')
      ? 403
      : error.message.includes('BOOKING_NOT_FOUND')
        ? 404
        : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ booking: data })
}
