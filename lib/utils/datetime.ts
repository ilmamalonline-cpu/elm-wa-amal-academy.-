// lib/utils/datetime.ts
//
// Convention used throughout this app (must match supabase/schema.sql):
// - week_start_date = the SUNDAY of a given week, as 'YYYY-MM-DD'
// - day_of_week = 0 (Sunday) .. 6 (Saturday), matching JS Date#getDay()
// - an exact calendar date = week_start_date + day_of_week days

export const DAY_NAMES_AR = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const

export const DAY_NAMES_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

/** 'YYYY-MM-DD' for a Date, in LOCAL time (not UTC) — avoids off-by-one * day bugs from toISOString() shifting the date near midnight. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** The Sunday that starts the week containing `date` (local time). */
export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return toDateKey(d)
}

/** week_start_date ('YYYY-MM-DD') + day_of_week (0-6) -> 'YYYY-MM-DD' */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

/** All wall-clock times entered/shown in this app (the availability grid, * the booking confirmation, the countdown timer) are Africa/Cairo local * time — this is a single-country academy, so there's no per-user * timezone selection. Cairo is NOT a fixed UTC+2: Egypt reinstated * Daylight Saving Time in 2023 (Law No. 24/2023) and now observes * EEST (UTC+3) from the last Friday of April to the last Thursday of * October, and EET (UTC+2) the rest of the year — so the offset must be * computed per-date rather than hardcoded. */
export const ACADEMY_TIMEZONE = 'Africa/Cairo'

/** Minutes to ADD to a UTC instant to get Africa/Cairo wall-clock time at * that instant (positive = ahead of UTC), computed via the ICU tzdata * built into Node.js/browsers — so DST transitions are handled * correctly without hardcoding any offset or transition dates. */
function getCairoOffsetMinutes(utcInstant: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: ACADEMY_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(utcInstant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asIfUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  )
  return Math.round((asIfUtc - utcInstant.getTime()) / 60000)
}

/** Converts a Cairo LOCAL wall-clock date+time (e.g. a teacher's * availability slot: "2026-07-04" "18:00:00") into the true UTC instant, * as an ISO 8601 string with a 'Z' suffix — correct for both EET and * EEST periods. Used anywhere we need an unambiguous absolute instant: * the countdown timer's ms-until math, and the Zoom meeting's * start_time. */
export function cairoWallTimeToUtcIso(dateKey: string, timeKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const [hh, mm, ss] = timeKey.split(':').map(Number)

  // Pass 1: naively treat the wall-clock components as UTC, then measure
  // Cairo's offset at that approximate instant.
  const naiveUtcMs = Date.UTC(y, m - 1, d, hh, mm, ss ?? 0)
  const offsetMinutes = getCairoOffsetMinutes(new Date(naiveUtcMs))

  // Pass 2: the real UTC instant is the naive one MINUS the offset (since
  // Cairo local = UTC + offset, therefore UTC = Cairo local - offset).
  const realUtcMs = naiveUtcMs - offsetMinutes * 60000
  return new Date(realUtcMs).toISOString()
}

/** 'YYYY-MM-DD' for RIGHT NOW in Africa/Cairo, regardless of what * timezone the current process itself is running in. Use this (not * `toDateKey(new Date())`) in Server Components / API routes that need * "today" — server runtimes (e.g. Vercel functions) run in UTC, which * can be a different calendar date than Cairo for a few hours around * midnight. Client Components calling `getWeekStartDate()` don't need * this — a Cairo-based user's own browser clock is already correct. */
export function getCairoTodayKey(): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: ACADEMY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return dtf.format(new Date()) // en-CA locale formats as YYYY-MM-DD
}

/** The Sunday that starts the current week in Africa/Cairo (what the teacher
 * grid and the student booking page both use, so they always agree on
 * "this week" regardless of the viewer's own browser timezone). */
export function getCairoWeekStartDate(): string {
  const today = getCairoTodayKey()
  const [y, m, d] = today.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return addDaysToDateKey(today, -dayOfWeek)
}

/** Milliseconds until a given Cairo-local date/time. Negative if already past. */
export function msUntil(dateKey: string, timeKey: string): number {
  return new Date(cairoWallTimeToUtcIso(dateKey, timeKey)).getTime() - Date.now()
}

export function formatDayName(dayOfWeek: number, locale: 'ar' | 'en'): string {
  return locale === 'ar' ? DAY_NAMES_AR[dayOfWeek] : DAY_NAMES_EN[dayOfWeek]
}

/** '14:00:00' -> '02:00 م' (ar) or '2:00 PM' (en) */
export function formatTime(timeKey: string, locale: 'ar' | 'en'): string {
  const [hStr, mStr] = timeKey.split(':')
  const h = Number(hStr)
  const period = h >= 12 ? (locale === 'ar' ? 'م' : 'PM') : locale === 'ar' ? 'ص' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${period}`
}

export function formatDateReadable(dateKey: string, locale: 'ar' | 'en'): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Whole days from dateKey `a` to dateKey `b` (b - a). Uses UTC math so DST never skews it. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

type SeriesShape = {
  scheduled_date: string
  is_recurring: boolean
  recurrence_end_date: string | null
  recurrence_pattern?: string | null
}

function stepDaysOf(pattern: string | null | undefined): number {
  return pattern === 'biweekly' ? 14 : 7
}

/**
 * For a recurring booking, computes the next occurrence date on or after
 * `todayKey` (defaults to today in Africa/Cairo — NOT the running process's
 * own local date, which matters on a UTC server) without needing a database
 * row per week. Returns null if the series has already ended.
 *
 * Pure arithmetic (no loop cap), so a series that started years ago still
 * resolves correctly.
 */
export function getNextOccurrenceDate(params: {
  firstDate: string
  pattern: string
  recurrenceEndDate: string | null
  todayKey?: string
}) {
  const { firstDate, pattern, recurrenceEndDate, todayKey = getCairoTodayKey() } = params
  const step = stepDaysOf(pattern)

  const diff = daysBetween(firstDate, todayKey)
  const candidate = diff <= 0 ? firstDate : addDaysToDateKey(firstDate, Math.ceil(diff / step) * step)

  if (recurrenceEndDate && candidate > recurrenceEndDate) return null
  return candidate
}

/**
 * The most recent occurrence on or before `dateKey` (defaults to today in
 * Cairo), or null if the series hasn't started yet. For one-off bookings
 * this is scheduled_date when it's not in the future. Used to decide which
 * session a teacher is logging feedback for.
 */
export function getLastOccurrenceOnOrBefore(booking: SeriesShape, dateKey: string = getCairoTodayKey()): string | null {
  if (!booking.is_recurring) {
    return booking.scheduled_date <= dateKey ? booking.scheduled_date : null
  }
  const diff = daysBetween(booking.scheduled_date, dateKey)
  if (diff < 0) return null
  const step = stepDaysOf(booking.recurrence_pattern)
  let candidate = addDaysToDateKey(booking.scheduled_date, Math.floor(diff / step) * step)
  if (booking.recurrence_end_date && candidate > booking.recurrence_end_date) {
    // Series already ended: the last occurrence is the last step on/before the end date.
    const endDiff = daysBetween(booking.scheduled_date, booking.recurrence_end_date)
    if (endDiff < 0) return null
    candidate = addDaysToDateKey(booking.scheduled_date, Math.floor(endDiff / step) * step)
  }
  return candidate
}

/**
 * True if a booking (recurring or not) has a session on exactly `dateKey`.
 * One-off bookings match only their own date; recurring ones match on the
 * weekly/biweekly step measured from the first occurrence, and stop at
 * recurrence_end_date.
 */
export function isOccurringOnDate(booking: SeriesShape & { day_of_week?: number }, dateKey: string) {
  if (!booking.is_recurring) return booking.scheduled_date === dateKey

  const diffDays = daysBetween(booking.scheduled_date, dateKey)
  if (diffDays < 0 || diffDays % stepDaysOf(booking.recurrence_pattern) !== 0) return false
  if (booking.recurrence_end_date && dateKey > booking.recurrence_end_date) return false
  return true
}

export function breakdownDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds, totalSeconds }
}
