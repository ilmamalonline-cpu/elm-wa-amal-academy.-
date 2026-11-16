import { redirect } from 'next/navigation'
import { getLocale } from '@/lib/i18n/server'
import { getPortalRole } from '@/lib/auth/getPortal'
import { PortalShell } from '@/components/dashboard/PortalShell'
import { GuardianWorkspace } from '@/components/dashboard/GuardianWorkspace'

export default async function GuardianDashboard() {
  const [{ role }, locale] = await Promise.all([getPortalRole(), getLocale()])
  if (role !== 'guardian') redirect(`/dashboard/${role}`)
  return <PortalShell role="guardian" locale={locale}><GuardianWorkspace locale={locale} /></PortalShell>
}
