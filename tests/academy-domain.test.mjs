import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createInvitationToken,
  hashInvitationToken,
  normalizeEmail,
  outcomeLabel,
  signupModeAllows,
  subjectLabel,
  validateChildInput,
  zonedLocalDateTimeToIso,
} from '../lib/academy/domain.ts'

const root = resolve(import.meta.dirname, '..')

test('registration-mode helper permits only the configured owner during owner-only preview', () => {
  assert.equal(signupModeAllows('owner_only', '  ABDELRAHMANBAKRI113@GMAIL.COM  '), true)
  assert.equal(signupModeAllows('owner_only', 'someone@example.com'), false)
  assert.equal(signupModeAllows('closed', 'abdelrahmanbakri113@gmail.com'), false)
  assert.equal(signupModeAllows('open', 'family@example.com'), true)
  assert.equal(normalizeEmail(' Family@Example.com '), 'family@example.com')
})

test('child validation rejects blank names, invalid years, and future birth years', () => {
  assert.equal(validateChildInput('  ', 2018, 2026), 'name')
  assert.equal(validateChildInput('Child', 1999, 2026), 'birthYear')
  assert.equal(validateChildInput('Child', 2027, 2026), 'birthYear')
  assert.equal(validateChildInput('Child', 2018, 2026), null)
})

test('subject and outcome labels cover the academy session categories in both locales', () => {
  assert.equal(subjectLabel('nur_al_bayan', 'ar'), 'نور البيان')
  assert.equal(subjectLabel('tajweed', 'en'), 'Tajweed')
  assert.equal(outcomeLabel('absent', 'ar'), 'لم يحضر')
  assert.equal(outcomeLabel(null, 'en'), 'Outcome pending')
})

test('wall-clock scheduling converts Cairo winter and summer times correctly', () => {
  assert.equal(zonedLocalDateTimeToIso('2026-11-16T12:30', 'Africa/Cairo'), '2026-11-16T10:30:00.000Z')
  assert.equal(zonedLocalDateTimeToIso('2026-06-15T12:30', 'Africa/Cairo'), '2026-06-15T09:30:00.000Z')
  assert.throws(() => zonedLocalDateTimeToIso('not-a-date', 'Africa/Cairo'), /Invalid local date-time/)
})

test('teacher invite tokens are high-entropy URL-safe values stored as a SHA-256 hash', async () => {
  const token = createInvitationToken()
  assert.match(token, /^[A-Za-z0-9_-]{43}$/)
  const hash = await hashInvitationToken(token)
  assert.match(hash, /^[a-f0-9]{64}$/)
  assert.notEqual(hash, token)
})

test('release migration defaults signup to owner-only and gates auth.users inserts', async () => {
  const sql = await readFile(resolve(root, 'supabase/migrations/20261116_guardian_platform_release.sql'), 'utf8')
  assert.match(sql, /signup_mode text not null default 'owner_only'/i)
  assert.match(sql, /before insert on auth\.users/i)
  assert.match(sql, /academy_registration_owner_only/i)
  assert.match(sql, /u\.email_confirmed_at is not null/i)
  assert.match(sql, /academy_is_admin\(\)/i)
  assert.match(sql, /academy_teacher_roster\(\)/i)
  assert.match(sql, /academy_accept_teacher_invite\(/i)
  assert.match(sql, /old\.ends_at > now\(\)/i)
  assert.match(sql, /academy_individual_lessons_cancelled_outcome_check/i)
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\btruncate\b/i)
})

test('teacher invite bearer tokens travel in the fragment and are removed from browser history', async () => {
  const admin = await readFile(resolve(root, 'components/dashboard/AdminWorkspace.tsx'), 'utf8')
  const form = await readFile(resolve(root, 'components/auth/TeacherInviteForm.tsx'), 'utf8')
  const route = await readFile(resolve(root, 'app/teacher-invite/page.tsx'), 'utf8')
  assert.match(admin, /link\.hash = new URLSearchParams\(\{ token \}\)/)
  assert.doesNotMatch(admin, /searchParams\.set\('token'/)
  assert.match(form, /window\.location\.hash/)
  assert.match(form, /window\.history\.replaceState/)
  assert.doesNotMatch(route, /searchParams/)
})

test('legacy booking and Zoom meeting creation routes are not shipped in the active app', () => {
  assert.equal(existsSync(resolve(root, 'lib/zoom/client.ts')), false)
  assert.equal(existsSync(resolve(root, 'app/api/bookings/create/route.ts')), false)
  assert.equal(existsSync(resolve(root, 'app/dashboard/student')), false)
})
