import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth/getProfile'
import { getLocale } from '@/lib/i18n/config'
import { formatTime, getCairoTodayKey, isOccurringOnDate } from '@/lib/utils/datetime'
import type { Profile } from '@/types/database'

export default async function TeacherHomePage() {
  const profile = await getProfileOrRedirect()
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('teacher_id', profile.id)
    .eq('status', 'confirmed')

  const todayKey = getCairoTodayKey()
  const todaysSessions = (bookings ?? [])
    .filter((b) => isOccurringOnDate(b, todayKey))
    .sort((a, b) => a.time_slot.localeCompare(b.time_slot))

  const studentIds = [...new Set((bookings ?? []).map((b) => b.student_id))]
  const { data: students } = studentIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', studentIds)
    : { data: [] as Pick<Profile, 'id' | 'full_name'>[] }
  const studentById = new Map((students ?? []).map((s) => [s.id, s.full_name]))

  const uniqueStudentCount = studentIds.length

  return (
    <div className="space-y-8">
      <div>
        <p className="text-ink-soft text-sm">{isAr ? 'السلام عليكم' : 'Welcome'}</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-sidr-900 sm:text-3xl">
          {profile.full_name}
        </h1>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-ink-soft text-sm">{isAr ? 'جلسات اليوم' : "Today's sessions"}</p>
          <p className="font-display mt-1 text-3xl font-bold text-sidr-900">{todaysSessions.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-ink-soft text-sm">{isAr ? 'إجمالي الطلاب' : 'Total students'}</p>
          <p className="font-display mt-1 text-3xl font-bold text-sidr-900">{uniqueStudentCount}</p>
        </div>
      </div>

      {/* Today's schedule */}
      <div className="card p-6 sm:p-8">
        <h2 className="font-display text-lg font-bold text-sidr-900">
          {isAr ? 'جدول اليوم' : "Today's schedule"}
        </h2>

        {todaysSessions.length === 0 ? (
          <p className="text-ink-soft mt-4 text-sm">
            {isAr ? 'لا توجد جلسات اليوم.' : 'No sessions today.'}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-mist-dark">
            {todaysSessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-sidr-900">{studentById.get(s.student_id) ?? '—'}</p>
                  <p className="text-ink-soft text-sm">
                    {formatTime(s.time_slot, locale)} · {s.session_type === 'group' ? (isAr ? 'جماعي' : 'Group') : isAr ? 'فردي' : 'Individual'}
                  </p>
                </div>
                {s.zoom_start_url && (
                  <a href={s.zoom_start_url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm">
                    {isAr ? '🎥 ابدأ الجلسة' : '🎥 Start Session'}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/teacher/availability" className="btn-secondary">
          {isAr ? 'إدارة مواعيدي' : 'Manage my availability'}
        </Link>
        <Link href="/dashboard/teacher/matchmaking" className="btn-secondary">
          {isAr ? 'تفضيلات الطلاب' : 'Student preferences'}
        </Link>
      </div>
    </div>
  )
}
