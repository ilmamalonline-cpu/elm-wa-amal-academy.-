import { getProfileOrRedirect } from '@/lib/auth/getProfile'
import { getLocale } from '@/lib/i18n/config'
import { dictionary } from '@/lib/i18n/dictionary'
import { DashboardShell, type NavItem } from '@/components/dashboard/DashboardShell'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfileOrRedirect()
  const locale = await getLocale()
  const t = dictionary[locale]

  const navItems: NavItem[] = [
    { href: '/dashboard/teacher', label: t.nav.dashboard },
    { href: '/dashboard/teacher/availability', label: t.nav.availability },
    { href: '/dashboard/teacher/classes', label: t.nav.myClasses },
    { href: '/dashboard/teacher/matchmaking', label: t.nav.matchmaking },
  ]

  return (
    <DashboardShell locale={locale} fullName={profile.full_name} roleLabel={t.roles.teacher} navItems={navItems}>
      {children}
    </DashboardShell>
  )
}

