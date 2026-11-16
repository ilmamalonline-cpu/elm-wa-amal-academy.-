import { redirect } from 'next/navigation'
import { getLocale } from '@/lib/i18n/server'
import { getPortalRole } from '@/lib/auth/getPortal'
import { PortalShell } from '@/components/dashboard/PortalShell'
import { AdminWorkspace } from '@/components/dashboard/AdminWorkspace'

export default async function AdminDashboard() {
  const [{ role }, locale] = await Promise.all([getPortalRole(), getLocale()])
  if (role !== 'admin') redirect(`/dashboard/${role}`)
  return <PortalShell role="admin" locale={locale}><AdminWorkspace locale={locale} /></PortalShell>
}
