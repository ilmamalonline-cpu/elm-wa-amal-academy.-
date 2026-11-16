export type Locale = 'ar' | 'en'
export type Subject = 'quran' | 'nur_al_bayan' | 'tajweed'
export type LessonOutcome = 'attended_completed' | 'attended_incomplete' | 'absent'

export const OWNER_EMAIL = 'abdelrahmanbakri113@gmail.com'
export const CONSENT_VERSION = 'academy-family-2026-11'

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function validateChildInput(name: string, birthYear: number, currentYear = new Date().getFullYear()): string | null {
  if (name.trim().length < 1 || name.trim().length > 200) return 'name'
  if (!Number.isInteger(birthYear) || birthYear < 2000 || birthYear > currentYear) return 'birthYear'
  return null
}

export function subjectLabel(subject: Subject, locale: Locale): string {
  const labels: Record<Subject, Record<Locale, string>> = {
    quran: { ar: 'القرآن الكريم', en: 'Quran' },
    nur_al_bayan: { ar: 'نور البيان', en: 'Nur al-Bayan' },
    tajweed: { ar: 'التجويد', en: 'Tajweed' },
  }
  return labels[subject][locale]
}

export function outcomeLabel(outcome: LessonOutcome | null, locale: Locale): string {
  if (!outcome) return locale === 'ar' ? 'بانتظار تسجيل النتيجة' : 'Outcome pending'
  const labels: Record<LessonOutcome, Record<Locale, string>> = {
    attended_completed: { ar: 'حضر وأكمل الجلسة', en: 'Attended and completed' },
    attended_incomplete: { ar: 'حضر — متابعة مطلوبة', en: 'Attended — follow-up needed' },
    absent: { ar: 'لم يحضر', en: 'Absent' },
  }
  return labels[outcome][locale]
}

export function formatLessonTime(iso: string, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso))
}

export function zonedLocalDateTimeToIso(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error('Invalid local date-time')
  const [, year, month, day, hour, minute] = match.map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let guess = target
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(guess))
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute))
    guess = target - (represented - guess)
  }
  const check = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(guess))
  const actual = Object.fromEntries(check.map((part) => [part.type, part.value]))
  if (Number(actual.year) !== year || Number(actual.month) !== month || Number(actual.day) !== day || Number(actual.hour) !== hour || Number(actual.minute) !== minute) {
    throw new Error('Local date-time does not exist in the selected time zone')
  }
  return new Date(guess).toISOString()
}

export type SignupMode = 'owner_only' | 'open' | 'closed'

export function signupModeAllows(mode: SignupMode, email: string, ownerEmail = OWNER_EMAIL): boolean {
  if (mode === 'open') return true
  if (mode === 'owner_only') return normalizeEmail(email) === normalizeEmail(ownerEmail)
  return false
}

export function createInvitationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export async function hashInvitationToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
