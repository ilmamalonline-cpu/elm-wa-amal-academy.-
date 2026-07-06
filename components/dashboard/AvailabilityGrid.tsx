'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  DAY_NAMES_AR,
  DAY_NAMES_EN,
  addDaysToDateKey,
  formatTime,
  getWeekStartDate,
} from '@/lib/utils/datetime'
import type { Locale } from '@/lib/i18n/config'
import type { SessionType, TeacherAvailability } from '@/types/database'

const HOURS = Array.from({ length: 17 }, (_, i) => 6 + i) // 06:00 .. 22:00

function hourKey(h: number) {
  return `${String(h).padStart(2, '0')}:00:00`
}

export function AvailabilityGrid({ locale, teacherId }: { locale: Locale; teacherId: string }) {
  const isAr = locale === 'ar'
  const dayNames = isAr ? DAY_NAMES_AR : DAY_NAMES_EN
  const supabase = createClient()

  const [weekOffset, setWeekOffset] = useState(0)
  const [slots, setSlots] = useState<TeacherAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingCell, setPendingCell] = useState<string | null>(null)
  const [sessionType, setSessionType] = useState<SessionType>('individual')
  const [maxGroupSize, setMaxGroupSize] = useState(4)
  const [error, setError] = useState<string | null>(null)

  const baseWeekStart = getWeekStartDate()
  const weekStartDate = addDaysToDateKey(baseWeekStart, weekOffset * 7)

  const loadSlots = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('teacher_availability')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('week_start_date', weekStartDate)
    setSlots(data ?? [])
    setLoading(false)
  }, [supabase, teacherId, weekStartDate])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  const slotAt = (day: number, hour: number) => {
    const hh = String(hour).padStart(2, '0')
    return slots.find((s) => s.day_of_week === day && s.start_time.slice(0, 2) === hh)
  }

  async function handleCellClick(day: number, hour: number) {
    const cellId = `${day}-${hour}`
    const existing = slotAt(day, hour)

    if (existing?.is_booked) return // locked — can't close a slot that's already booked

    setPendingCell(cellId)
    setError(null)

    try {
      if (existing) {
        const res = await fetch('/api/availability/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'close', slot_id: existing.id }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          setError(
            json.error === 'SLOT_HAS_ACTIVE_BOOKING'
              ? isAr
                ? 'لا يمكن إغلاق موعد محجوز'
                : "Can't close a booked slot"
              : isAr
                ? 'تعذر الإغلاق'
                : 'Could not close'
          )
        } else {
          setSlots((prev) => prev.filter((s) => s.id !== existing.id))
        }
      } else {
        const res = await fetch('/api/availability/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'open',
            week_start_date: weekStartDate,
            day_of_week: day,
            start_time: hourKey(hour),
            end_time: hourKey(hour + 1),
            session_type: sessionType,
            max_students_group: sessionType === 'group' ? maxGroupSize : 1,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(isAr ? 'تعذر الفتح' : 'Could not open slot')
        } else if (json.slot) {
          setSlots((prev) => [...prev, json.slot as TeacherAvailability])
        }
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم' : 'Could not reach the server')
    } finally {
      setPendingCell(null)
    }
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
            disabled={weekOffset === 0}
            className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {isAr ? '›' : '‹'}
          </button>
          <span className="text-sm font-semibold text-sidr-900">
            {weekOffset === 0 ? (isAr ? 'هذا الأسبوع' : 'This week') : isAr ? `بعد ${weekOffset} أسبوع` : `+${weekOffset}w`}
          </span>
          <button
            onClick={() => setWeekOffset((w) => Math.min(4, w + 1))}
            disabled={weekOffset === 4}
            className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {isAr ? '‹' : '›'}
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={sessionType === 'individual'}
              onChange={() => setSessionType('individual')}
              className="accent-sidr-700"
            />
            {isAr ? 'فردي' : 'Individual'}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={sessionType === 'group'}
              onChange={() => setSessionType('group')}
              className="accent-sidr-700"
            />
            {isAr ? 'جماعي' : 'Group'}
          </label>
          {sessionType === 'group' && (
            <input
              type="number"
              min={2}
              max={12}
              value={maxGroupSize}
              onChange={(e) => setMaxGroupSize(Number(e.target.value))}
              className="input-field w-16 py-1 text-center"
            />
          )}
        </div>
      </div>

      {error && <p className="text-danger mb-3 text-sm font-medium">{error}</p>}

      {/* Grid */}
      <div className="card overflow-x-auto p-4">
        {loading ? (
          <p className="text-ink-soft py-8 text-center text-sm">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-16" />
                {dayNames.map((name) => (
                  <th key={name} className="text-ink-soft px-1 pb-2 text-center text-xs font-semibold">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour) => (
                <tr key={hour}>
                  <td className="text-ink-soft py-0.5 pe-2 text-end text-xs tabular-nums">
                    {formatTime(hourKey(hour), locale)}
                  </td>
                  {dayNames.map((_, day) => {
                    const slot = slotAt(day, hour)
                    const cellId = `${day}-${hour}`
                    const isPending = pendingCell === cellId
                    return (
                      <td key={day} className="p-0.5">
                        <button
                          onClick={() => handleCellClick(day, hour)}
                          disabled={isPending || (slot?.is_booked ?? false)}
                          title={
                            slot?.is_booked
                              ? isAr
                                ? 'محجوز'
                                : 'Booked'
                              : slot
                                ? isAr
                                  ? 'متاح — انقر للإغلاق'
                                  : 'Open — click to close'
                                : isAr
                                  ? 'انقر للفتح'
                                  : 'Click to open'
                          }
                          className={`h-8 w-full rounded-md border transition-colors ${
                            slot?.is_booked
                              ? 'border-gold-500 bg-gold-300 cursor-not-allowed'
                              : slot
                                ? 'border-sidr-600 bg-sidr-100 hover:bg-sidr-50'
                                : 'border-mist-dark bg-transparent hover:border-sidr-500 hover:bg-sidr-50'
                          } ${isPending ? 'opacity-50' : ''}`}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="text-ink-soft mt-3 flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="border-mist-dark inline-block h-3 w-3 rounded border" /> {isAr ? 'مغلق' : 'Closed'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-sidr-600 bg-sidr-100 inline-block h-3 w-3 rounded border" />{' '}
          {isAr ? 'متاح' : 'Open'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-gold-500 bg-gold-300 inline-block h-3 w-3 rounded border" />{' '}
          {isAr ? 'محجوز' : 'Booked'}
        </span>
      </div>
    </div>
  )
}

