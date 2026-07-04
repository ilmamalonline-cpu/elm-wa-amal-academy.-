'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SoundWaveMark } from '@/components/ui/SoundWaveMark'
import { dictionary } from '@/lib/i18n/dictionary'
import type { Locale } from '@/lib/i18n/config'

export interface NavItem {
  href: string
  label: string
}

export function DashboardShell({
  locale,
  fullName,
  roleLabel,
  navItems,
  children,
}: {
  locale: Locale
  fullName: string
  roleLabel: string
  navItems: NavItem[]
  children: React.ReactNode
}) {
  const t = dictionary[locale]
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-parchment lg:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 z-40 w-72 border-e border-mist-dark bg-white transition-transform lg:static lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : 'rtl:translate-x-full ltr:-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col p-6">
          <Link href="/" className="mb-8 flex items-center gap-2.5">
            <span className="text-sidr-700">
              <SoundWaveMark className="h-7 w-7" />
            </span>
            <span className="font-display text-base font-bold text-sidr-900">{t.academy.name}</span>
          </Link>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-button px-4 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-sidr-700 text-gold-100'
                      : 'text-ink-soft hover:bg-sidr-50 hover:text-sidr-700'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-mist-dark pt-4">
            <p className="text-sm font-semibold text-sidr-900">{fullName}</p>
            <p className="text-ink-soft text-xs">{roleLabel}</p>
            <button type="button" onClick={handleLogout} className="btn-secondary mt-3 w-full text-sm">
              {t.nav.logout}
            </button>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <button
          aria-label="close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
        />
      )}

      {/* Mobile topbar */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-mist-dark bg-white px-4 py-3 lg:hidden">
        <span className="font-display text-base font-bold text-sidr-900">{t.academy.name}</span>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-button border border-mist-dark p-2"
          aria-label="menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  )
}
