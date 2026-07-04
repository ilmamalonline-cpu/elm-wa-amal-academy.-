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

  // Not logged in and trying to open a dashboard -> bounce to /login
  if (!user && isDashboardPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'student'
    const roleHome = `/dashboard/${role}`

    // Already logged in -> no need to see the login/register forms again
    if (isAuthPath) {
      const url = request.nextUrl.clone()
      url.pathname = roleHome
      return NextResponse.redirect(url)
    }

    // Admin deactivated this account -> sign them out of the app area
    if (profile && profile.is_active === false && isDashboardPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('deactivated', '1')
      return NextResponse.redirect(url)
    }

    // Role fencing: a student can't open /dashboard/teacher/*, etc.
    if (isDashboardPath) {
      const requestedRole = pathname.split('/')[2]
      if (
        (ROLE_PREFIXES as readonly string[]).includes(requestedRole) &&
        requestedRole !== role
      ) {
        const url = request.nextUrl.clone()
        url.pathname = roleHome
        return NextResponse.redirect(url)
      }
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
