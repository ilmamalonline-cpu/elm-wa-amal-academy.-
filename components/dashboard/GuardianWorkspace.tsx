'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CONSENT_VERSION, OWNER_EMAIL, formatLessonTime, outcomeLabel, subjectLabel, validateChildInput, type Locale } from '@/lib/academy/domain'
import type { AcademyChild, AcademyGuardian } from '@/types/database'

type LessonSummary = { id: string; child_id: string; subject: 'quran' | 'nur_al_bayan' | 'tajweed'; starts_at: string; ends_at: string; time_zone: string; status: 'scheduled' | 'cancelled'; outcome: 'attended_completed' | 'attended_incomplete' | 'absent' | null; follow_up_note: string }
type PracticeRow = { id: string; child_id: string; activity: string; minutes: number; practiced_on: string }
type PlanRow = { child_id: string; goal: string; weekly_target_minutes: number }

export function GuardianWorkspace({ locale }: { locale: Locale }) {
  const ar = locale === 'ar'
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [guardian, setGuardian] = useState<AcademyGuardian | null>(null)
  const [children, setChildren] = useState<AcademyChild[]>([])
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [practice, setPractice] = useState<PracticeRow[]>([])
  const [lessons, setLessons] = useState<Record<string, LessonSummary[]>>({})
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [childName, setChildName] = useState('')
  const [birthYear, setBirthYear] = useState(String(new Date().getFullYear() - 8))
  const [goal, setGoal] = useState('')
  const [weeklyTarget, setWeeklyTarget] = useState('60')
  const [minutes, setMinutes] = useState('15')
  const [consent, setConsent] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setUserId(user.id)
    setEmail(user.email ?? '')
    const { data: guardianRow } = await supabase.from('academy_guardians').select('*').eq('id', user.id).maybeSingle()
    setGuardian(guardianRow)
    if (!guardianRow) {
      setName(String(user.user_metadata?.display_name ?? ''))
      setLoading(false)
      return
    }
    const { data: childRows, error: childError } = await supabase.from('academy_children').select('id,guardian_id,display_name,birth_year,created_at').eq('guardian_id', user.id).order('created_at', { ascending: false })
    if (childError) setError(ar ? 'تعذّر تحميل ملفات الأطفال.' : 'Could not load child profiles.')
    const loadedChildren = childRows ?? []
    setChildren(loadedChildren)
    if (!selectedId && loadedChildren.length) setSelectedId(loadedChildren[0].id)
    const childIds = loadedChildren.map((child) => child.id)
    if (childIds.length) {
      const [{ data: planRows }, { data: practiceRows }, summaries] = await Promise.all([
        supabase.from('academy_learning_plans').select('child_id,goal,weekly_target_minutes').in('child_id', childIds),
        supabase.from('academy_practice_entries').select('id,child_id,activity,minutes,practiced_on').in('child_id', childIds).order('practiced_on', { ascending: false }).limit(50),
        Promise.all(loadedChildren.map(async (child) => {
          const { data } = await supabase.rpc('academy_guardian_session_summaries', { p_child_id: child.id, p_offset: 0 })
          return [child.id, data ?? []] as const
        })),
      ])
      setPlans(planRows ?? [])
      setPractice(practiceRows ?? [])
      setLessons(Object.fromEntries(summaries))
    } else {
      setPlans([]); setPractice([]); setLessons({})
    }
    setLoading(false)
  }, [ar, selectedId, supabase])

  useEffect(() => { const timer = setTimeout(() => { void load() }, 0); return () => clearTimeout(timer) }, [load])

  const selectedChild = children.find((child) => child.id === selectedId)
  const selectedPlan = plans.find((plan) => plan.child_id === selectedId)
  const selectedLessons = lessons[selectedId] ?? []
  const selectedPractice = practice.filter((row) => row.child_id === selectedId)

  useEffect(() => {
    const timer = setTimeout(() => {
      setGoal(selectedPlan?.goal ?? '')
      setWeeklyTarget(String(selectedPlan?.weekly_target_minutes ?? 60))
    }, 0)
    return () => clearTimeout(timer)
  }, [selectedId, selectedPlan?.goal, selectedPlan?.weekly_target_minutes])

  async function completeGuardianProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!consent || !userId) return
    setBusy(true); setError(''); setNotice('')
    const { error: profileError } = await supabase.from('academy_guardians').upsert({
      id: userId,
      display_name: name.trim(),
      locale,
      consent_version: CONSENT_VERSION,
      consented_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (profileError) {
      setError(ar ? 'تعذّر حفظ ملف وليّ الأمر. أعد المحاولة.' : 'Could not save the guardian profile. Please retry.')
      setBusy(false); return
    }
    setGuardian({ id: userId, display_name: name.trim(), locale, consent_version: CONSENT_VERSION, consented_at: new Date().toISOString() })
    if (email.trim().toLowerCase() === OWNER_EMAIL) {
      const { data: existingAdmin } = await supabase.from('academy_admins').select('id').eq('id', userId).maybeSingle()
      if (!existingAdmin) {
        const { error: adminError } = await supabase.from('academy_admins').insert({ id: userId })
        if (!adminError) { router.replace('/dashboard/admin'); router.refresh(); setBusy(false); return }
      } else { router.replace('/dashboard/admin'); router.refresh(); setBusy(false); return }
    }
    setNotice(ar ? 'اكتمل ملف الأسرة.' : 'Family profile completed.')
    setBusy(false)
    await load()
  }

  async function addChild(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const year = Number(birthYear)
    if (validateChildInput(childName, year)) {
      setError(ar ? 'أدخل اسمًا وسنة ميلاد صحيحة (2000 إلى العام الحالي).' : 'Enter a name and valid birth year (2000 through this year).')
      return
    }
    setBusy(true); setError(''); setNotice('')
    const { error: insertError } = await supabase.from('academy_children').insert({ guardian_id: userId, display_name: childName.trim(), birth_year: year })
    if (insertError) setError(ar ? 'تعذّر إضافة الملف. راجع سنة الميلاد وحاول مجددًا.' : 'Could not add the profile. Check the birth year and retry.')
    else { setChildName(''); setNotice(ar ? 'أُضيف ملف الطفل.' : 'Child profile added.'); await load() }
    setBusy(false)
  }

  async function updateChild(event: React.FormEvent<HTMLFormElement>, child: AcademyChild) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextName = String(form.get('display_name') ?? '').trim()
    const nextYear = Number(form.get('birth_year'))
    if (validateChildInput(nextName, nextYear)) { setError(ar ? 'راجع الاسم وسنة الميلاد.' : 'Check the name and birth year.'); return }
    setBusy(true); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('academy_children').update({ display_name: nextName, birth_year: nextYear }).eq('id', child.id).eq('guardian_id', userId)
    if (updateError) setError(ar ? 'تعذّر تحديث الملف.' : 'Could not update the profile.')
    else { setNotice(ar ? 'تم تحديث الملف.' : 'Profile updated.'); await load() }
    setBusy(false)
  }

  async function savePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId || !userId) return
    setBusy(true); setError(''); setNotice('')
    const { error: saveError } = await supabase.from('academy_learning_plans').upsert({ child_id: selectedId, guardian_id: userId, goal: goal.trim(), weekly_target_minutes: Number(weeklyTarget) }, { onConflict: 'child_id' })
    if (saveError) setError(ar ? 'تعذّر حفظ هدف المتابعة.' : 'Could not save the learning goal.')
    else { setNotice(ar ? 'تم حفظ هدف المتابعة.' : 'Learning goal saved.'); await load() }
    setBusy(false)
  }

  async function addPractice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId || !userId) return
    setBusy(true); setError(''); setNotice('')
    const { error: saveError } = await supabase.from('academy_practice_entries').insert({ child_id: selectedId, guardian_id: userId, activity: ar ? 'تدريب عام' : 'General practice', minutes: Number(minutes), practiced_on: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), note: '' })
    if (saveError) setError(ar ? 'تعذّر تسجيل الدقائق.' : 'Could not record the practice minutes.')
    else { setNotice(ar ? 'سُجّلت دقائق التدريب.' : 'Practice minutes recorded.'); await load() }
    setBusy(false)
  }

  if (loading) return <p className="py-16 text-center text-ink-soft">{ar ? 'جارٍ تحميل مساحة الأسرة…' : 'Loading family workspace…'}</p>

  if (!guardian) return <section className="mx-auto max-w-2xl"><p className="badge-gold">{ar ? 'خطوة أخيرة' : 'One last step'}</p><h1 className="mt-3 font-display text-3xl font-bold text-sidr-900">{ar ? 'أكمل ملف وليّ الأمر' : 'Complete your guardian profile'}</h1><p className="mt-3 leading-7 text-ink-soft">{ar ? 'يحتاج الحساب إلى موافقتك واسم وليّ الأمر قبل إنشاء ملفات الأطفال.' : 'We need your consent and guardian name before child profiles can be created.'}</p><form onSubmit={completeGuardianProfile} className="card mt-6 space-y-5 p-6"><div><label className="mb-1.5 block text-sm font-semibold text-sidr-900">{ar ? 'اسم وليّ الأمر' : 'Guardian name'}</label><input className="input-field" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></div><label className="flex items-start gap-3 rounded-xl bg-parchment p-4 text-sm leading-6 text-ink-soft"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-sidr-700" /><span>{ar ? 'أوافق على استخدام بيانات الأسرة لإدارة الملفات والمواعيد ونتائج الجلسات.' : 'I agree to use family data to manage profiles, schedules and session outcomes.'}</span></label>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<button className="btn-primary" disabled={busy || !consent}>{busy ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ ومتابعة' : 'Save and continue')}</button></form></section>

  return <div className="space-y-8">
    <section className="flex flex-wrap items-start justify-between gap-4"><div><p className="badge-gold">{ar ? 'مساحة الأسرة' : 'Family workspace'}</p><h1 className="mt-3 font-display text-3xl font-bold text-sidr-900">{ar ? `مرحبًا ${guardian.display_name}` : `Welcome, ${guardian.display_name}`}</h1><p className="mt-2 text-ink-soft">{ar ? 'أنت تدير ملفات الأطفال من حساب وليّ الأمر نفسه.' : 'Manage every child from this single guardian account.'}</p></div><div className="rounded-2xl border border-gold-300 bg-gold-100 px-4 py-3 text-sm font-semibold text-gold-700">{ar ? 'لا توجد حسابات مستقلة للأطفال' : 'Children do not have separate logins'}</div></section>
    {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}{notice && <p role="status" className="rounded-xl bg-sidr-50 px-4 py-3 text-sm text-sidr-700">{notice}</p>}
    <section className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <div className="card p-6"><h2 className="font-display text-xl font-bold text-sidr-900">{ar ? 'ملفات الأطفال' : 'Child profiles'}</h2><p className="mt-2 text-sm leading-6 text-ink-soft">{ar ? 'أضف أبناءك أو حدّث بياناتهم. لا تُدخل محتوى دروس أو مواد تعليمية هنا.' : 'Add children or update their basic details. Do not enter lesson content or materials here.'}</p>
        {children.length > 0 && <div className="mt-5 space-y-4">{children.map((child) => <form key={child.id} onSubmit={(event) => void updateChild(event, child)} className={`rounded-xl border p-4 ${selectedId === child.id ? 'border-gold-500 bg-gold-100/60' : 'border-mist-dark bg-white'}`}><button type="button" onClick={() => setSelectedId(child.id)} className="mb-3 flex w-full items-center justify-between text-start"><span className="font-bold text-sidr-900">{child.display_name}</span><span className="text-xs text-ink-soft">{ar ? 'ملف' : 'Profile'}</span></button><div className="grid gap-3 sm:grid-cols-[1fr_8rem]"><input className="input-field" name="display_name" defaultValue={child.display_name} aria-label={ar ? 'اسم الطفل' : 'Child name'} required maxLength={200} /><input className="input-field" name="birth_year" defaultValue={child.birth_year} type="number" min={2000} max={new Date().getFullYear()} aria-label={ar ? 'سنة الميلاد' : 'Birth year'} required /></div><button className="btn-secondary mt-3 px-3 py-2 text-sm" disabled={busy}>{ar ? 'تحديث الملف' : 'Update profile'}</button></form>)}</div>}
        <form onSubmit={addChild} className="mt-6 border-t border-mist-dark pt-5"><h3 className="font-semibold text-sidr-900">{ar ? 'إضافة طفل' : 'Add a child'}</h3><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_8rem]"><input className="input-field" placeholder={ar ? 'اسم الطفل' : 'Child name'} required maxLength={200} value={childName} onChange={(event) => setChildName(event.target.value)} /><input className="input-field" type="number" min={2000} max={new Date().getFullYear()} value={birthYear} onChange={(event) => setBirthYear(event.target.value)} required aria-label={ar ? 'سنة الميلاد' : 'Birth year'} /></div><button className="btn-primary mt-3" disabled={busy}>{ar ? 'إضافة الملف' : 'Add profile'}</button></form>
      </div>

      <div className="space-y-6">
        {children.length === 0 ? <div className="card p-6 text-ink-soft">{ar ? 'أضف ملف طفل لعرض أهداف المتابعة والجلسات.' : 'Add a child profile to see goals and scheduled sessions.'}</div> : <>
          <div className="card p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-bold text-sidr-900">{ar ? 'متابعة عامة' : 'General learning goal'}</h2><select className="input-field max-w-xs" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} aria-label={ar ? 'اختر طفلًا' : 'Select child'}>{children.map((child) => <option value={child.id} key={child.id}>{child.display_name}</option>)}</select></div><form onSubmit={savePlan} className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem]"><input className="input-field sm:col-span-2" placeholder={ar ? 'هدف عام للمتابعة (من دون مواد أو نصوص دروس)' : 'General goal (no lesson materials or lesson text)'} required maxLength={500} value={goal} onChange={(event) => setGoal(event.target.value)} /><label className="text-sm text-ink-soft">{ar ? 'دقائق أسبوعية مستهدفة' : 'Weekly target minutes'}<input className="input-field mt-1" type="number" min={1} max={840} value={weeklyTarget} onChange={(event) => setWeeklyTarget(event.target.value)} required /></label><div className="flex items-end"><button className="btn-primary w-full" disabled={busy}>{ar ? 'حفظ الهدف' : 'Save goal'}</button></div></form></div>
          <div className="card p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-bold text-sidr-900">{ar ? 'مواعيد ونتائج الجلسات' : 'Session schedule and outcomes'}</h2><span className="text-sm font-medium text-gold-700">{selectedChild?.display_name}</span></div><p className="mt-2 text-sm leading-6 text-ink-soft">{ar ? 'المواعيد والنتائج فقط؛ مواد التعليم وروابط Zoom يتشاركها المعلم خارج المنصة.' : 'Schedules and outcomes only; teachers share lesson materials and Zoom links externally.'}</p><div className="mt-4 space-y-3">{selectedLessons.length ? selectedLessons.slice(0, 12).map((lesson) => <article key={lesson.id} className="rounded-xl border border-mist-dark bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sidr-900">{subjectLabel(lesson.subject, locale)}</strong><span className={`rounded-full px-3 py-1 text-xs font-semibold ${lesson.status === 'scheduled' ? 'bg-gold-100 text-gold-700' : 'bg-mist text-ink-soft'}`}>{lesson.status === 'scheduled' ? (ar ? 'مجدولة' : 'Scheduled') : (ar ? 'ملغاة' : 'Cancelled')}</span></div><p className="mt-2 text-sm text-ink-soft">{formatLessonTime(lesson.starts_at, locale, lesson.time_zone)} · {outcomeLabel(lesson.outcome, locale)}</p>{lesson.follow_up_note && <p className="mt-2 rounded-lg bg-parchment p-3 text-sm leading-6 text-ink-soft">{lesson.follow_up_note}</p>}</article>) : <p className="rounded-xl bg-parchment p-4 text-sm text-ink-soft">{ar ? 'لا توجد مواعيد مسجلة بعد.' : 'No sessions have been scheduled yet.'}</p>}</div></div>
          <div className="card p-6"><h2 className="font-display text-xl font-bold text-sidr-900">{ar ? 'دقائق تدريب عامة' : 'General practice minutes'}</h2><p className="mt-2 text-sm leading-6 text-ink-soft">{ar ? 'سجّل وقت التدريب فقط؛ لا تخزّن نصوصًا أو ملفات أو مواد قرآنية.' : 'Record time only—do not store texts, files or Quranic materials here.'}</p><form onSubmit={addPractice} className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm text-ink-soft">{ar ? 'الدقائق' : 'Minutes'}<input className="input-field mt-1 w-32" type="number" min={1} max={240} value={minutes} onChange={(event) => setMinutes(event.target.value)} required /></label><button className="btn-primary" disabled={busy}>{ar ? 'تسجيل الدقائق' : 'Record minutes'}</button></form><div className="mt-4 space-y-2">{selectedPractice.slice(0, 8).map((row) => <div key={row.id} className="flex justify-between rounded-lg bg-parchment px-3 py-2 text-sm text-ink-soft"><span>{row.practiced_on}</span><strong className="text-sidr-700">{row.minutes} {ar ? 'دقيقة' : 'min'}</strong></div>)}</div></div>
        </>}
      </div>
    </section>
  </div>
}
