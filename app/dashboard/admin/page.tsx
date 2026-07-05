import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth/getProfile'
import { getLocale } from '@/lib/i18n/config'

export default async function AdminHomePage() {
  const profile = await getProfileOrRedirect()
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const supabase = await createClient()

  const { data: statsRows } = await supabase.rpc('get_admin_stats')
  const stats = statsRows?.[0] ?? {
    active_teachers: 0,
    active_students: 0,
    sessions_today: 0,
    upcoming_confirmed: 0,
  }

  const cards = [
    { label: isAr ? 'المعلمون النشطون' : 'Active teachers', value: stats.active_teachers },
    { label: isAr ? 'الطلاب النشطون' : 'Active students', value: stats.active_students },
    { label: isAr ? 'جلسات اليوم' : "Today's sessions", value: stats.sessions_today },
    { label: isAr ? 'حجوزات قادمة' : 'Upcoming bookings', value: stats.upcoming_confirmed },
  ]

  return (
    <div className="space-y-8">
      <div>
        <p className="text-ink-soft text-sm">{isAr ? 'مركز القيادة' : 'Command center'}</p>
        <h1 className="font-display mt-1 text-2xl font-bold text-sidr-900 sm:text-3xl">
          {profile.full_name}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-ink-soft text-sm">{c.label}</p>
            <p className="font-display mt-1 text-3xl font-bold text-sidr-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard/admin/users" className="btn-primary">
          {isAr ? 'إدارة المستخدمين' : 'Manage users'}
        </Link>
        <Link href="/dashboard/admin/bookings" className="btn-secondary">
          {isAr ? 'سجل الحجوزات' : 'Booking ledger'}
        </Link>
      </div>
    </div>
  )
}

