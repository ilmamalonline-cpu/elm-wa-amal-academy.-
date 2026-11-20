import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeDestination(next: string | null, origin: string) {
  const fallback = new URL('/dashboard', origin)
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  const destination = new URL(next, origin)
  return destination.origin === origin ? destination : fallback
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const destination = safeDestination(requestUrl.searchParams.get('next'), requestUrl.origin)
  const code = requestUrl.searchParams.get('code')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(destination)
  }
  return NextResponse.redirect(new URL('/login?error=confirmation', requestUrl.origin))
}
