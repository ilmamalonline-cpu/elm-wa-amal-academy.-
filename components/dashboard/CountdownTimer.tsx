'use client'

import { useEffect, useState } from 'react'
import { breakdownDuration, msUntil } from '@/lib/utils/datetime'
import type { Locale } from '@/lib/i18n/config'

export function CountdownTimer({
  dateKey,
  timeKey,
  locale,
}: {
  dateKey: string
  timeKey: string
  locale: Locale
}) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    function tick() {
      setRemainingMs(msUntil(dateKey, timeKey))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [dateKey, timeKey])

  if (remainingMs === null) {
    // Avoids a server/client render mismatch on first paint.
    return <div className="h-16" />
  }

  if (remainingMs <= 0) {
    return (
      <div className="font-display text-2xl font-bold text-gold-600">
        {locale === 'ar' ? '🟢 الجلسة بدأت الآن' : '🟢 The session has started'}
      </div>
    )
  }

  const { days, hours, minutes, seconds } = breakdownDuration(remainingMs)
  const isSoon = remainingMs < 30 * 60 * 1000

  const units =
    locale === 'ar'
      ? [
          { value: days, label: 'يوم' },
          { value: hours, label: 'ساعة' },
          { value: minutes, label: 'دقيقة' },
          { value: seconds, label: 'ثانية' },
        ]
      : [
          { value: days, label: 'd' },
          { value: hours, label: 'h' },
          { value: minutes, label: 'm' },
          { value: seconds, label: 's' },
        ]

  return (
    <div>
      <div className={`flex gap-3 ${isSoon ? 'text-gold-600' : 'text-sidr-900'}`}>
        {units.map((u) => (
          <div key={u.label} className="text-center">
            <div className="font-display w-12 text-3xl font-bold tabular-nums">
              {String(u.value).padStart(2, '0')}
            </div>
            <div className="text-ink-soft text-xs">{u.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

