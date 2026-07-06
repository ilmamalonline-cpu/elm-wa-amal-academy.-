'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from '@/lib/i18n/config'

export function CancelBookingButton({ bookingId, locale }: { bookingId: string; locale: Locale }) {
  const isAr = locale === 'ar'
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error ?? (isAr ? 'تعذر الإلغاء' : 'Could not cancel'))
        setLoading(false)
        return
      }
      router.refresh()
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم' : 'Could not reach the server')
      setLoading(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-ink-soft">{isAr ? 'متأكد؟' : 'Are you sure?'}</span>
        <button onClick={handleCancel} disabled={loading} className="text-danger font-semibold hover:underline">
          {loading ? (isAr ? 'جارٍ...' : 'Cancelling...') : isAr ? 'نعم، ألغِ' : 'Yes, cancel'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-ink-soft hover:underline">
          {isAr ? 'تراجع' : 'Never mind'}
        </button>
        {error && <span className="text-danger">{error}</span>}
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-danger text-sm font-semibold hover:underline">
      {isAr ? 'إلغاء الحجز' : 'Cancel booking'}
    </button>
  )
}

