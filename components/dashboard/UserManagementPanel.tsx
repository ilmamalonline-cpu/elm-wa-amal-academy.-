'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/i18n/config'
import type { Profile, UserRole } from '@/types/database'

export function UserManagementPanel({
  locale,
  initialUsers,
}: {
  locale: Locale
  initialUsers: Profile[]
}) {
  const isAr = locale === 'ar'
  const [users, setUsers] = useState(initialUsers)
  const [filter, setFilter] = useState<UserRole | 'all'>('all')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const roleLabel: Record<UserRole, string> = isAr
    ? { admin: 'مدير', teacher: 'معلم', student: 'طالب' }
    : { admin: 'Admin', teacher: 'Teacher', student: 'Student' }

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter)

  async function toggleActive(user: Profile) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, is_active: !user.is_active }),
    })
    if (res.ok) {
      const json = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === user.id ? json.user : u)))
    }
  }

  async function deleteUser(user: Profile) {
    if (!confirm(isAr ? `حذف حساب ${user.full_name}؟ هذا الإجراء لا يمكن التراجع عنه.` : `Delete ${user.full_name}'s account? This cannot be undone.`)) {
      return
    }
    const res = await fetch(`/api/admin/users?user_id=${user.id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['all', 'teacher', 'student', 'admin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filter === r ? 'bg-sidr-700 text-gold-100' : 'text-ink-soft hover:bg-sidr-50'
              }`}
            >
              {r === 'all' ? (isAr ? 'الكل' : 'All') : roleLabel[r]}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreateForm((v) => !v)} className="btn-primary text-sm">
          {isAr ? '+ إضافة معلم' : '+ Add teacher'}
        </button>
      </div>

      {showCreateForm && (
        <CreateTeacherForm
          locale={locale}
          onCreated={(newUser) => {
            setUsers((prev) => [newUser, ...prev])
            setShowCreateForm(false)
          }}
        />
      )}

      <div className="mt-4 space-y-2">
        {filtered.map((u) => (
          <div key={u.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold text-sidr-900">
                {u.full_name}{' '}
                {!u.is_active && (
                  <span className="text-danger text-xs font-normal">({isAr ? 'موقوف' : 'suspended'})</span>
                )}
              </p>
              <p className="text-ink-soft text-xs" dir="ltr">
                {u.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge-gold">{roleLabel[u.role]}</span>
              {u.role !== 'admin' && (
                <>
                  <button
                    onClick={() => toggleActive(u)}
                    className="text-sm font-semibold text-sidr-700 hover:text-sidr-600"
                  >
                    {u.is_active ? (isAr ? 'إيقاف' : 'Suspend') : isAr ? 'تفعيل' : 'Activate'}
                  </button>
                  <button onClick={() => deleteUser(u)} className="text-danger text-sm font-semibold hover:underline">
                    {isAr ? 'حذف' : 'Delete'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-ink-soft text-sm">{isAr ? 'لا يوجد مستخدمون.' : 'No users found.'}</p>
        )}
      </div>
    </div>
  )
}

function CreateTeacherForm({
  locale,
  onCreated,
}: {
  locale: Locale
  onCreated: (user: Profile) => void
}) {
  const isAr = locale === 'ar'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [bio, setBio] = useState('')
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
        bio: bio || undefined,
        price_per_session: price ? Number(price) : undefined,
      }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(
        json.error === 'EMAIL_IN_USE'
          ? isAr
            ? 'هذا البريد مستخدم بالفعل'
            : 'This email is already in use'
          : isAr
            ? 'تعذر إنشاء الحساب'
            : 'Could not create account'
      )
      setSubmitting(false)
      return
    }

    onCreated(json.user as Profile)
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-4 space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={isAr ? 'الاسم الكامل' : 'Full name'}
          className="input-field"
        />
        <input
          required
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={isAr ? 'البريد الإلكتروني' : 'Email'}
          className="input-field"
        />
        <input
          required
          type="password"
          dir="ltr"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isAr ? 'كلمة مرور مؤقتة' : 'Temporary password'}
          className="input-field"
        />
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={isAr ? 'السعر / جلسة (اختياري)' : 'Price / session (optional)'}
          className="input-field"
        />
      </div>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder={isAr ? 'نبذة تعريفية (اختياري)' : 'Short bio (optional)'}
        rows={2}
        className="input-field resize-none"
      />
      {error && <p className="text-danger text-sm font-medium">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-primary text-sm">
        {submitting ? (isAr ? 'جارٍ الإنشاء...' : 'Creating...') : isAr ? 'إنشاء حساب المعلم' : 'Create teacher account'}
      </button>
    </form>
  )
}

