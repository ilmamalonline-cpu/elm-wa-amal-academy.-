import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth/getProfile'
import { getLocale } from '@/lib/i18n/config'
import { dictionary } from '@/lib/i18n/dictionary'
import { CountdownTimer } from '@/components/dashboard/CountdownTimer'
import {
  formatDateReadable,
  formatDayName,
  formatTime,
  getCairoTodayKey,
  getNextOccurrenceDate,
} from '@/lib/utils/datetime'
import type { Booking, Profile } from '@/types/database'

export default async function StudentHomePage() {
  const profile = await getProfileOrRedirect()
  const locale = await getLocale()
  const t = dictionary[locale]
  const isAr = locale === 'ar'
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('student_id', profile.id)
    .eq('status', 'confirmed')

  const teacherIds = [...new Set((bookings ?? []).map((b) => b.teacher_id))]
  const { data: teachers } = teacherIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', teacherIds)
    : { data: [] as Pick<Profile, 'id' | 'full_name'>[] }
  const teacherById = new Map((teachers ?? []).map((tt) => [tt.id, tt.full_name]))

  const todayKey = getCairoTodayKey()

  // Resolve each confirmed booking to its next real occurrence date so a
  // one-time session in the past doesn't get mistaken for "upcoming", and
  // a recurring subscription always points at its *next* class rather
  // than the day it was first booked.
  const upcoming = (bookings ?? [])
    .map((b) => {
      const nextDate = b.is_recurring
        ? getNextOccurrenceDate({
            firstDate: b.scheduled_date,
            dayOfWeek: b.day_of_week,
            pattern: b.recurrence_pattern as 'weekly' | 'biweekly',
            recurrenceEndDate: b.recurrence_end_date,
          })
        : b.scheduled_date >= todayKey
          ? b.scheduled_date
          : null
      return nextDate ? { booking: b, nextDate } : null
    })
    .filter((x): x is { booking: Booking; nextDate: string } => x !== null)
    .sort((a, b) => (a.nextDate + a.booking.time_slot).localeCompare(b.nextDate + b.booking.time_slot))

  const next = upcoming[0]

  const { data: recentFeedback } = await supabase
    .from('session_feedback')
    .select('*')
    .eq('student_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(3)

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="card relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute end-[-3rem] top-[-3rem] h-40 w-40 rounded-full bg-gold-100" />
        <p className="text-ink-soft relative text-sm">
          {isAr ? 'أهلًا بك' : 'Welcome back'}
        </p>
        <h1 className="font-display relative mt-1 text-2xl font-bold text-sidr-900 sm:text-3xl">
          {profile.full_name} 👋
        </h1>
        <p className="text-ink-soft relative mt-2 max-w-lg text-sm">{t.academy.tagline}</p>
      </div>

      {/* Next session countdown */}
      <div className="card p-6 sm:p-8">
        <h2 className="font-display text-lg font-bold text-sidr-900">
          {isAr ? 'جلستك القادمة' : 'Your next session'}
        </h2>

        {next ? (
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-ink-soft text-sm">
                {isAr ? 'مع الشيخ' : 'with'}{' '}
                <span className="font-semibold text-sidr-900">
                  {teacherById.get(next.booking.teacher_id) ?? '—'}
                </span>
              </p>
              <p className="mt-1 text-sm text-sidr-700">
                {formatDayName(next.booking.day_of_week, locale)} · {formatDateReadable(next.nextDate, locale)} ·{' '}
                {formatTime(next.booking.time_slot, locale)}
              </p>
              {next.booking.is_recurring && (
                <span className="badge-gold mt-2">
                  {isAr ? '🔁 اشتراك متكرر' : '🔁 Recurring subscription'}
                </span>
              )}
            </div>
            <CountdownTimer dateKey={next.nextDate} timeKey={next.booking.time_slot} locale={locale} />
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-ink-soft text-sm">
              {isAr ? 'لا توجد جلسات قادمة مجدولة حاليًا.' : 'No upcoming sessions scheduled yet.'}
            </p>
            <Link href="/dashboard/student/book" className="btn-primary mt-4 inline-flex">
              {t.nav.bookSession}
            </Link>
          </div>
        )}

        {next?.booking.zoom_join_url && (
          <a
            href={next.booking.zoom_join_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-6 inline-flex"
          >
            {isAr ? 'انضم للجلسة' : 'Join session'}
          </a>
        )}
      </div>

      {/* Recent feedback */}
      <div className="card p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-sidr-900">
            {isAr ? 'آخر الملاحظات من معلميك' : 'Recent feedback from your teachers'}
          </h2>
          <Link href="/dashboard/student/sessions" className="text-sm font-semibold text-sidr-700 hover:text-sidr-600">
            {isAr ? 'عرض الكل' : 'View all'}
          </Link>
        </div>

        {recentFeedback && recentFeedback.length > 0 ? (
          <ul className="mt-4 space-y-4">
            {recentFeedback.map((f) => (
              <li key={f.id} className="border-t border-mist-dark pt-4 first:border-t-0 first:pt-0">
                {f.articulation_notes && (
                  <p className="text-sm leading-relaxed text-ink">{f.articulation_notes}</p>
                )}
                {f.homework && (
                  <p className="text-ink-soft mt-1.5 text-sm">
                    <span className="font-semibold text-sidr-700">
                      {isAr ? 'الواجب: ' : 'Homework: '}
                    </span>
                    {f.homework}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft mt-4 text-sm">
            {isAr ? 'لا توجد ملاحظات بعد.' : 'No feedback yet.'}
          </p>
        )}
      </div>
    </div>
  )
}

