// app/api/feedback/route.ts
//
// Teacher submits phonetic/articulation feedback for ONE session.
// Everything is enforced inside submit_session_feedback() (SECURITY DEFINER):
// the caller must be the booking's own teacher, the session date must be a
// real occurrence that has already happened, and the booking is marked
// completed only for one-offs / the last session of a series. The client no
// longer sends student_id — it's read from the booking.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TajweedError } from '@/types/database'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  if (typeof body.booking_id !== 'string' || !UUID_RE.test(body.booking_id)) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }
  if (typeof body.session_date !== 'string' || !DATE_RE.test(body.session_date)) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }

  let rating: number | null = null
  if (body.rating !== undefined && body.rating !== null) {
    if (typeof body.rating !== 'number' || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      return NextResponse.json({ error: 'INVALID_RATING' }, { status: 400 })
    }
    rating = body.rating
  }

  const errors: TajweedError[] = []
  if (body.tajweed_errors !== undefined) {
    if (!Array.isArray(body.tajweed_errors) || body.tajweed_errors.length > 50) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
    }
    for (const row of body.tajweed_errors) {
      if (typeof row !== 'object' || row === null) {
        return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 })
      }
      const r = row as Record<string, unknown>
      errors.push({
        letter: cleanText(r.letter, 10) ?? '',
        error_type: cleanText(r.error_type, 40) ?? '',
        correction: cleanText(r.correction, 500) ?? '',
      })
    }
  }

  const { data, error } = await supabase.rpc('submit_session_feedback', {
    p_booking_id: body.booking_id,
    p_session_date: body.session_date,
    p_articulation_notes: cleanText(body.articulation_notes, 4000),
    p_tajweed_errors: errors,
    p_homework: cleanText(body.homework, 1000),
    p_rating: rating,
  })

  if (error || !data) {
    const message = error?.message ?? ''
    const map: [string, number][] = [
      ['NOT_AUTHORIZED', 403],
      ['BOOKING_NOT_FOUND', 404],
      ['BOOKING_NOT_ACTIVE', 409],
      ['SESSION_NOT_HELD_YET', 409],
      ['FEEDBACK_ALREADY_EXISTS', 409],
      ['INVALID_SESSION_DATE', 400],
      ['INVALID_RATING', 400],
      ['INVALID_PAYLOAD', 400],
    ]
    for (const [code, status] of map) {
      if (message.includes(code)) return NextResponse.json({ error: code }, { status })
    }
    console.error('submit_session_feedback RPC failed:', error)
    return NextResponse.json({ error: 'SAVE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({ feedback: data })
}
