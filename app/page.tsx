import Link from 'next/link'
import { getLocale } from '@/lib/i18n/server'
import { LanguageToggle } from '@/components/layout/LanguageToggle'
import { SoundWaveMark } from '@/components/ui/SoundWaveMark'

export default async function HomePage() {
  const locale = await getLocale()
  const ar = locale === 'ar'
  const features = ar
    ? [
        ['وليّ الأمر يدير الحساب', 'حساب واحد لوليّ الأمر لإدارة ملفات أطفاله ومتابعة مواعيدهم. لا توجد حسابات مستقلة للقُصّر.'],
        ['متابعة واضحة وآمنة', 'خطط متابعة عامة، ومواعيد الجلسات ونتائجها، مع حماية بيانات الأسرة بصلاحيات منفصلة.'],
        ['المواد داخل Zoom', 'القرآن والتجويد ونور البيان يظلّ محتواها داخل جلسات Zoom؛ المنصة لا تستورد الدروس أو تخزنها.'],
      ]
    : [
        ['One guardian account', 'A guardian manages child profiles and follows their sessions. Minors do not get separate accounts.'],
        ['Clear, private follow-up', 'General learning goals, session schedules and outcomes, protected by family-level access controls.'],
        ['Materials stay in Zoom', 'Quran, Tajweed and Nur al-Bayan material stays in Zoom; the platform does not import or store lessons.'],
      ]
  return (
    <main className="min-h-screen bg-parchment">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="rounded-xl bg-sidr-50 p-2 text-sidr-700"><SoundWaveMark className="h-8 w-8" /></span>
          <span><span className="block font-display text-xl font-bold text-sidr-900">أكاديمية علم وعمل</span><span className="block text-xs text-ink-soft">Elm wa Amal Academy</span></span>
        </Link>
        <div className="flex items-center gap-3"><LanguageToggle locale={locale} /><Link href="/login" className="hidden text-sm font-semibold text-sidr-700 sm:inline">{ar ? 'دخول' : 'Sign in'}</Link><Link href="/register" className="btn-primary text-sm">{ar ? 'إنشاء حساب وليّ أمر' : 'Create guardian account'}</Link></div>
      </header>

      <section className="relative overflow-hidden border-y border-gold-300 bg-white">
        <div className="pointer-events-none absolute -end-20 -top-28 h-80 w-80 rounded-full border-[32px] border-gold-100 sm:-end-8 sm:-top-40 sm:h-[34rem] sm:w-[34rem]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
          <div>
            <span className="badge-gold">{ar ? 'تعليم مباشر ومتابعة عائلية' : 'Live learning, family-led follow-up'}</span>
            <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-tight text-sidr-900 sm:text-6xl">{ar ? 'رحلة تعلّم منظّمة، تبدأ من الأسرة' : 'A thoughtful learning journey, led by family'}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-soft">{ar ? 'مساحة آمنة لوليّ الأمر لتنظيم ملفات أطفاله ومواعيدهم ومتابعتهم مع المعلم. تفاصيل الدرس ومواده تظلّ بين المعلم والأسرة داخل Zoom.' : 'A secure place for guardians to manage children’s profiles, schedules and progress with their teacher. Lesson materials and teaching stay between the teacher and family in Zoom.'}</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/register" className="btn-primary">{ar ? 'ابدأ بحساب وليّ الأمر' : 'Start with a guardian account'}</Link><Link href="/login" className="btn-secondary">{ar ? 'لديّ حساب بالفعل' : 'I already have an account'}</Link></div>
            <p className="mt-5 text-sm font-medium text-sidr-700">{ar ? 'لا حسابات للأطفال — لا تحصيل أموال حقيقي — لا تخزين لمواد الدروس' : 'No child logins — no real payment collection — no lesson materials stored'}</p>
          </div>
          <div className="relative rounded-[2rem] border border-gold-300 bg-sidr-900 p-7 text-white shadow-card-hover sm:p-10">
            <div className="absolute end-5 top-5 h-16 w-16 rounded-full border border-gold-500/50" />
            <p className="text-sm font-semibold tracking-wide text-gold-300">{ar ? 'من وليّ الأمر إلى المعلم' : 'From guardian to teacher'}</p>
            <div className="mt-7 space-y-4">
              {(ar ? ['أضف ملفات أبنائك تحت حسابك', 'تابع المواعيد ونتائج الجلسات', 'تواصل مع المعلم عبر القناة المتفق عليها'] : ['Add your children under your account', 'Follow schedules and session outcomes', 'Connect with the teacher through your agreed channel']).map((item, i) => <div key={item} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500 font-bold text-sidr-900">{i + 1}</span><span className="leading-6">{item}</span></div>)}
            </div>
            <div className="mt-7 rounded-xl border border-gold-500/50 bg-gold-500/10 p-4 text-sm leading-6 text-gold-100">{ar ? 'المنصة لا تنشئ روابط Zoom ولا تحفظها. يشاركها المعلم خارج المنصة.' : 'The platform does not create or store Zoom links. Teachers share them externally.'}</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-sm font-bold text-gold-700">{ar ? 'مساحة موحّدة' : 'One connected space'}</p><h2 className="mt-2 font-display text-3xl font-bold text-sidr-900">{ar ? 'مصمّمة للعائلة والمعلم' : 'Designed for families and teachers'}</h2></div><span className="hidden h-1 w-24 rounded-full bg-gold-500 sm:block" /></div>
        <div className="grid gap-5 md:grid-cols-3">{features.map(([title, body], i) => <article key={title} className="card relative overflow-hidden p-6 sm:p-7"><span className="absolute end-0 top-0 h-1.5 w-full bg-gradient-to-l from-gold-500 via-gold-300 to-sidr-600" /><span className="badge-gold">0{i + 1}</span><h3 className="mt-5 font-display text-xl font-bold text-sidr-900">{title}</h3><p className="mt-3 leading-7 text-ink-soft">{body}</p></article>)}</div>
      </section>
      <footer className="border-t border-mist-dark bg-white px-5 py-7 text-center text-sm text-ink-soft">© {new Date().getFullYear()} أكاديمية علم وعمل <span className="mx-2 text-gold-600">·</span>{ar ? 'المدفوعات تجريبية فقط' : 'Payments are simulated only'}</footer>
    </main>
  )
}
