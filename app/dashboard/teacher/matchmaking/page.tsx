import { createClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/i18n/config'
import { DAY_NAMES_AR, DAY_NAMES_EN } from '@/lib/utils/datetime'
import type { Profile } from '@/types/database'

export default async function MatchmakingPage() {
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const dayNames = isAr ? DAY_NAMES_AR : DAY_NAMES_EN
  const supabase = await createClient()

  const { data: preferences } = await supabase
    .from('student_preferences')
    .select('*')
    .order('updated_at', { ascending: false })

  const studentIds = [...new Set((preferences ?? []).map((p) => p.student_id))]
  const { data: students } = studentIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', studentIds)
    : { data: [] as Pick<Profile, 'id' | 'full_name'>[] }
  const studentById = new Map((students ?? []).map((s) => [s.id, s.full_name]))

  // Aggregate demand per day-of-week for the heatmap strip.
  const dayCounts = new Array(7).fill(0)
  for (const p of preferences ?? []) {
    for (const d of p.preferred_days) dayCounts[d] += 1
  }
  const maxCount = Math.max(1, ...dayCounts)

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-sidr-900">
        {isAr ? 'تفضيلات الطلاب' : 'Student preferences'}
      </h1>
      <p className="text-ink-soft mt-1 max-w-lg text-sm">
        {isAr
          ? 'استخدم هذا لمعرفة الأوقات الأكثر طلبًا وفتح مواعيدك بما يناسبها.'
          : 'Use this to see the most requested times and open your availability to match.'}
      </p>

      {/* Demand heatmap */}
      <div className="card mt-6 p-6">
        <h2 className="font-display text-sm font-bold text-sidr-900">
          {isAr ? 'الطلب حسب اليوم' : 'Demand by day'}
        </h2>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {dayNames.map((name, i) => (
            <div key={name} className="text-center">
              <div
                className="bg-sidr-700 mx-auto w-full rounded-t"
                style={{
                  height: `${Math.max(8, (dayCounts[i] / maxCount) * 64)}px`,
                  opacity: dayCounts[i] === 0 ? 0.15 : 1,
                }}
              />
              <p className="text-ink-soft mt-1.5 text-xs">{name}</p>
              <p className="text-xs font-semibold text-sidr-900">{dayCounts[i]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-student list */}
      <div className="mt-6 space-y-3">
        {!preferences || preferences.length === 0 ? (
          <p className="text-ink-soft text-sm">
            {isAr ? 'لم يسجّل أي طالب تفضيلاته بعد.' : 'No students have logged preferences yet.'}
          </p>
        ) : (
          preferences.map((p) => (
            <div key={p.id} className="card p-5">
              <p className="font-semibold text-sidr-900">{studentById.get(p.student_id) ?? '—'}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.preferred_days.map((d) => (
                  <span key={d} className="badge-gold">
                    {dayNames[d]}
                  </span>
                ))}
              </div>
              {p.preferred_hour_slots.length > 0 && (
                <p className="text-ink-soft mt-2 text-sm">{p.preferred_hour_slots.join(' · ')}</p>
              )}
              {p.notes && <p className="mt-2 text-sm italic text-ink">&ldquo;{p.notes}&rdquo;</p>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

