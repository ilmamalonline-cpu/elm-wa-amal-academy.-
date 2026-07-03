import Link from 'next/link'
import { getLocale } from '@/lib/i18n/config'
import { dictionary } from '@/lib/i18n/dictionary'
import { SoundWaveMark } from '@/components/ui/SoundWaveMark'
import { LanguageToggle } from '@/components/layout/LanguageToggle'

export default async function HomePage() {
  const locale = await getLocale()
  const t = dictionary[locale]
  const isAr = locale === 'ar'

  const valueProps = isAr
    ? [
        {
          title: 'جلسات مباشرة، فردية أو جماعية',
          body: 'تواصل وجهًا لوجه مع شيخك عبر Zoom، في موعد ثابت تعرفه مسبقًا كل أسبوع.',
        },
        {
          title: 'متابعة دقيقة بعد كل جلسة',
          body: 'ملاحظات صوتية مكتوبة لكل خطأ في مخارج الحروف، مع واجب منزلي محدد لتثبيت التصحيح.',
        },
        {
          title: 'مواعيد تناسب جدولك',
          body: 'اختر من بين الأوقات الفارغة لمعلمك، أو سجّل تفضيلاتك ليفتح لك معلمون جدد أوقاتهم.',
        },
      ]
    : [
        {
          title: 'Live one-on-one or group sessions',
          body: 'Meet your teacher face-to-face over Zoom, at a fixed weekly time you know in advance.',
        },
        {
          title: 'Precise feedback after every session',
          body: 'Written notes on every articulation error, with specific homework to lock in the correction.',
        },
        {
          title: 'Times that fit your schedule',
          body: "Pick from a teacher's open slots, or log your preferences so new teachers open hours that match.",
        },
      ]

  return (
    <main className="min-h-screen bg-parchment">
      {/* ---------- Header ---------- */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="text-sidr-700">
            <SoundWaveMark className="h-8 w-8" />
          </span>
          <span className="font-display text-xl font-bold text-sidr-900">
            {t.academy.name}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <LanguageToggle locale={locale} />
          <Link href="/login" className="hidden text-sm font-semibold text-sidr-700 hover:text-sidr-600 sm:inline">
            {t.auth.loginTitle}
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            {t.auth.registerCta}
          </Link>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute end-[-8rem] top-[-6rem] text-gold-500/40 sm:end-[-4rem]">
          <SoundWaveMark className="h-[28rem] w-[28rem]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-10 sm:pb-28 sm:pt-16">
          <span className="badge-gold">
            {isAr ? '✨ تعليم متخصص أونلاين' : '✨ Specialized online instruction'}
          </span>

          <h1 className="font-display mt-6 max-w-2xl text-4xl font-bold leading-tight text-sidr-900 sm:text-5xl">
            {isAr ? (
              <>تصحيح النطق وعلم الأصوات القرآنية، على يد متخصصين</>
            ) : (
              <>Articulation correction & Quranic phonetics, taught right</>
            )}
          </h1>

          <p className="text-ink-soft mt-5 max-w-xl text-lg leading-relaxed">
            {isAr
              ? 'أكاديمية علم وعمل تجمعك بمعلمين متخصصين في تصحيح مخارج الحروف وأحكام التجويد، في جلسات مباشرة منظمة بمواعيد ثابتة تناسب حياتك.'
              : 'Elm wa Amal Academy connects you with teachers specialized in correcting articulation points (makharij) and tajweed rules, in live sessions on a fixed weekly schedule that fits your life.'}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/register" className="btn-primary">
              {isAr ? 'ابدأ رحلتك الآن' : 'Start your journey'}
            </Link>
            <Link href="/login" className="btn-secondary">
              {t.auth.loginTitle}
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Value props ---------- */}
      <section className="border-t border-mist-dark bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="grid gap-6 sm:grid-cols-3">
            {valueProps.map((item) => (
              <div key={item.title} className="card p-6">
                <h3 className="font-display text-lg font-bold text-sidr-900">{item.title}</h3>
                <p className="text-ink-soft mt-2 text-[0.95rem] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-mist-dark">
        <div className="mx-auto max-w-6xl px-6 py-8 text-center text-sm text-ink-soft">
          © {new Date().getFullYear()} {t.academy.name}
        </div>
      </footer>
    </main>
  )
}
