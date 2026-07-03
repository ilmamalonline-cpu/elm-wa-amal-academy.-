# 🌿 أكاديمية علم وعمل — Elm wa Amal Academy

منصة متكاملة (Next.js 16 + Supabase + Zoom) لتصحيح النطق والصوتيات القرآنية. فيها 3 لوحات تحكم (طالب / معلم / أدمن)، حجز جلسات حقيقي مع Zoom API فعلي (مش mock)، اشتراكات أسبوعية متكررة، وتصميم أخضر/عاجي/ذهبي ثنائي اللغة (عربي RTL + إنجليزي).

---

## ⚠️ اقرأ الأول: إيه اللي شغال فعليًا وإيه اللي مش شغال

- **Zoom حقيقي**: كل حجز بينشئ Zoom meeting فعلي عن طريق Server-to-Server OAuth، مش رابط وهمي. لو فشل إنشاء الـ meeting، الحجز بيتلغي تلقائيًا (rollback) عشان محدش ياخد حجز "مؤكد" بدون رابط شغال.
- **الدفع (Payment) مبسّط بالكامل**: زي ما طلبت بالظبط — لما الطالب يضغط "تأكيد"، مفيش أي بوابة دفع حقيقية، الحجز بيتأكد على طول.
- **المواعيد بتوقيت القاهرة**: كل الأوقات في التطبيق (جدول المعلم، الحجز، العداد التنازلي) بتوقيت **Africa/Cairo**، وبتحسب فرق التوقيت الصيفي/الشتوي تلقائيًا (مصر بترجع لتوقيت صيفي من أواخر أبريل لأواخر أكتوبر) — مفيش أي offset ثابت متكتوب في الكود.
- **الأدمن مش موجود من نفسه**: التسجيل العام (Register) بيعمل حساب "طالب" بس دايمًا. لازم تعمل أول حساب أدمن يدويًا (الخطوات تحت).

---

## 📋 المتطلبات

- حساب [Supabase](https://supabase.com) (عندك بالفعل project جاهز في البرومبت)
- حساب [Zoom Marketplace](https://marketplace.zoom.us) مع Server-to-Server OAuth App (عندك الـ credentials بالفعل)
- Node.js 20+ على جهازك (لو هتشغّل local) — أو تروح على طول لـ Vercel
- حساب [Vercel](https://vercel.com) للنشر

---

## 1️⃣ خطوة قاعدة البيانات (Supabase)

1. افتح مشروعك على [supabase.com/dashboard](https://supabase.com/dashboard)
2. من القائمة الجانبية: **SQL Editor** → **New query**
3. افتح ملف `supabase/schema.sql` من المشروع ده، انسخ **كل المحتوى**، الصقه، واضغط **Run**
4. هيتعمل كل حاجة: الجداول، الـ Row Level Security، والـ functions (`book_slot`, `cancel_booking`, `mark_booking_completed`, `get_admin_stats`)

### هات الـ Service Role Key

1. **Project Settings** → **API**
2. انسخ الـ **`service_role`** key (مش الـ anon key اللي عندك بالفعل)
3. حطه في `.env.local` مكان `SUPABASE_SERVICE_ROLE_KEY`

⚠️ الـ key ده خطير — بيتخطى كل الـ RLS. متحطوش أبدًا في أي كود client-side، وده أصلاً مضبوط كده في المشروع (مستخدم بس في ملفات `route.ts` على السيرفر).

### فعّل الـ Email Auth

**Authentication** → **Providers** → تأكد إن **Email** مفعّل.

---

## 2️⃣ خطوة Zoom

الـ credentials اللي بعتهاهملي (Account ID, Client ID, Client Secret) متحطوطين بالفعل في `.env.local`. باقي حاجة واحدة مهمة:

### `ZOOM_HOST_EMAIL`

Server-to-Server OAuth apps مينفعش تستخدم كلمة "me" — لازم تحدد إيميل مستخدم Zoom حقيقي (Licensed) هيتعمل الاجتماعات تحت حسابه. افتح `.env.local` وحط إيميل حساب الـ Zoom بتاعك مكان `ZOOM_HOST_EMAIL`.

### تأكد من الـ Scopes

في [marketplace.zoom.us](https://marketplace.zoom.us) → تطبيقك → **Scopes**، لازم يكون عندك على الأقل:
- `meeting:write:admin`
- `meeting:read:admin`
- `user:read:admin`

وتأكد إن التطبيق **Activated** (مش Draft) — لو مش مُفعّل، أي محاولة حجز هتفشل بخطأ واضح من `lib/zoom/client.ts`.

---

## 3️⃣ التشغيل محليًا (اختياري)

```bash
npm install
npm run dev
```

افتح `http://localhost:3000`

---

## 4️⃣ إنشاء أول حساب أدمن (خطوة لازم تعملها مرة واحدة بس)

مفيش زرار "سجّل كأدمن" — ده مقصود، عشان محدش يقدر يعمل نفسه أدمن من غير إذن. اعمل الآتي:

1. روح على الموقع (بعد الرفع أو محليًا) واعمل **Register** بإيميلك الشخصي (هيتعمل حساب "طالب")
2. ارجع لـ Supabase → **SQL Editor** → شغّل:

```sql
update public.profiles
set role = 'admin'
where email = 'ضع-إيميلك-هنا@example.com';
```

3. سجّل خروج ودخول تاني — هتلاقي نفسك في **Admin Dashboard**، ومن هناك تقدر تضيف المعلمين من واجهة "إدارة المستخدمين" مباشرة (مفيش داعي لـ SQL تاني بعد كده).

---

## 5️⃣ الرفع على Vercel

1. ارفع المجلد ده كـ repo على GitHub (أو اسحبه مباشرة لو Vercel بيدعم رفع مجلد)
2. من Vercel: **New Project** → اختر الـ repo
3. في **Environment Variables** ضيف كل المتغيرات دي (انسخها من `.env.local` بتاعك):

| Variable | ملحوظة |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ عندك |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ عندك |
| `SUPABASE_SERVICE_ROLE_KEY` | من خطوة 1 |
| `ZOOM_ACCOUNT_ID` | ✅ عندك |
| `ZOOM_CLIENT_ID` | ✅ عندك |
| `ZOOM_CLIENT_SECRET` | ✅ عندك |
| `ZOOM_HOST_EMAIL` | من خطوة 2 |
| `NEXT_PUBLIC_APP_URL` | حط رابط الـ Vercel النهائي بعد أول deploy |

4. اضغط **Deploy**

### بعد أول Deploy

روح على Supabase → **Authentication** → **URL Configuration** → ضيف رابط الـ Vercel بتاعك (مثلاً `https://elm-wa-amal.vercel.app`) في **Site URL** و **Redirect URLs**، وإلا تسجيل الدخول ممكن يعلّق.

---

## 🗂️ خريطة المشروع (لو حابب تعدّل حاجة بنفسك)

```
supabase/schema.sql          # كل قاعدة البيانات — شغّله مرة واحدة في Supabase
proxy.ts                     # حماية الصفحات + توجيه كل دور لداشبورده
lib/zoom/client.ts           # Zoom OAuth + إنشاء الاجتماعات (فيه كل الـ error handling)
lib/utils/datetime.ts        # كل حسابات التوقيت (القاهرة + التوقيت الصيفي)
lib/supabase/
  ├─ client.ts                # للاستخدام في المتصفح (Client Components)
  ├─ server.ts                 # للاستخدام في السيرفر (Server Components)
  └─ admin.ts                  # service role — سيرفر بس، صلاحيات كاملة

app/api/bookings/create/     # قلب النظام: حجز + Zoom + rollback لو فشل
app/dashboard/student/       # داشبورد الطالب (حجز، جلساتي، تفضيلاتي)
app/dashboard/teacher/       # داشبورد المعلم (مواعيدي، فصولي، تفضيلات الطلاب)
app/dashboard/admin/         # داشبورد الأدمن (إحصائيات، مستخدمين، سجل حجوزات)
```

كل ملف فيه تعليقات بتشرح الـ "ليه" مش بس الـ "إيه" — خصوصًا في `schema.sql` و`bookings/create/route.ts`.

---

## 🔧 مشاكل شائعة (Troubleshooting)

**"Zoom rejected the OAuth token request"**
تأكد إن الـ Server-to-Server App مفعّل (Activated) في Zoom Marketplace، وإن الـ 3 credentials متطابقة بالظبط مع اللي في `.env.local`.

**الحجز بيفشل بـ "تم حجز الموعد لكن حدث خطأ أثناء إنشاء رابط Zoom"**
افتح الـ logs بتاعت الـ deployment على Vercel، هتلاقي تفاصيل الخطأ الحقيقي من Zoom (زي scope ناقص أو الـ host email غلط).

**تسجيل الدخول مش بيكمل بعد أول Deploy**
غالبًا نسيت تضيف رابط الـ Vercel في Supabase → Authentication → URL Configuration (خطوة 5 فوق).

**عايز تضيف معلم وميظهرش زرار الأدمن**
لازم الحساب يبقى `role = 'admin'` في جدول `profiles` — راجع خطوة 4.

---

## 💡 أفكار للمرحلة الجاية (مش متعملة دلوقتي)

- بوابة دفع حقيقية (Paymob / Fawry) بدل التأكيد المباشر
- إشعارات Email/SMS قبل الجلسة
- تقييم الطالب للمعلم بعد كل جلسة
- سجل مالي للمعلمين (كام جلسة، كام مستحق)

