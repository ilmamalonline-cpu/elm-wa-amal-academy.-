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

test('trigger-only lesson guards are not exposed as public API functions', async () => {
  const sql = await readFile(resolve(root, 'supabase/migrations/20261120_restrict_trigger_execute.sql'), 'utf8')
  assert.match(sql, /revoke execute on function public\.academy_teacher_outcome_only\(\) from public, anon, authenticated/i)
})

test('teacher invite bearer tokens travel in the fragment and are removed from browser history', async () => {
  const admin = await readFile(resolve(root, 'components/dashboard/AdminWorkspace.tsx'), 'utf8')
  const form = await readFile(resolve(root, 'components/auth/TeacherInviteForm.tsx'), 'utf8')
  const route = await readFile(resolve(root, 'app/teacher-invite/page.tsx'), 'utf8')
  assert.match(admin, /link\.hash = new URLSearchParams\(\{ token \}\)/)
  assert.doesNotMatch(admin, /searchParams\.set\('token'/)
  assert.match(form, /window\.location\.hash/)
  assert.match(form, /window\.history\.replaceState/)
  assert.doesNotMatch(route, /searchParams\.get\(['"]token['"]\)/)
})

test('legacy booking and Zoom meeting creation routes are not shipped in the active app', () => {
  assert.equal(existsSync(resolve(root, 'lib/zoom/client.ts')), false)
  assert.equal(existsSync(resolve(root, 'app/api/bookings/create/route.ts')), false)
  assert.equal(existsSync(resolve(root, 'app/dashboard/student')), false)
})

test('verified existing owners bootstrap admin access independently of guardian profile creation', async () => {
  const portal = await readFile(resolve(root, 'lib/auth/getPortal.ts'), 'utf8')
  const proxy = await readFile(resolve(root, 'proxy.ts'), 'utf8')
  const guardian = await readFile(resolve(root, 'app/dashboard/guardian/page.tsx'), 'utf8')
  const shell = await readFile(resolve(root, 'components/dashboard/PortalShell.tsx'), 'utf8')
  assert.match(portal, /user\.email_confirmed_at/)
  assert.match(portal, /user\.email\?\.trim\(\)\.toLowerCase\(\) === OWNER_EMAIL/)
  assert.match(portal, /ignoreDuplicates: true/)
  assert.match(portal, /if \(bootstrapError\) throw new Error/)
  assert.doesNotMatch(proxy, /requestedRole !== role/)
  assert.match(guardian, /primaryRole=\{role\}/)
  assert.match(shell, /href="\/dashboard\/guardian"/)
})


test('PKCE confirmation callbacks exchange codes and reject cross-origin destinations', async () => {
  const callback = await readFile(resolve(root, 'app/auth/callback/route.ts'), 'utf8')
  const register = await readFile(resolve(root, 'components/auth/RegisterForm.tsx'), 'utf8')
  const teacher = await readFile(resolve(root, 'components/auth/TeacherInviteForm.tsx'), 'utf8')
  assert.match(callback, /exchangeCodeForSession\(code\)/)
  assert.match(callback, /destination\.origin === origin/)
  assert.match(register, /emailRedirectTo: callback\.toString\(\)/)
  assert.match(teacher, /emailRedirectTo: callback\.toString\(\)/)
  assert.match(teacher, /teacher-invite\?confirmed=1/)
  assert.match(teacher, /Reopen the original invitation link/)
})

test('registration trigger migration explicitly rebinds the reviewed owner-only trigger', async () => {
  const sql = await readFile(resolve(root, 'supabase/migrations/20261120_restrict_trigger_execute.sql'), 'utf8')
  assert.match(sql, /ACADEMY_REGISTRATION_OWNER_ONLY/)
  assert.match(sql, /drop trigger if exists academy_enforce_registration_mode on auth\.users/i)
  assert.match(sql, /create trigger academy_enforce_registration_mode[\s\S]*execute function public\.academy_enforce_registration_mode\(\)/i)
})

test('guardian and child rows cannot be directly deleted through authenticated access', async () => {
  const sql = await readFile(resolve(root, 'supabase/migrations/20261120_prevent_guardian_record_deletes.sql'), 'utf8')
  assert.match(sql, /drop policy if exists academy_children_delete_own/i)
  assert.match(sql, /drop policy if exists academy_guardians_delete_own/i)
  assert.match(sql, /revoke delete on table public\.academy_children from public, anon, authenticated/i)
  assert.match(sql, /revoke delete on table public\.academy_guardians from public, anon, authenticated/i)
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\bdelete\s+from\b|\btruncate\b/i)
})
