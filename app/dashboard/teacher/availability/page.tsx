import { getProfileOrRedirect } from '@/lib/auth/getProfile'
import { getLocale } from '@/lib/i18n/config'
import { AvailabilityGrid } from '@/components/dashboard/AvailabilityGrid'

export default async function AvailabilityPage() {
  const profile = await getProfileOrRedirect()
  const locale = await getLocale()
  const isAr = locale === 'ar'

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-sidr-900">
        {isAr ? 'مواعيدي المتاحة' : 'My availability'}
      </h1>
      <p className="text-ink-soft mt-1 max-w-lg text-sm">
        {isAr
          ? 'انقر على أي خانة فارغة لفتحها كموعد متاح، وانقر عليها مرة أخرى لإغلاقها. الخانات الذهبية محجوزة بالفعل.'
          : 'Click an empty cell to open it as an available slot, click again to close it. Gold cells are already booked.'}
      </p>

      <div className="mt-6">
        <AvailabilityGrid locale={locale} teacherId={profile.id} />
      </div>
    </div>
  )
}
