import { redirect } from 'next/navigation'
import { getPortalRole } from '@/lib/auth/getPortal'

export default async function DashboardRouter() {
  const { role } = await getPortalRole()
  redirect(`/dashboard/${role}`)
}
