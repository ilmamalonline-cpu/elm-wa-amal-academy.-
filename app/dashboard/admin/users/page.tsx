import { createClient } from '@/lib/supabase/server'
import { getLocale } from '@/lib/i18n/config'
import { UserManagementPanel } from '@/components/dashboard/UserManagementPanel'

export default async function AdminUsersPage() {
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-sidr-900">
        {isAr ? 'إدارة المستخدمين' : 'User management'}
      </h1>

      <div className="mt-6">
        <UserManagementPanel locale={locale} initialUsers={users ?? []} />
      </div>
    </div>
  )
}
