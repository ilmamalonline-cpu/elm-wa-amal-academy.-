// app/api/feedback/route.ts
// Teacher submits phonetic/articulation feedback after a session. RLS
// (feedback_teacher_all) already restricts writes to auth.uid() = teacher_id,
// so this route just validates shape and forwards the insert.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TajweedError } from '@/types/database'

interface FeedbackBody {
  booking_id: string
  student_id: string
  articulation_notes?: string
  tajweed_errors?: TajweedError[]
  homework?: string
  rating?: number
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'NOT_AUTHENTICATED' }, { status: 401 })
  }

  let body: FeedbackBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  if (!body.booking_id || !body.student_id) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('session_feedback')
    .insert({
      booking_id: body.booking_id,
      teacher_id: user.id,
      student_id: body.student_id,
      articulation_notes: body.articulation_notes ?? null,
      tajweed_errors: body.tajweed_errors ?? [],
      homework: body.homework ?? null,
      rating: body.rating ?? null,
    })
    .select()
    .single()

  if (error) {
    const isDuplicate = error.message.toLowerCase().includes('duplicate')
    return NextResponse.json(
      { error: isDuplicate ? 'FEEDBACK_ALREADY_EXISTS' : error.message },
      { status: isDuplicate ? 409 : 500 }
    )
  }

  // Mark the booking completed now that feedback has been logged.
  await supabase.rpc('mark_booking_completed', { p_booking_id: body.booking_id })

  return NextResponse.json({ feedback: data })
}
