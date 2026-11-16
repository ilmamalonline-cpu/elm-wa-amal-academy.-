import { redirect } from 'next/navigation'
import { getLocale } from '@/lib/i18n/server'
import { getPortalRole } from '@/lib/auth/getPortal'
import { PortalShell } from '@/components/dashboard/PortalShell'
import { TeacherWorkspace } from '@/components/dashboard/TeacherWorkspace'

export default async function TeacherDashboard() {
  const [{ role }, locale] = await Promise.all([getPortalRole(), getLocale()])
  if (role !== 'teacher') redirect(`/dashboard/${role}`)
  return <PortalShell role="teacher" locale={locale}><TeacherWorkspace locale={locale} /></PortalShell>
}
