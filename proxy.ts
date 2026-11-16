import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

const AUTH_PATHS = ['/login', '/register']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isAuthPath = AUTH_PATHS.includes(pathname)
  const isDashboardPath = pathname === '/dashboard' || pathname.startsWith('/dashboard/')
  const redirectWithCookies = (url: URL) => {
    const redirected = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie))
    return redirected
  }

  if (!user) {
    if (isDashboardPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      return redirectWithCookies(url)
    }
    return response
  }

  if (!isAuthPath && !isDashboardPath) return response

  const { data: admin } = await supabase.from('academy_admins').select('id').eq('id', user.id).maybeSingle()
  const { data: teacher } = admin
    ? { data: null }
    : await supabase.from('academy_teachers').select('id').eq('id', user.id).eq('status', 'active').maybeSingle()
  const role = admin ? 'admin' : teacher ? 'teacher' : 'guardian'
  const roleHome = `/dashboard/${role}`

  if (isAuthPath) {
    const url = request.nextUrl.clone()
    url.pathname = roleHome
    url.search = ''
    return redirectWithCookies(url)
  }

  const requestedRole = pathname.split('/')[2]
  if (requestedRole && ['guardian', 'teacher', 'admin'].includes(requestedRole) && requestedRole !== role) {
    const url = request.nextUrl.clone()
    url.pathname = roleHome
    url.search = ''
    return redirectWithCookies(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
