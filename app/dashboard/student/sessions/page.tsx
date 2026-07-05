import { createClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth/getProfile'
import { getLocale } from '@/lib/i18n/config'
import { CancelBookingButton } from '@/components/dashboard/CancelBookingButton'
import { formatDateReadable, formatDayName, formatTime } from '@/lib/utils/datetime'
import type { Profile } from '@/types/database'

export default async function StudentSessionsPage() {
  const profile = await getProfileOrRedirect()
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('student_id', profile.id)
    .order('scheduled_date', { ascending: false })

  const { data: feedbackRows } = await supabase
    .from('session_feedback')
    .select('*')
    .eq('student_id', profile.id)

  const feedbackByBooking = new Map((feedbackRows ?? []).map((f) => [f.booking_id, f]))

  const teacherIds = [...new Set((bookings ?? []).map((b) => b.teacher_id))]
  const { data: teachers } = teacherIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', teacherIds)
    : { data: [] as Pick<Profile, 'id' | 'full_name'>[] }
  const teacherById = new Map((teachers ?? []).map((t) => [t.id, t.full_name]))

  const statusLabel: Record<string, string> = isAr
    ? { confirmed: 'مؤكدة', completed: 'مكتملة', cancelled: 'ملغاة', no_show: 'لم يحضر' }
    : { confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' }

  const statusColor: Record<string, string> = {
    confirmed: 'bg-sidr-100 text-sidr-700',
    completed: 'bg-mist text-ink-soft',
    cancelled: 'bg-danger/10 text-danger',
    no_show: 'bg-danger/10 text-danger',
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-sidr-900">{isAr ? 'جلساتي' : 'My sessions'}</h1>

      {!bookings || bookings.length === 0 ? (
        <p className="text-ink-soft mt-6 text-sm">{isAr ? 'لا توجد جلسات بعد.' : 'No sessions yet.'}</p>
      ) : (
        <div className="mt-6 space-y-4">
          {bookings.map((b) => {
            const feedback = feedbackByBooking.get(b.id)
            return (
              <div key={b.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sidr-900">{teacherById.get(b.teacher_id) ?? '—'}</p>
                    <p className="text-ink-soft text-sm">
                      {formatDayName(b.day_of_week, locale)} · {formatDateReadable(b.scheduled_date, locale)} ·{' '}
                      {formatTime(b.time_slot, locale)}
                    </p>
                  </div>
                  <span className={`rounded-pill px-3 py-1 text-xs font-semibold ${statusColor[b.status]}`}>
                    {statusLabel[b.status]}
                  </span>
                </div>

                {feedback && (
                  <div className="mt-4 border-t border-mist-dark pt-4">
                    {feedback.articulation_notes && (
                      <p className="text-sm leading-relaxed text-ink">{feedback.articulation_notes}</p>
                    )}
                    {feedback.homework && (
                      <p className="text-ink-soft mt-1.5 text-sm">
                        <span className="font-semibold text-sidr-700">{isAr ? 'الواجب: ' : 'Homework: '}</span>
                        {feedback.homework}
                      </p>
                    )}
                  </div>
                )}

                {b.status === 'confirmed' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {b.zoom_join_url && (
                      <a href={b.zoom_join_url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
                        {isAr ? 'رابط الانضمام' : 'Join link'}
                      </a>
                    )}
                    <CancelBookingButton bookingId={b.id} locale={locale} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
