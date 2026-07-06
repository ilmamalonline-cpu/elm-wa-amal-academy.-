'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DAY_NAMES_AR, DAY_NAMES_EN } from '@/lib/utils/datetime'
import type { Locale } from '@/lib/i18n/config'
import type { StudentPreferences } from '@/types/database'

const HOUR_OPTIONS = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']

export function PreferencesForm({
  locale,
  initial,
}: {
  locale: Locale
  initial: StudentPreferences | null
}) {
  const isAr = locale === 'ar'
  const dayNames = isAr ? DAY_NAMES_AR : DAY_NAMES_EN
  const supabase = createClient()

  const [days, setDays] = useState<number[]>(initial?.preferred_days ?? [])
  const [hours, setHours] = useState<string[]>(initial?.preferred_hour_slots ?? [])
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()))
    setSaved(false)
  }

  function toggleHour(h: string) {
    setHours((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h].sort()))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError(isAr ? 'يجب تسجيل الدخول' : 'You must be logged in')
      setSaving(false)
      return
    }

    const { error: upsertError } = await supabase
      .from('student_preferences')
      .upsert(
        {
          student_id: user.id,
          preferred_days: days,
          preferred_hour_slots: hours,
          notes: notes || null,
        },
        { onConflict: 'student_id' }
      )

    if (upsertError) {
      setError(isAr ? 'تعذر الحفظ، حاول مرة أخرى' : 'Could not save, please try again')
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  return (
    <div className="card space-y-6 p-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-sidr-900">
          {isAr ? 'الأيام المفضلة' : 'Preferred days'}
        </p>
        <div className="flex flex-wrap gap-2">
          {dayNames.map((name, i) => (
            <button
              key={name}
              type="button"
              onClick={() => toggleDay(i)}
              className={`rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                days.includes(i)
                  ? 'border-sidr-700 bg-sidr-700 text-gold-100'
                  : 'border-mist-dark text-ink-soft hover:border-sidr-600'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-sidr-900">
          {isAr ? 'الأوقات المفضلة' : 'Preferred hours'}
        </p>
        <div className="flex flex-wrap gap-2">
          {HOUR_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => toggleHour(h)}
              className={`rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                hours.includes(h)
                  ? 'border-sidr-700 bg-sidr-700 text-gold-100'
                  : 'border-mist-dark text-ink-soft hover:border-sidr-600'
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="mb-2 block text-sm font-semibold text-sidr-900">
          {isAr ? 'ملاحظات إضافية (اختياري)' : 'Additional notes (optional)'}
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            setSaved(false)
          }}
          rows={3}
          className="input-field resize-none"
          placeholder={isAr ? 'مثال: أفضل الجلسات بعد صلاة العشاء' : "e.g. I prefer sessions after evening prayer"}
        />
      </div>

      {error && <p className="text-danger text-sm font-medium">{error}</p>}
      {saved && !error && (
        <p className="text-sm font-medium text-sidr-700">{isAr ? '✓ تم الحفظ' : '✓ Saved'}</p>
      )}

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
        {saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : isAr ? 'حفظ التفضيلات' : 'Save preferences'}
      </button>
    </div>
  )
}

