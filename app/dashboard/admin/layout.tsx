import { getProfileOrRedirect } from '@/lib/auth/getProfile'
import { getLocale } from '@/lib/i18n/config'
import { dictionary } from '@/lib/i18n/dictionary'
import { DashboardShell, type NavItem } from '@/components/dashboard/DashboardShell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfileOrRedirect()
  const locale = await getLocale()
  const t = dictionary[locale]

  const navItems: NavItem[] = [
    { href: '/dashboard/admin', label: t.nav.dashboard },
    { href: '/dashboard/admin/users', label: t.nav.students },
    { href: '/dashboard/admin/bookings', label: t.nav.bookings },
  ]

  return (
    <DashboardShell locale={locale} fullName={profile.full_name} roleLabel={t.roles.admin} navItems={navItems}>
      {children}
    </DashboardShell>
  )
}
 
