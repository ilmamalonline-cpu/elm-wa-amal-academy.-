// lib/supabase/admin.ts
//
// ⚠️ SERVER-ONLY. This client uses the SERVICE ROLE key and bypasses Row
// Level Security entirely. Never import this file into a Client Component,
// and never expose SUPABASE_SERVICE_ROLE_KEY with a NEXT_PUBLIC_ prefix.
//
// Only call createAdminClient() from inside a Route Handler or Server
// Action that has already verified (via lib/supabase/server.ts) that the
// caller is an authenticated admin. Used for things the anon/user key
// can't do, like creating a teacher's auth account from the Admin
// Dashboard.
//
// Get the key from: Supabase Dashboard -> Project Settings -> API ->
// "service_role" secret (NOT the "anon public" key).

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local (and to ' +
        'your Vercel project env vars) — copy it from Supabase Dashboard > ' +
        'Project Settings > API > service_role key. Never prefix it with ' +
        'NEXT_PUBLIC_.'
    )
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
