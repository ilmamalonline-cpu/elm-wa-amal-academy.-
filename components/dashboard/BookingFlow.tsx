'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  addDaysToDateKey,
  formatDateReadable,
  formatDayName,
  formatTime,
  getWeekStartDate,
} from '@/lib/utils/datetime'
import type { Locale } from '@/lib/i18n/config'
import type { Booking, Profile, RecurrencePattern, TeacherAvailability } from '@/types/database'

type Step = 'teacher' | 'slot' | 'confirm' | 'success'

export function BookingFlow({ teachers, locale }: { teachers: Profile[]; locale: Locale }) {
  const isAr = locale === 'ar'
  const supabase = createClient()

  const [step, setStep] = useState<Step>('teacher')
  const [selectedTeacher, setSelectedTeacher] = useState<Profile | null>(null)
  const [slots, setSlots] = useState<TeacherAvailability[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TeacherAvailability | null>(null)

  const [recurring, setRecurring] = useState(false)
  const [pattern, setPattern] = useState<RecurrencePattern>('weekly')
  const [endDate, setEndDate] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null)

  async function selectTeacher(teacher: Profile) {
    setSelectedTeacher(teacher)
    setStep('slot')
    setLoadingSlots(true)
    setError(null)

    const weekStart = getWeekStartDate()
    const { data, error: fetchError } = await supabase
      .from('teacher_availability')
      .select('*')
      .eq('teacher_id', teacher.id)
      .eq('week_start_date', weekStart)
      .eq('is_booked', false)
      .order('day_of_week')
      .order('start_time')

    if (fetchError) {
      setError(isAr ? 'تعذر تحميل المواعيد المتاحة.' : 'Could not load open slots.')
    } else {
      setSlots(data ?? [])
    }
    setLoadingSlots(false)
  }

  function selectSlot(slot: TeacherAvailability) {
    setSelectedSlot(slot)
    setRecurring(false)
    setPattern('weekly')
    setEndDate(addDaysToDateKey(new Date().toISOString().slice(0, 10), 56)) // sensible default: 8 weeks out
    setStep('confirm')
  }

  async function handleConfirm() {
    if (!selectedSlot) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          recurring,
          recurrence_pattern: recurring ? pattern : 'none',
          recurrence_end_date: recurring ? endDate : null,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? (isAr ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred'))
        setSubmitting(false)
        return
      }

      setConfirmedBooking(json.booking as Booking)
      setStep('success')
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.' : 'Could not reach the server. Check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setStep('teacher')
    setSelectedTeacher(null)
    setSelectedSlot(null)
    setConfirmedBooking(null)
    setError(null)
  }

  // ---------------- STEP: choose teacher ----------------
  if (step === 'teacher') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teachers.length === 0 && (
          <p className="text-ink-soft col-span-full text-sm">
            {isAr ? 'لا يوجد معلمون متاحون حاليًا.' : 'No teachers are available right now.'}
          </p>
        )}
        {teachers.map((teacher) => (
          <button
            key={teacher.id}
            onClick={() => selectTeacher(teacher)}
            className="card p-5 text-start transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-center gap-3">
              <div className="bg-sidr-100 text-sidr-700 font-display flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold">
                {teacher.full_name.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-sidr-900">{teacher.full_name}</p>
                {teacher.price_per_session != null && (
                  <p className="text-ink-soft text-xs">
                    {teacher.price_per_session} {isAr ? 'ج.م / جلسة' : 'EGP / session'}
                  </p>
                )}
              </div>
            </div>
            {teacher.bio && <p className="text-ink-soft mt-3 line-clamp-2 text-sm">{teacher.bio}</p>}
          </button>
        ))}
      </div>
    )
  }

  // ---------------- STEP: choose slot ----------------
  if (step === 'slot' && selectedTeacher) {
    const byDay = new Map<number, TeacherAvailability[]>()
    for (const s of slots) {
      byDay.set(s.day_of_week, [...(byDay.get(s.day_of_week) ?? []), s])
    }

    return (
      <div>
        <button onClick={reset} className="text-sm font-semibold text-sidr-700 hover:text-sidr-600">
          {isAr ? '‹ رجوع لاختيار المعلم' : '‹ Back to teachers'}
        </button>

        <h2 className="font-display mt-3 text-lg font-bold text-sidr-900">
          {isAr ? `الأوقات الفارغة — ${selectedTeacher.full_name}` : `Open times — ${selectedTeacher.full_name}`}
        </h2>
        <p className="text-ink-soft text-sm">{isAr ? 'الأسبوع الحالي' : 'This week'}</p>

        {loadingSlots ? (
          <p className="text-ink-soft mt-6 text-sm">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
        ) : slots.length === 0 ? (
          <p className="card text-ink-soft mt-6 p-6 text-sm">
            {isAr
              ? 'لا توجد مواعيد فارغة هذا الأسبوع مع هذا المعلم. جرّب معلمًا آخر أو راجع الأسبوع القادم.'
              : "No open slots this week with this teacher. Try another teacher or check back next week."}
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {[...byDay.entries()].map(([day, daySlots]) => (
              <div key={day}>
                <p className="text-sm font-semibold text-sidr-700">{formatDayName(day, locale)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {daySlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => selectSlot(slot)}
                      className="btn-secondary text-sm"
                    >
                      {formatTime(slot.start_time, locale)}
                      {slot.session_type === 'group' && (
                        <span className="text-ink-soft text-xs">
                          {' '}
                          · {isAr ? 'جماعي' : 'group'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ---------------- STEP: confirm ----------------
  if (step === 'confirm' && selectedSlot && selectedTeacher) {
    const dateKey = addDaysToDateKey(getWeekStartDate(), selectedSlot.day_of_week)

    return (
      <div className="mx-auto max-w-lg">
        <button
          onClick={() => setStep('slot')}
          className="text-sm font-semibold text-sidr-700 hover:text-sidr-600"
        >
          {isAr ? '‹ رجوع لاختيار الموعد' : '‹ Back to time selection'}
        </button>

        <div className="card mt-3 p-6">
          <h2 className="font-display text-lg font-bold text-sidr-900">
            {isAr ? 'تأكيد الحجز' : 'Confirm your booking'}
          </h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">{isAr ? 'المعلم' : 'Teacher'}</dt>
              <dd className="font-semibold text-sidr-900">{selectedTeacher.full_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{isAr ? 'التاريخ' : 'Date'}</dt>
              <dd className="font-semibold text-sidr-900">{formatDateReadable(dateKey, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{isAr ? 'الوقت' : 'Time'}</dt>
              <dd className="font-semibold text-sidr-900">{formatTime(selectedSlot.start_time, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">{isAr ? 'المدة' : 'Duration'}</dt>
              <dd className="font-semibold text-sidr-900">
                {selectedSlot.slot_duration_minutes} {isAr ? 'دقيقة' : 'min'}
              </dd>
            </div>
          </dl>

          {selectedSlot.session_type === 'individual' && (
            <div className="mt-5 border-t border-mist-dark pt-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-sidr-900">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="h-4 w-4 accent-sidr-700"
                />
                {isAr ? 'اجعلها جلسة أسبوعية ثابتة (اشتراك)' : 'Make this a standing weekly subscription'}
              </label>

              {recurring && (
                <div className="mt-3 space-y-3 ps-6">
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={pattern === 'weekly'}
                        onChange={() => setPattern('weekly')}
                        className="accent-sidr-700"
                      />
                      {isAr ? 'كل أسبوع' : 'Every week'}
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={pattern === 'biweekly'}
                        onChange={() => setPattern('biweekly')}
                        className="accent-sidr-700"
                      />
                      {isAr ? 'كل أسبوعين' : 'Every 2 weeks'}
                    </label>
                  </div>
                  <div>
                    <label className="text-ink-soft mb-1 block text-xs">
                      {isAr ? 'حتى تاريخ' : 'Until'}
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={dateKey}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-danger mt-4 text-sm font-medium">{error}</p>}

          <button onClick={handleConfirm} disabled={submitting} className="btn-primary mt-6 w-full">
            {submitting
              ? isAr
                ? 'جارٍ التأكيد...'
                : 'Confirming...'
              : isAr
                ? 'تأكيد الحجز'
                : 'Confirm booking'}
          </button>
        </div>
      </div>
    )
  }

  // ---------------- STEP: success ----------------
  if (step === 'success' && confirmedBooking) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <div className="bg-sidr-100 text-sidr-700 mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl">
            ✓
          </div>
          <h2 className="font-display mt-4 text-xl font-bold text-sidr-900">
            {isAr ? 'تم تأكيد حجزك!' : 'Your booking is confirmed!'}
          </h2>
          <p className="text-ink-soft mt-2 text-sm">
            {formatDateReadable(confirmedBooking.scheduled_date, locale)} ·{' '}
            {formatTime(confirmedBooking.time_slot, locale)}
          </p>

          {confirmedBooking.zoom_join_url && (
            <a href={confirmedBooking.zoom_join_url} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6 inline-flex">
              {isAr ? 'رابط الانضمام لِـ Zoom' : 'Zoom join link'}
            </a>
          )}

          <button onClick={reset} className="btn-secondary mt-3 block w-full">
            {isAr ? 'احجز جلسة أخرى' : 'Book another session'}
          </button>
        </div>
      </div>
    )
  }

  return null
}

