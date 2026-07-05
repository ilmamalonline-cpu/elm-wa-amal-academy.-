import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/i18n/config'
import { formatDateReadable, formatTime } from '@/lib/utils/datetime'
import type { BookingStatus, Profile } from '@/types/database'

const STATUSES: (BookingStatus | 'all')[] = ['all', 'confirmed', 'completed', 'cancelled', 'no_show']

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const { status } = await searchParams
  const activeStatus = (status as BookingStatus | undefined) ?? 'all'
  const supabase = await createClient()

  let query = supabase.from('bookings').select('*').order('scheduled_date', { ascending: false }).limit(100)
  if (activeStatus !== 'all') query = query.eq('status', activeStatus)
  const { data: bookings } = await query

  const peopleIds = [
    ...new Set((bookings ?? []).flatMap((b) => [b.student_id, b.teacher_id])),
  ]
  const { data: people } = peopleIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', peopleIds)
    : { data: [] as Pick<Profile, 'id' | 'full_name'>[] }
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]))

  const statusLabel: Record<BookingStatus | 'all', string> = isAr
    ? { all: 'الكل', confirmed: 'مؤكدة', completed: 'مكتملة', cancelled: 'ملغاة', no_show: 'لم يحضر' }
    : { all: 'All', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-sidr-900">
        {isAr ? 'سجل الحجوزات' : 'Booking ledger'}
      </h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === 'all' ? '/dashboard/admin/bookings' : `/dashboard/admin/bookings?status=${s}`}
            className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
              activeStatus === s ? 'bg-sidr-700 text-gold-100' : 'text-ink-soft hover:bg-sidr-50'
            }`}
          >
            {statusLabel[s]}
          </Link>
        ))}
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-mist-dark text-start">
              <th className="text-ink-soft px-4 py-3 text-start font-semibold">{isAr ? 'الطالب' : 'Student'}</th>
              <th className="text-ink-soft px-4 py-3 text-start font-semibold">{isAr ? 'المعلم' : 'Teacher'}</th>
              <th className="text-ink-soft px-4 py-3 text-start font-semibold">{isAr ? 'الموعد' : 'When'}</th>
              <th className="text-ink-soft px-4 py-3 text-start font-semibold">{isAr ? 'النوع' : 'Type'}</th>
              <th className="text-ink-soft px-4 py-3 text-start font-semibold">{isAr ? 'الحالة' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((b) => (
              <tr key={b.id} className="border-b border-mist-dark last:border-0">
                <td className="px-4 py-3 font-medium text-sidr-900">{nameById.get(b.student_id) ?? '—'}</td>
                <td className="px-4 py-3">{nameById.get(b.teacher_id) ?? '—'}</td>
                <td className="text-ink-soft px-4 py-3">
                  {formatDateReadable(b.scheduled_date, locale)} · {formatTime(b.time_slot, locale)}
                </td>
                <td className="px-4 py-3">
                  {b.session_type === 'group' ? (isAr ? 'جماعي' : 'Group') : isAr ? 'فردي' : 'Individual'}
                  {b.is_recurring && ' 🔁'}
                </td>
                <td className="px-4 py-3">
                  <span className="badge-gold">{statusLabel[b.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!bookings || bookings.length === 0) && (
          <p className="text-ink-soft p-6 text-center text-sm">{isAr ? 'لا توجد حجوزات.' : 'No bookings found.'}</p>
        )}
      </div>
    </div>
  )
}

