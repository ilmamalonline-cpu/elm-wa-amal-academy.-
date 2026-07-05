import { createClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth/getProfile'
import { getLocale } from '@/lib/i18n/config'
import { TeacherClassList } from '@/components/dashboard/TeacherClassList'
import type { Profile } from '@/types/database'

export default async function TeacherClassesPage() {
  const profile = await getProfileOrRedirect()
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .eq('teacher_id', profile.id)
    .in('status', ['confirmed', 'completed'])
    .order('scheduled_date', { ascending: false })

  const studentIds = [...new Set((bookings ?? []).map((b) => b.student_id))]
  const { data: students } = studentIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', studentIds)
    : { data: [] as Pick<Profile, 'id' | 'full_name'>[] }

  const bookingIds = (bookings ?? []).map((b) => b.id)
  const { data: feedbackRows } = bookingIds.length
    ? await supabase.from('session_feedback').select('booking_id').in('booking_id', bookingIds)
    : { data: [] as { booking_id: string }[] }
  const feedbackDone = new Set((feedbackRows ?? []).map((f) => f.booking_id))

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-sidr-900">
        {isAr ? 'فصولي' : 'My classes'}
      </h1>

      <div className="mt-6">
        <TeacherClassList
          locale={locale}
          bookings={bookings ?? []}
          students={students ?? []}
          feedbackDoneIds={feedbackDone}
        />
      </div>
    </div>
  )
}
