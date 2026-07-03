// lib/supabase/server.ts
// Use this inside Server Components, Server Actions, and Route Handlers.
// It reads/writes the session via the Next.js `cookies()` store, so the
// user stays signed in across server-rendered navigations.
//
// This client still respects Row Level Security as the calling user
// (auth.uid() inside RLS policies and RPC functions resolves correctly).
// For operations that must bypass RLS entirely (e.g. an admin creating a
// new teacher account), use lib/supabase/admin.ts instead.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll was called from a Server Component during render,
            // where cookies can't be mutated. Safe to ignore here because
            // proxy.ts refreshes the session on every request anyway.
          }
        },
      },
    }
  )
}
