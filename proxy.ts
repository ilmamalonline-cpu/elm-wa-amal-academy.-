// proxy.ts
//
// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same network-boundary
// concept and APIs — NextRequest/NextResponse are unchanged — just a new
// filename, a new export name, and Node.js as the default runtime instead
// of Edge). If you're following a Supabase tutorial that says "create
// middleware.ts", create this file instead; the logic is identical.
//
// This file must live at the project root, next to package.json.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

const AUTH_PATHS = ['/login', '/register']
const ROLE_PREFIXES = ['admin', 'teacher', 'student'] as const

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Always call getUser() (not getSession()) in server code — it
  // revalidates the JWT against Supabase Auth instead of trusting
  // whatever is sitting in the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthPath = AUTH_PATHS.includes(pathname)
  const isDashboardPath = pathname.startsWith('/dashboard')
  const isApiPath = pathname.startsWith('/api/')

  // A bare NextResponse.redirect() would DROP any cookies Supabase just
  // refreshed (or cleared) above, which can randomly log people out. Always
  // redirect through this helper so those cookies travel with the redirect.
  const redirectTo = (url: URL) => {
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  // Not logged in and trying to open a dashboard -> bounce to /login
  if (!user) {
    if (isDashboardPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('next', pathname)
      return redirectTo(url)
    }
    return response
  }

  // The landing page etc. don't need the profile lookup — skip the DB round trip.
  if (!isAuthPath && !isDashboardPath && !isApiPath) return response

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  // Admin deactivated this account. This check comes BEFORE the "already
  // logged in -> leave /login" redirect below; with the opposite order a
  // suspended user bounced /dashboard -> /login -> /dashboard forever
  // (ERR_TOO_MANY_REDIRECTS) and never saw the "suspended" message. We now
  // clear their session so /login actually renders.
  if (profile && profile.is_active === false) {
    if (isApiPath) {
      return NextResponse.json({ error: 'ACCOUNT_DEACTIVATED' }, { status: 403 })
    }
    await supabase.auth.signOut({ scope: 'local' })
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('deactivated', '1')
    return redirectTo(url)
  }

  const role = profile?.role ?? 'student'
  const roleHome = `/dashboard/${role}`

  // Already logged in -> no need to see the login/register forms again
  if (isAuthPath) {
    const url = request.nextUrl.clone()
    url.pathname = roleHome
    url.search = ''
    return redirectTo(url)
  }

  // Role fencing: a student can't open /dashboard/teacher/*, etc.
  // (Each role layout re-checks this too — defense in depth.)
  if (isDashboardPath) {
    const requestedRole = pathname.split('/')[2]
    if ((ROLE_PREFIXES as readonly string[]).includes(requestedRole) && requestedRole !== role) {
      const url = request.nextUrl.clone()
      url.pathname = roleHome
      url.search = ''
      return redirectTo(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    // Run on everything except static assets, image optimization, and
    // common metadata files — see Next.js docs on proxy matchers.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
