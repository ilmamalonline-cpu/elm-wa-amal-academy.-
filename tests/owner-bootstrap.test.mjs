import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// Exercise the real server role resolver without making network or database calls.
// Only these framework boundaries are replaced; no account or family data is modified.
const modules = {
  'next/navigation': `export function redirect(path) { throw new Error('redirect:' + path) }`,
  '@/lib/supabase/server': `export async function createClient() { return globalThis.__academyTestClient }`,
  '@/lib/academy/domain': `export const OWNER_EMAIL = 'abdelrahmanbakri113@gmail.com'`,
}
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(modules, specifier)) {
      return { url: `data:text/javascript,${encodeURIComponent(modules[specifier])}`, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})
const { getPortalRole } = await import('../lib/auth/getPortal.ts')
hooks.deregister()

function clientFor({ user, admin = null, bootstrapError = null, teacher = null }) {
  const calls = { adminSelects: 0, bootstraps: 0, teacherSelects: 0 }
  return {
    calls,
    auth: { getUser: async () => ({ data: { user } }) },
    from(table) {
      return {
        select() {
          if (table === 'academy_admins') calls.adminSelects++
          if (table === 'academy_teachers') calls.teacherSelects++
          return {
            eq() { return this },
            async maybeSingle() {
              return { data: table === 'academy_admins' ? admin : teacher, error: null }
            },
          }
        },
        async upsert(row, options) {
          assert.equal(table, 'academy_admins')
          assert.deepEqual(row, { id: user.id })
          assert.deepEqual(options, { onConflict: 'id', ignoreDuplicates: true })
          calls.bootstraps++
          return { error: bootstrapError }
        },
      }
    },
  }
}

const owner = { id: 'owner-id', email: 'abdelrahmanbakri113@gmail.com', email_confirmed_at: '2026-01-01T00:00:00Z' }

test('concurrent first owner requests bootstrap without a duplicate stale verification read', async () => {
  const client = clientFor({ user: owner })
  globalThis.__academyTestClient = client
  const results = await Promise.all([getPortalRole(), getPortalRole()])
  assert.deepEqual(results.map(({ role }) => role), ['admin', 'admin'])
  assert.equal(client.calls.adminSelects, 2)
  assert.equal(client.calls.bootstraps, 2)
  assert.equal(client.calls.teacherSelects, 0)
})

test('owner bootstrap errors fail closed rather than granting administrator access', async () => {
  const client = clientFor({ user: owner, bootstrapError: { message: 'denied' } })
  globalThis.__academyTestClient = client
  await assert.rejects(getPortalRole(), /Unable to initialize owner administrator access/)
  assert.equal(client.calls.bootstraps, 1)
})

test('unconfirmed owner and other adults never trigger owner bootstrap', async () => {
  for (const user of [
    { ...owner, email_confirmed_at: null },
    { ...owner, id: 'other-id', email: 'another@example.com' },
  ]) {
    const client = clientFor({ user })
    globalThis.__academyTestClient = client
    assert.equal((await getPortalRole()).role, 'guardian')
    assert.equal(client.calls.bootstraps, 0)
  }
})

test('an existing administrator needs no bootstrap write', async () => {
  const client = clientFor({ user: owner, admin: { id: owner.id } })
  globalThis.__academyTestClient = client
  assert.equal((await getPortalRole()).role, 'admin')
  assert.equal(client.calls.bootstraps, 0)
})
