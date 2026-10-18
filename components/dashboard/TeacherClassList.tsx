'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  formatDateReadable,
  formatDayName,
  formatTime,
  getLastOccurrenceOnOrBefore,
  getNextOccurrenceDate,
} from '@/lib/utils/datetime'
import { CancelBookingButton } from '@/components/dashboard/CancelBookingButton'
import type { Locale } from '@/lib/i18n/config'
import type { Booking, Profile, TajweedError } from '@/types/database'

const ERROR_TYPES_AR = ['إدغام', 'إخفاء', 'إظهار', 'قلقلة', 'مد', 'غنة', 'مخرج حرف', 'أخرى']
const ERROR_TYPES_EN = ['Idghaam', 'Ikhfaa', 'Izhaar', 'Qalqalah', 'Madd', 'Ghunnah', 'Articulation point', 'Other']

export function TeacherClassList({
  locale,
  bookings,
  students,
  feedbackDates,
  todayKey,
}: {
  locale: Locale
  bookings: Booking[]
  students: Pick<Profile, 'id' | 'full_name'>[]
  /** booking id -> session dates that already have feedback */
  feedbackDates: Record<string, string[]>
  /** today in Africa/Cairo, computed on the server so SSR and the browser agree */
  todayKey: string
}) {
  const isAr = locale === 'ar'
  const studentById = new Map(students.map((s) => [s.id, s.full_name]))
  const [openFeedbackFor, setOpenFeedbackFor] = useState<string | null>(null)
  const [doneDates, setDoneDates] = useState<Record<string, string[]>>(feedbackDates)

  const upcoming = bookings.filter((b) => b.status === 'confirmed')
  const completed = bookings.filter((b) => b.status === 'completed')

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-lg font-bold text-sidr-900">
          {isAr ? 'القادمة' : 'Upcoming'}
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-ink-soft mt-3 text-sm">{isAr ? 'لا توجد فصول قادمة.' : 'No upcoming classes.'}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {upcoming.map((b) => {
              const displayDate = b.is_recurring
                ? getNextOccurrenceDate({
                    firstDate: b.scheduled_date,
                    pattern: b.recurrence_pattern,
                    recurrenceEndDate: b.recurrence_end_date,
                    todayKey,
                  })
                : b.scheduled_date

              // Feedback is per session: the most recent session that has already
              // happened and doesn't have feedback yet (null = nothing to log yet).
              const lastHeld = getLastOccurrenceOnOrBefore(b, todayKey)
              const feedbackDate = lastHeld && !(doneDates[b.id] ?? []).includes(lastHeld) ? lastHeld : null

              return (
                <div key={b.id} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sidr-900">{studentById.get(b.student_id) ?? '—'}</p>
                      <p className="text-ink-soft text-sm">
                        {displayDate ? (
                          <>
                            {formatDayName(b.day_of_week, locale)} · {formatDateReadable(displayDate, locale)} ·{' '}
                          </>
                        ) : (
                          <>{isAr ? 'انتهى الاشتراك · ' : 'Series ended · '}</>
                        )}
                        {formatTime(b.time_slot, locale)}
                      </p>
                      <div className="mt-1.5 flex gap-1.5">
                        {b.is_recurring && (
                          <span className="badge-gold">{isAr ? '🔁 متكرر' : '🔁 Recurring'}</span>
                        )}
                        {b.session_type === 'group' && (
                          <span className="badge-gold">{isAr ? '👥 جماعي' : '👥 Group'}</span>
                        )}
                      </div>
                    </div>
                    {b.zoom_meeting_id && (
                      // Fresh host link fetched server-side on click (never stored / never sent to students).
                      <a
                        href={`/api/bookings/start?booking_id=${b.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary text-sm"
                      >
                        {isAr ? '🎥 ابدأ الجلسة' : '🎥 Start Session'}
                      </a>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4">
                    {feedbackDate ? (
                      <button
                        onClick={() => setOpenFeedbackFor(openFeedbackFor === b.id ? null : b.id)}
                        className="text-sm font-semibold text-sidr-700 hover:text-sidr-600"
                      >
                        {isAr ? 'تسجيل ملاحظات الجلسة' : 'Log session feedback'}
                        {b.is_recurring && <> · {formatDateReadable(feedbackDate, locale)}</>}
                      </button>
                    ) : (
                      <span className="text-ink-soft text-xs">
                        {isAr ? 'تُسجَّل الملاحظات بعد انتهاء الجلسة' : 'Feedback can be logged once the session has taken place'}
                      </span>
                    )}
                    <CancelBookingButton bookingId={b.id} locale={locale} />
                  </div>

                  {openFeedbackFor === b.id && feedbackDate && (
                    <FeedbackForm
                      locale={locale}
                      booking={b}
                      sessionDate={feedbackDate}
                      onDone={() => {
                        setDoneDates((prev) => ({ ...prev, [b.id]: [...(prev[b.id] ?? []), feedbackDate] }))
                        setOpenFeedbackFor(null)
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-sidr-900">
          {isAr ? 'المكتملة' : 'Completed'}
        </h2>
        {completed.length === 0 ? (
          <p className="text-ink-soft mt-3 text-sm">{isAr ? 'لا توجد فصول مكتملة بعد.' : 'No completed classes yet.'}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {completed.map((b) => (
              <div key={b.id} className="card flex items-center justify-between p-5">
                <div>
                  <p className="font-semibold text-sidr-900">{studentById.get(b.student_id) ?? '—'}</p>
                  <p className="text-ink-soft text-sm">
                    {formatDateReadable(b.scheduled_date, locale)} · {formatTime(b.time_slot, locale)}
                  </p>
                </div>
                {(doneDates[b.id]?.length ?? 0) > 0 && (
                  <span className="text-xs font-semibold text-sidr-700">
                    {isAr ? '✓ تم تسجيل الملاحظات' : '✓ Feedback logged'}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

const FEEDBACK_ERRORS_AR: Record<string, string> = {
  FEEDBACK_ALREADY_EXISTS: 'تم تسجيل ملاحظات هذه الجلسة بالفعل.',
  SESSION_NOT_HELD_YET: 'لا يمكن تسجيل الملاحظات قبل موعد الجلسة.',
  NOT_AUTHORIZED: 'هذا الفصل ليس من فصولك.',
  BOOKING_NOT_ACTIVE: 'هذا الحجز لم يعد نشطًا.',
  INVALID_SESSION_DATE: 'تاريخ الجلسة غير صحيح.',
}
const FEEDBACK_ERRORS_EN: Record<string, string> = {
  FEEDBACK_ALREADY_EXISTS: 'Feedback for this session was already saved.',
  SESSION_NOT_HELD_YET: "You can't log feedback before the session takes place.",
  NOT_AUTHORIZED: "This isn't one of your classes.",
  BOOKING_NOT_ACTIVE: 'This booking is no longer active.',
  INVALID_SESSION_DATE: 'Invalid session date.',
}

function FeedbackForm({
  locale,
  booking,
  sessionDate,
  onDone,
}: {
  locale: Locale
  booking: Booking
  sessionDate: string
  onDone: () => void
}) {
  const isAr = locale === 'ar'
  const errorTypes = isAr ? ERROR_TYPES_AR : ERROR_TYPES_EN
  const router = useRouter()

  const [notes, setNotes] = useState('')
  const [homework, setHomework] = useState('')
  const [rating, setRating] = useState(0)
  const [errors, setErrors] = useState<TajweedError[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addErrorRow() {
    setErrors((prev) => [...prev, { letter: '', error_type: errorTypes[0], correction: '' }])
  }

  function updateErrorRow(index: number, field: keyof TajweedError, value: string) {
    setErrors((prev) => prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)))
  }

  function removeErrorRow(index: number) {
    setErrors((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
          session_date: sessionDate,
          articulation_notes: notes || undefined,
          homework: homework || undefined,
          rating: rating || undefined,
          tajweed_errors: errors.filter((e) => e.letter || e.correction),
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        const known = (isAr ? FEEDBACK_ERRORS_AR : FEEDBACK_ERRORS_EN)[json.error as string]
        setError(known ?? (isAr ? 'تعذر الحفظ' : 'Could not save'))
        setSubmitting(false)
        return
      }
      router.refresh()
      onDone()
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم' : 'Could not reach the server')
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-mist-dark pt-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-sidr-900">
          {isAr ? 'ملاحظات النطق' : 'Articulation notes'}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="input-field resize-none"
          placeholder={isAr ? 'مثال: صعوبة في إخراج حرف الضاد...' : 'e.g. Difficulty with the ض articulation point...'}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-semibold text-sidr-900">
            {isAr ? 'أخطاء تجويدية محددة (اختياري)' : 'Specific tajweed errors (optional)'}
          </label>
          <button type="button" onClick={addErrorRow} className="text-xs font-semibold text-sidr-700 hover:text-sidr-600">
            {isAr ? '+ إضافة' : '+ Add'}
          </button>
        </div>
        {errors.map((err, i) => (
          <div key={i} className="mb-2 flex flex-wrap gap-2">
            <input
              value={err.letter}
              onChange={(e) => updateErrorRow(i, 'letter', e.target.value)}
              placeholder={isAr ? 'الحرف' : 'Letter'}
              className="input-field w-20"
            />
            <select
              value={err.error_type}
              onChange={(e) => updateErrorRow(i, 'error_type', e.target.value)}
              className="input-field w-auto"
            >
              {errorTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={err.correction}
              onChange={(e) => updateErrorRow(i, 'correction', e.target.value)}
              placeholder={isAr ? 'التصحيح المقترح' : 'Suggested correction'}
              className="input-field flex-1 min-w-32"
            />
            <button type="button" onClick={() => removeErrorRow(i)} className="text-danger px-2 text-sm">
              ✕
            </button>
          </div>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-sidr-900">
          {isAr ? 'الواجب المنزلي' : 'Homework'}
        </label>
        <input
          value={homework}
          onChange={(e) => setHomework(e.target.value)}
          className="input-field"
          placeholder={isAr ? 'مثال: تكرار سورة الفاتحة 10 مرات مع التركيز على المخارج' : 'e.g. Repeat Al-Fatiha 10 times focusing on articulation points'}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-sidr-900">
          {isAr ? 'تقييم الأداء العام' : 'Overall performance rating'}
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={`text-2xl ${n <= rating ? 'text-gold-600' : 'text-mist-dark'}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-danger text-sm font-medium">{error}</p>}

      <button onClick={handleSubmit} disabled={submitting} className="btn-primary">
        {submitting ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : isAr ? 'حفظ الملاحظات' : 'Save feedback'}
      </button>
    </div>
  )
}

