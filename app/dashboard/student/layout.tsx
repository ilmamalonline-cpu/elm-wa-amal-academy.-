import { getProfileOrRedirect } from '@/lib/auth/getProfile'
import { getLocale } from '@/lib/i18n/config'
import { dictionary } from '@/lib/i18n/dictionary'
import { DashboardShell, type NavItem } from '@/components/dashboard/DashboardShell'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfileOrRedirect()
  const locale = await getLocale()
  const t = dictionary[locale]

  const navItems: NavItem[] = [
    { href: '/dashboard/student', label: t.nav.dashboard },
    { href: '/dashboard/student/book', label: t.nav.bookSession },
    { href: '/dashboard/student/sessions', label: t.nav.sessions },
    { href: '/dashboard/student/preferences', label: locale === 'ar' ? 'تفضيلاتي' : 'My Preferences' },
  ]

  return (
    <DashboardShell locale={locale} fullName={profile.full_name} roleLabel={t.roles.student} navItems={navItems}>
      {children}
    </DashboardShell>
  )
}
 
