import { createClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth/getProfile'
import { getLocale } from '@/lib/i18n/config'
import { PreferencesForm } from '@/components/dashboard/PreferencesForm'

export default async function PreferencesPage() {
  const profile = await getProfileOrRedirect()
  const locale = await getLocale()
  const supabase = await createClient()

  const { data: preferences } = await supabase
    .from('student_preferences')
    .select('*')
    .eq('student_id', profile.id)
    .maybeSingle()

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-sidr-900">
        {locale === 'ar' ? 'تفضيلاتي' : 'My preferences'}
      </h1>
      <p className="text-ink-soft mt-1 max-w-lg text-sm">
        {locale === 'ar'
          ? 'سجّل الأوقات التي تناسبك — يراها المعلمون ليفتحوا مواعيدهم بما يتوافق معها.'
          : 'Log the times that work for you — teachers see this to open matching slots.'}
      </p>

      <div className="mt-6 max-w-lg">
        <PreferencesForm locale={locale} initial={preferences ?? null} />
      </div>
    </div>
  )
}
