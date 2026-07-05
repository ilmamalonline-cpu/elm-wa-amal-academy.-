import { createClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/i18n/config'
import { BookingFlow } from '@/components/dashboard/BookingFlow'

export default async function BookSessionPage() {
  const locale = await getLocale()
  const supabase = await createClient()

  const { data: teachers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'teacher')
    .eq('is_active', true)
    .order('full_name')

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-sidr-900">
        {locale === 'ar' ? 'احجز جلسة' : 'Book a session'}
      </h1>
      <p className="text-ink-soft mt-1 text-sm">
        {locale === 'ar'
          ? 'اختر معلمك، ثم موعدًا فارغًا يناسبك.'
          : 'Choose your teacher, then an open time that works for you.'}
      </p>

      <div className="mt-6">
        <BookingFlow teachers={teachers ?? []} locale={locale} />
      </div>
    </div>
  )
}
