import type { Metadata } from 'next'
import { Amiri, Tajawal } from 'next/font/google'
import { getLocale, dirOf } from '@/lib/i18n/config'
 
import './globals.css'

const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
})

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '700', '800'],
  variable: '--font-tajawal',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'أكاديمية علم وعمل | Elm wa Amal Academy',
  description:
    'أكاديمية متخصصة في تصحيح النطق وعلم الأصوات القرآنية — Specialized articulation correction & Quranic phonetics academy',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const dir = dirOf(locale)

  return (
    <html lang={locale} dir={dir} className={`${amiri.variable} ${tajawal.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
