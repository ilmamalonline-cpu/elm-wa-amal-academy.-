import Link from 'next/link'
import { getLocale } from '@/lib/i18n/config'
import { SoundWaveMark } from '@/components/ui/SoundWaveMark'

export default async function NotFound() {
  const locale = await getLocale()
  const isAr = locale === 'ar'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-parchment px-6 text-center">
      <span className="text-sidr-700">
        <SoundWaveMark className="h-16 w-16" />
      </span>
      <h1 className="font-display mt-6 text-3xl font-bold text-sidr-900">
        {isAr ? 'الصفحة غير موجودة' : 'Page not found'}
      </h1>
      <p className="text-ink-soft mt-2 max-w-sm text-sm">
        {isAr
          ? 'يبدو أن هذه الصفحة غير موجودة أو تم نقلها.'
          : "This page doesn't exist or may have moved."}
      </p>
      <Link href="/" className="btn-primary mt-6">
        {isAr ? 'العودة للرئيسية' : 'Back to home'}
      </Link>
    </main>
  )
}
