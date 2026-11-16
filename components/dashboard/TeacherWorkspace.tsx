'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatLessonTime, outcomeLabel, subjectLabel, type Locale, type LessonOutcome } from '@/lib/academy/domain'

type TeacherRow = { id: string; display_name: string; time_zone: string; status: 'active' | 'suspended' }
type RosterRow = { child_id: string; child_name: string; scheduled_lessons: number }
type LessonRow = { id: string; child_id: string; subject: 'quran' | 'nur_al_bayan' | 'tajweed'; starts_at: string; ends_at: string; time_zone: string; status: 'scheduled' | 'cancelled'; outcome: LessonOutcome | null; follow_up_note: string }

export function TeacherWorkspace({ locale }: { locale: Locale }) {
  const ar = locale === 'ar'
  const supabase = useMemo(() => createClient(), [])
  const [teacher, setTeacher] = useState<TeacherRow | null>(null)
  const [roster, setRoster] = useState<RosterRow[]>([])
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const [{ data: teacherRow }, { data: rosterRows }, { data: lessonRows, error: lessonError }] = await Promise.all([
      supabase.from('academy_teachers').select('id,display_name,time_zone,status').eq('id', user.id).maybeSingle(),
      supabase.rpc('academy_teacher_roster'),
      supabase.from('academy_individual_lessons').select('id,child_id,subject,starts_at,ends_at,time_zone,status,outcome,follow_up_note').eq('teacher_id', user.id).order('starts_at', { ascending: true }).limit(50),
    ])
    setTeacher(teacherRow)
    setRoster(rosterRows ?? [])
    setLessons(lessonRows ?? [])
    if (lessonError) setError(ar ? 'تعذّر تحميل الجلسات.' : 'Could not load sessions.')
    setLoading(false)
  }, [ar, supabase])

  useEffect(() => { const timer = setTimeout(() => { void load() }, 0); return () => clearTimeout(timer) }, [load])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNow(Date.now()), 0)
    const interval = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => { window.clearTimeout(initialTimer); window.clearInterval(interval) }
  }, [])

  async function updateOutcome(event: React.FormEvent<HTMLFormElement>, lesson: LessonRow) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const outcome = String(form.get('outcome')) as LessonOutcome
    const followUp = String(form.get('follow_up_note') ?? '').trim()
    if (!['attended_completed', 'attended_incomplete', 'absent'].includes(outcome)) return
    setBusyId(lesson.id); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('academy_individual_lessons').update({ outcome, follow_up_note: followUp }).eq('id', lesson.id).eq('teacher_id', teacher?.id ?? '')
    if (updateError) setError(ar ? 'تعذّر حفظ النتيجة. تأكد أن الجلسة ما زالت مجدولة.' : 'Could not save the outcome. Check that the session is still scheduled.')
    else { setNotice(ar ? 'تم حفظ نتيجة الجلسة.' : 'Session outcome saved.'); await load() }
    setBusyId('')
  }

  if (loading) return <p className="py-16 text-center text-ink-soft">{ar ? 'جارٍ تحميل مساحة المعلم…' : 'Loading teacher workspace…'}</p>
  if (!teacher) return <div className="card mx-auto max-w-xl p-7"><h1 className="font-display text-2xl font-bold text-sidr-900">{ar ? 'حساب المعلم غير مفعّل' : 'Teacher account not active'}</h1><p className="mt-3 leading-7 text-ink-soft">{ar ? 'تواصل مع مسؤول الأكاديمية عبر القناة المعتادة لتفعيل الدعوة.' : 'Contact the academy administrator through your usual channel to activate an invitation.'}</p></div>

  const rosterById = new Map(roster.map((row) => [row.child_id, row.child_name]))
  return <div className="space-y-8">
    <section className="flex flex-wrap items-start justify-between gap-4"><div><p className="badge-gold">{ar ? 'مساحة المعلم' : 'Teacher workspace'}</p><h1 className="mt-3 font-display text-3xl font-bold text-sidr-900">{ar ? `أهلًا ${teacher.display_name}` : `Welcome, ${teacher.display_name}`}</h1><p className="mt-2 text-ink-soft">{ar ? 'اعرض الطلاب المسندين إليك وسجّل نتيجة الجلسة فقط.' : 'View assigned children and record session outcomes only.'}</p></div><div className="rounded-2xl border border-gold-300 bg-gold-100 px-4 py-3 text-sm text-gold-700"><span className="block font-bold">{ar ? 'معرّف الحساب' : 'Account ID'}</span><code className="mt-1 block max-w-xs break-all text-xs">{teacher.id}</code></div></section>
    {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="rounded-xl bg-sidr-50 px-4 py-3 text-sm text-sidr-700">{notice}</p>}
    <section className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]">
      <div className="card p-6"><h2 className="font-display text-xl font-bold text-sidr-900">{ar ? 'الأطفال المسندون' : 'Assigned children'}</h2><div className="mt-4 space-y-3">{roster.length ? roster.map((row) => <article key={row.child_id} className="rounded-xl border border-mist-dark bg-white p-4"><strong className="text-sidr-900">{row.child_name}</strong><p className="mt-1 text-sm text-ink-soft">{row.scheduled_lessons} {ar ? 'جلسة مجدولة' : 'scheduled sessions'}</p></article>) : <p className="rounded-xl bg-parchment p-4 text-sm text-ink-soft">{ar ? 'لا توجد إسنادات نشطة بعد.' : 'No active assignments yet.'}</p>}</div></div>
      <div className="card p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-bold text-sidr-900">{ar ? 'الجلسات' : 'Sessions'}</h2><span className="text-xs font-semibold text-gold-700">{ar ? 'المواد وروابط Zoom خارج المنصة' : 'Materials and Zoom links stay outside the platform'}</span></div><div className="mt-4 space-y-4">{lessons.length ? lessons.map((lesson) => <article key={lesson.id} className="rounded-xl border border-mist-dark bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sidr-900">{rosterById.get(lesson.child_id) ?? (ar ? 'طفل مسند' : 'Assigned child')}</strong><span className="badge-gold">{subjectLabel(lesson.subject, locale)}</span></div><p className="mt-2 text-sm text-ink-soft">{formatLessonTime(lesson.starts_at, locale, lesson.time_zone)} — {outcomeLabel(lesson.outcome, locale)}</p>{lesson.status === 'scheduled' && (now === null || new Date(lesson.ends_at).getTime() > now) && <p className="mt-4 rounded-lg bg-parchment px-3 py-2 text-sm text-ink-soft">{ar ? 'تُتاح النتيجة بعد انتهاء الجلسة.' : 'Outcome entry becomes available after the session ends.'}</p>}{lesson.status === 'scheduled' && now !== null && new Date(lesson.ends_at).getTime() <= now && <form onSubmit={(event) => void updateOutcome(event, lesson)} className="mt-4 grid gap-3"><label className="text-sm font-medium text-sidr-900">{ar ? 'نتيجة الجلسة' : 'Session outcome'}<select className="input-field mt-1" name="outcome" defaultValue={lesson.outcome ?? 'attended_completed'}><option value="attended_completed">{ar ? 'حضر وأكمل الجلسة' : 'Attended and completed'}</option><option value="attended_incomplete">{ar ? 'حضر ويحتاج متابعة' : 'Attended; follow-up needed'}</option><option value="absent">{ar ? 'لم يحضر' : 'Absent'}</option></select></label><label className="text-sm font-medium text-sidr-900">{ar ? 'ملاحظة متابعة عامة (دون مواد الدرس)' : 'General follow-up note (no lesson materials)'}<textarea className="input-field mt-1 min-h-20" name="follow_up_note" defaultValue={lesson.follow_up_note} maxLength={500} /></label><button className="btn-primary justify-self-start" disabled={busyId === lesson.id}>{busyId === lesson.id ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ النتيجة' : 'Save outcome')}</button></form>}</article>) : <p className="rounded-xl bg-parchment p-4 text-sm text-ink-soft">{ar ? 'لا توجد جلسات مقررة.' : 'No scheduled sessions.'}</p>}</div></div>
    </section>
  </div>
}
