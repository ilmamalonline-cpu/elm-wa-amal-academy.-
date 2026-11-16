'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createInvitationToken, formatLessonTime, hashInvitationToken, subjectLabel, zonedLocalDateTimeToIso, type Locale } from '@/lib/academy/domain'

type ChildRow = { id: string; guardian_id: string; display_name: string; created_at: string }
type TeacherRow = { id: string; display_name: string; time_zone: string; status: 'active' | 'suspended'; created_at: string }
type AssignmentRow = { teacher_id: string; child_id: string; status: 'active' | 'inactive' }
type LessonRow = { id: string; teacher_id: string; child_id: string; subject: 'quran' | 'nur_al_bayan' | 'tajweed'; starts_at: string; ends_at: string; time_zone: string; status: 'scheduled' | 'cancelled'; outcome: 'attended_completed' | 'attended_incomplete' | 'absent' | null }
type InviteRow = { id: string; invited_email: string; display_name: string; created_at: string; expires_at: string; accepted_at: string | null }

export function AdminWorkspace({ locale }: { locale: Locale }) {
  const ar = locale === 'ar'
  const supabase = useMemo(() => createClient(), [])
  const [admin, setAdmin] = useState(false)
  const [userId, setUserId] = useState('')
  const [children, setChildren] = useState<ChildRow[]>([])
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [childId, setChildId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [subject, setSubject] = useState<'quran' | 'nur_al_bayan' | 'tajweed'>('quran')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    const { data: adminRow } = await supabase.from('academy_admins').select('id').eq('id', user.id).maybeSingle()
    setAdmin(Boolean(adminRow))
    if (!adminRow) { setLoading(false); return }
    const [childResult, teacherResult, assignmentResult, lessonResult, inviteResult] = await Promise.all([
      supabase.from('academy_children').select('id,guardian_id,display_name,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('academy_teachers').select('id,display_name,time_zone,status,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('academy_teacher_assignments').select('teacher_id,child_id,status').limit(200),
      supabase.from('academy_individual_lessons').select('id,teacher_id,child_id,subject,starts_at,ends_at,time_zone,status,outcome').order('starts_at', { ascending: true }).limit(100),
      supabase.from('academy_teacher_invites').select('id,invited_email,display_name,created_at,expires_at,accepted_at').order('created_at', { ascending: false }).limit(20),
    ])
    setChildren(childResult.data ?? [])
    setTeachers(teacherResult.data ?? [])
    setAssignments(assignmentResult.data ?? [])
    setLessons(lessonResult.data ?? [])
    setInvites(inviteResult.data ?? [])
    if (childResult.error || teacherResult.error || lessonResult.error) setError(ar ? 'تعذّر تحميل بعض بيانات الإدارة.' : 'Could not load some administration data.')
    if (!childId && childResult.data?.[0]) setChildId(childResult.data[0].id)
    if (!teacherId && teacherResult.data?.[0]) setTeacherId(teacherResult.data[0].id)
    setLoading(false)
  }, [ar, childId, supabase, teacherId])

  useEffect(() => { const timer = setTimeout(() => { void load() }, 0); return () => clearTimeout(timer) }, [load])

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const invitedEmail = String(form.get('email') ?? '').trim().toLowerCase()
    const displayName = String(form.get('display_name') ?? '').trim()
    if (!invitedEmail || !displayName || !userId) return
    setBusy(true); setError(''); setNotice(''); setInviteLink('')
    try {
      const token = createInvitationToken()
      const tokenHash = await hashInvitationToken(token)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { error: insertError } = await supabase.from('academy_teacher_invites').insert({ invited_email: invitedEmail, display_name: displayName, token_hash: tokenHash, created_by: userId, expires_at: expiresAt })
      if (insertError) throw insertError
      const link = new URL('/teacher-invite', window.location.origin)
      link.hash = new URLSearchParams({ token }).toString()
      setInviteLink(link.toString())
      setNotice(ar ? 'أُنشئت دعوة صالحة لأسبوع. انسخ الرابط ومرّره للمعلم بنفسك.' : 'A 7-day invitation was created. Copy and forward the link yourself.')
      await load()
    } catch {
      setError(ar ? 'تعذّر إنشاء الدعوة.' : 'Could not create the invitation.')
    }
    setBusy(false)
  }

  async function toggleTeacher(teacher: TeacherRow) {
    setBusy(true); setError(''); setNotice('')
    const status = teacher.status === 'active' ? 'suspended' : 'active'
    const { error: updateError } = await supabase.from('academy_teachers').update({ status }).eq('id', teacher.id)
    if (updateError) setError(ar ? 'تعذّر تحديث حالة المعلم.' : 'Could not update teacher status.')
    else { setNotice(ar ? 'تم تحديث حالة المعلم.' : 'Teacher status updated.'); await load() }
    setBusy(false)
  }

  async function assignTeacher(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!teacherId || !childId) return
    setBusy(true); setError(''); setNotice('')
    const { error: assignError } = await supabase.from('academy_teacher_assignments').upsert({ teacher_id: teacherId, child_id: childId, status: 'active' }, { onConflict: 'teacher_id,child_id' })
    if (assignError) setError(ar ? 'تعذّر إسناد الطفل. اختر معلمًا نشطًا.' : 'Could not assign the child. Choose an active teacher.')
    else { setNotice(ar ? 'تم إسناد المعلم.' : 'Teacher assigned.'); await load() }
    setBusy(false)
  }

  async function scheduleLesson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const teacher = teachers.find((item) => item.id === teacherId)
    if (!teacher || !childId || !startsAt || !endsAt) {
      setError(ar ? 'اختر طفلًا ومعلمًا وحدد نهاية بعد بداية الجلسة.' : 'Choose a child and teacher, and set an end time after the start.')
      return
    }
    let startsAtIso: string
    let endsAtIso: string
    try {
      startsAtIso = zonedLocalDateTimeToIso(startsAt, teacher.time_zone)
      endsAtIso = zonedLocalDateTimeToIso(endsAt, teacher.time_zone)
    } catch {
      setError(ar ? 'هذا الوقت المحلي غير صالح في المنطقة الزمنية للمعلم.' : 'This local time is invalid in the teacher time zone.')
      return
    }
    if (new Date(endsAtIso) <= new Date(startsAtIso)) {
      setError(ar ? 'يجب أن تكون نهاية الجلسة بعد بدايتها.' : 'The session end must be after its start.')
      return
    }
    setBusy(true); setError(''); setNotice('')
    const { error: insertError } = await supabase.from('academy_individual_lessons').insert({ teacher_id: teacherId, child_id: childId, subject, starts_at: startsAtIso, ends_at: endsAtIso, time_zone: teacher.time_zone, status: 'scheduled', outcome: null, follow_up_note: '' })
    if (insertError) setError(ar ? 'تعذّر جدولة الجلسة. تأكد من وجود إسناد نشط.' : 'Could not schedule the session. Make sure the assignment is active.')
    else { setNotice(ar ? 'تمت جدولة الجلسة.' : 'Session scheduled.'); await load() }
    setBusy(false)
  }

  if (loading) return <p className="py-16 text-center text-ink-soft">{ar ? 'جارٍ تحميل لوحة الإدارة…' : 'Loading administration…'}</p>
  if (!admin) return <div className="card mx-auto max-w-xl p-7"><h1 className="font-display text-2xl font-bold text-sidr-900">{ar ? 'هذه المساحة للإدارة فقط' : 'Administration only'}</h1><p className="mt-3 leading-7 text-ink-soft">{ar ? 'ليس لهذا الحساب صلاحية إدارة الأكاديمية.' : 'This account does not have academy administration access.'}</p></div>

  const activeTeachers = teachers.filter((teacher) => teacher.status === 'active').length
  const pendingInvites = invites.filter((invite) => !invite.accepted_at && new Date(invite.expires_at) > new Date()).length
  const childNames = new Map(children.map((child) => [child.id, child.display_name]))
  const teacherNames = new Map(teachers.map((teacher) => [teacher.id, teacher.display_name]))

  return <div className="space-y-8">
    <section className="flex flex-wrap items-start justify-between gap-4"><div><p className="badge-gold">{ar ? 'لوحة الإدارة' : 'Administration'}</p><h1 className="mt-3 font-display text-3xl font-bold text-sidr-900">{ar ? 'إدارة الأكاديمية' : 'Academy operations'}</h1><p className="mt-2 text-ink-soft">{ar ? 'إدارة ملفات الأسرة والمعلمين والمواعيد، من دون إدارة مواد الدروس.' : 'Manage family profiles, teachers and schedules without managing lesson materials.'}</p></div><div className="rounded-2xl border border-gold-300 bg-gold-100 px-4 py-3 text-sm font-bold text-gold-700">{ar ? 'لا تحصيل مالي حقيقي' : 'No real payments collected'}</div></section>
    {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="rounded-xl bg-sidr-50 px-4 py-3 text-sm text-sidr-700">{notice}</p>}
    <section className="grid gap-4 sm:grid-cols-3"><div className="card p-5"><p className="text-sm text-ink-soft">{ar ? 'ملفات الأطفال' : 'Child profiles'}</p><strong className="mt-2 block text-3xl text-sidr-900">{children.length}</strong></div><div className="card p-5"><p className="text-sm text-ink-soft">{ar ? 'المعلمون النشطون' : 'Active teachers'}</p><strong className="mt-2 block text-3xl text-sidr-900">{activeTeachers}</strong></div><div className="card p-5"><p className="text-sm text-ink-soft">{ar ? 'دعوات معلّقَة' : 'Pending invitations'}</p><strong className="mt-2 block text-3xl text-sidr-900">{pendingInvites}</strong></div></section>

    <section className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6"><h2 className="font-display text-xl font-bold text-sidr-900">{ar ? 'دعوة معلم بأمان' : 'Secure teacher invitation'}</h2><p className="mt-2 text-sm leading-6 text-ink-soft">{ar ? 'الرابط صالح 7 أيام، مرتبط بالبريد المدعو، أحادي الاستخدام. يُخزّن بصمة الرمز فقط. لن يُرسل أي بريد تلقائيًا.' : 'Link lasts 7 days, is bound to the invited email and can be used once. Only its token hash is stored. No email is sent automatically.'}</p><form onSubmit={createInvite} className="mt-4 space-y-3"><input className="input-field" name="display_name" placeholder={ar ? 'اسم المعلم' : 'Teacher name'} required maxLength={200} /><input className="input-field" name="email" type="email" dir="ltr" placeholder={ar ? 'بريد المعلم' : 'Teacher email'} required maxLength={320} /><button className="btn-primary" disabled={busy}>{ar ? 'إنشاء رابط الدعوة' : 'Create invitation link'}</button></form>{inviteLink && <div className="mt-4 rounded-xl border border-gold-300 bg-gold-100 p-4"><label className="text-sm font-semibold text-gold-700">{ar ? 'انسخ الرابط ومرّره بنفسك' : 'Copy and forward this link yourself'}</label><input className="input-field mt-2" dir="ltr" readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /><button type="button" className="btn-secondary mt-3 text-sm" onClick={() => void navigator.clipboard.writeText(inviteLink)}>{ar ? 'نسخ الرابط' : 'Copy link'}</button></div>}
        <div className="mt-5 space-y-2">{invites.slice(0, 6).map((invite) => <div key={invite.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-parchment px-3 py-2 text-sm"><span>{invite.display_name} · <bdi dir="ltr">{invite.invited_email}</bdi></span><span className="text-ink-soft">{invite.accepted_at ? (ar ? 'مقبولة' : 'Accepted') : new Date(invite.expires_at) > new Date() ? (ar ? 'بانتظار الاستخدام' : 'Pending') : (ar ? 'منتهية' : 'Expired')}</span></div>)}</div>
      </div>

      <div className="card p-6"><h2 className="font-display text-xl font-bold text-sidr-900">{ar ? 'المعلمون' : 'Teachers'}</h2><div className="mt-4 space-y-3">{teachers.length ? teachers.map((teacher) => <article key={teacher.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mist-dark p-4"><div><strong className="text-sidr-900">{teacher.display_name}</strong><p className="mt-1 text-xs text-ink-soft"><bdi dir="ltr">{teacher.time_zone}</bdi> · <code className="break-all">{teacher.id}</code></p></div><button type="button" className={teacher.status === 'active' ? 'btn-secondary px-3 py-2 text-sm' : 'btn-primary px-3 py-2 text-sm'} disabled={busy} onClick={() => void toggleTeacher(teacher)}>{teacher.status === 'active' ? (ar ? 'تعليق الحساب' : 'Suspend') : (ar ? 'تفعيل الحساب' : 'Activate')}</button></article>) : <p className="rounded-xl bg-parchment p-4 text-sm text-ink-soft">{ar ? 'ستظهر حسابات المعلمين بعد قبول دعوتهم.' : 'Teacher accounts appear after they accept an invitation.'}</p>}</div></div>
    </section>

    <section className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6"><h2 className="font-display text-xl font-bold text-sidr-900">{ar ? 'إسناد معلم لطفل' : 'Assign a teacher'}</h2><form onSubmit={assignTeacher} className="mt-4 space-y-3"><label className="block text-sm font-medium text-sidr-900">{ar ? 'الطفل' : 'Child'}<select className="input-field mt-1" value={childId} onChange={(event) => setChildId(event.target.value)} required><option value="">{ar ? 'اختر طفلًا' : 'Choose child'}</option>{children.map((child) => <option key={child.id} value={child.id}>{child.display_name}</option>)}</select></label><label className="block text-sm font-medium text-sidr-900">{ar ? 'المعلم النشط' : 'Active teacher'}<select className="input-field mt-1" value={teacherId} onChange={(event) => setTeacherId(event.target.value)} required><option value="">{ar ? 'اختر معلمًا' : 'Choose teacher'}</option>{teachers.filter((teacher) => teacher.status === 'active').map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.display_name}</option>)}</select></label><button className="btn-primary" disabled={busy || !children.length || !activeTeachers}>{ar ? 'إسناد المعلم' : 'Assign teacher'}</button></form><div className="mt-5 space-y-2">{assignments.map((assignment) => <p key={`${assignment.teacher_id}:${assignment.child_id}`} className="rounded-lg bg-parchment px-3 py-2 text-sm text-ink-soft">{teacherNames.get(assignment.teacher_id) ?? '—'} → {childNames.get(assignment.child_id) ?? '—'} · {assignment.status}</p>)}</div></div>

      <div className="card p-6"><h2 className="font-display text-xl font-bold text-sidr-900">{ar ? 'جدولة جلسة فردية' : 'Schedule an individual session'}</h2><p className="mt-2 text-sm leading-6 text-ink-soft">{ar ? 'اختر نوع الجلسة والموعد فقط. لا تُدخل رابط Zoom أو مواد الدرس.' : 'Set the subject and schedule only. Do not enter Zoom links or lesson materials.'}</p><form onSubmit={scheduleLesson} className="mt-4 space-y-3"><label className="block text-sm font-medium text-sidr-900">{ar ? 'الطفل' : 'Child'}<select className="input-field mt-1" value={childId} onChange={(event) => setChildId(event.target.value)} required><option value="">{ar ? 'اختر طفلًا' : 'Choose child'}</option>{children.map((child) => <option key={child.id} value={child.id}>{child.display_name}</option>)}</select></label><label className="block text-sm font-medium text-sidr-900">{ar ? 'المعلم' : 'Teacher'}<select className="input-field mt-1" value={teacherId} onChange={(event) => setTeacherId(event.target.value)} required><option value="">{ar ? 'اختر معلمًا' : 'Choose teacher'}</option>{teachers.filter((teacher) => teacher.status === 'active').map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.display_name}</option>)}</select></label><label className="block text-sm font-medium text-sidr-900">{ar ? 'المادة' : 'Subject'}<select className="input-field mt-1" value={subject} onChange={(event) => setSubject(event.target.value as typeof subject)}><option value="quran">{subjectLabel('quran', locale)}</option><option value="tajweed">{subjectLabel('tajweed', locale)}</option><option value="nur_al_bayan">{subjectLabel('nur_al_bayan', locale)}</option></select></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-sidr-900">{ar ? 'البداية (توقيت المعلم)' : 'Start (teacher time zone)'}<input className="input-field mt-1" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label><label className="text-sm font-medium text-sidr-900">{ar ? 'النهاية (توقيت المعلم)' : 'End (teacher time zone)'}<input className="input-field mt-1" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></label></div><button className="btn-primary" disabled={busy || !children.length || !activeTeachers}>{ar ? 'حفظ الموعد' : 'Save schedule'}</button></form></div>
    </section>

    <section className="card p-6"><h2 className="font-display text-xl font-bold text-sidr-900">{ar ? 'الجلسات المسجلة' : 'Scheduled sessions'}</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{lessons.slice(0, 20).map((lesson) => <article key={lesson.id} className="rounded-xl border border-mist-dark bg-white p-4"><div className="flex justify-between gap-2"><strong className="text-sidr-900">{childNames.get(lesson.child_id) ?? '—'}</strong><span className="badge-gold">{subjectLabel(lesson.subject, locale)}</span></div><p className="mt-2 text-sm text-ink-soft">{teacherNames.get(lesson.teacher_id) ?? '—'} · {formatLessonTime(lesson.starts_at, locale, lesson.time_zone)}</p><p className="mt-1 text-xs text-ink-soft">{lesson.status} · {lesson.outcome ?? (ar ? 'لم تسجّل النتيجة بعد' : 'Outcome pending')}</p></article>)}{lessons.length === 0 && <p className="rounded-lg bg-parchment p-4 text-sm text-ink-soft">{ar ? 'لا توجد جلسات بعد.' : 'No sessions yet.'}</p>}</div></section>
  </div>
}
