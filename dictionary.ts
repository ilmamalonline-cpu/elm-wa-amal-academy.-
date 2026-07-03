// lib/i18n/dictionary.ts
// Lightweight bilingual dictionary (no external i18n library needed at this
// scale). Keep keys grouped by feature area. Usage in a component:
//
//   import { dictionary } from '@/lib/i18n/dictionary'
//   const t = dictionary[locale]
//   <h1>{t.academy.name}</h1>

export const dictionary = {
  ar: {
    common: {
      loading: 'جارٍ التحميل...',
      save: 'حفظ',
      cancel: 'إلغاء',
      confirm: 'تأكيد',
      back: 'رجوع',
      next: 'التالي',
      search: 'بحث',
      error: 'حدث خطأ، حاول مرة أخرى',
      comingSoon: 'قريبًا',
    },
    nav: {
      home: 'الرئيسية',
      dashboard: 'لوحة التحكم',
      sessions: 'جلساتي',
      bookSession: 'احجز جلسة',
      availability: 'مواعيدي',
      matchmaking: 'تفضيلات الطلاب',
      myClasses: 'فصولي',
      students: 'الطلاب',
      bookings: 'الحجوزات',
      logout: 'تسجيل الخروج',
    },
    auth: {
      loginTitle: 'تسجيل الدخول',
      registerTitle: 'إنشاء حساب طالب جديد',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      fullName: 'الاسم الكامل',
      loginCta: 'دخول',
      registerCta: 'إنشاء الحساب',
      noAccount: 'ليس لديك حساب؟',
      hasAccount: 'لديك حساب بالفعل؟',
      registerLink: 'سجّل الآن',
      loginLink: 'سجّل الدخول',
      invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      deactivated: 'هذا الحساب موقوف مؤقتًا. تواصل مع إدارة الأكاديمية.',
      emailInUse: 'هذا البريد الإلكتروني مستخدم بالفعل',
      weakPassword: 'كلمة المرور قصيرة جدًا',
      checkEmail: 'تحقق من بريدك الإلكتروني لتأكيد الحساب قبل تسجيل الدخول',
    },
    academy: {
      name: 'أكاديمية علم وعمل',
      tagline: 'تصحيح النطق وعلم الأصوات القرآنية',
    },
    roles: {
      admin: 'مدير',
      teacher: 'معلم',
      student: 'طالب',
    },
    booking: {
      slotTaken: 'للأسف تم حجز هذا الموعد للتو من طالب آخر. برجاء اختيار موعد آخر.',
      slotFull: 'اكتمل عدد الطلاب في هذه المجموعة. برجاء اختيار موعد آخر.',
      notFound: 'هذا الموعد لم يعد متاحًا.',
      zoomFailed: 'تم حجز الموعد، لكن حدث خطأ أثناء إنشاء رابط Zoom. تم إلغاء الحجز تلقائيًا — برجاء المحاولة مرة أخرى، وإن تكررت المشكلة تواصل مع الإدارة.',
      confirmed: 'تم تأكيد حجزك بنجاح',
      unauthenticated: 'يجب تسجيل الدخول أولًا',
    },
  },
  en: {
    common: {
      loading: 'Loading...',
      save: 'Save',
      cancel: 'Cancel',
      confirm: 'Confirm',
      back: 'Back',
      next: 'Next',
      search: 'Search',
      error: 'Something went wrong, please try again',
      comingSoon: 'Coming soon',
    },
    nav: {
      home: 'Home',
      dashboard: 'Dashboard',
      sessions: 'My Sessions',
      bookSession: 'Book a Session',
      availability: 'My Availability',
      matchmaking: 'Student Preferences',
      myClasses: 'My Classes',
      students: 'Students',
      bookings: 'Bookings',
      logout: 'Log out',
    },
    auth: {
      loginTitle: 'Log in',
      registerTitle: 'Create a student account',
      email: 'Email',
      password: 'Password',
      fullName: 'Full name',
      loginCta: 'Log in',
      registerCta: 'Create account',
      noAccount: "Don't have an account?",
      hasAccount: 'Already have an account?',
      registerLink: 'Register now',
      loginLink: 'Log in',
      invalidCredentials: 'Incorrect email or password',
      deactivated: 'This account is temporarily suspended. Contact the academy.',
      emailInUse: 'This email is already in use',
      weakPassword: 'Password is too short',
      checkEmail: 'Check your email to confirm your account before logging in',
    },
    academy: {
      name: 'Elm wa Amal Academy',
      tagline: 'Articulation Correction & Quranic Phonetics',
    },
    roles: {
      admin: 'Admin',
      teacher: 'Teacher',
      student: 'Student',
    },
    booking: {
      slotTaken: 'Sorry, another student just booked this slot. Please choose a different time.',
      slotFull: 'This group session is now full. Please choose a different time.',
      notFound: 'This slot is no longer available.',
      zoomFailed: 'The slot was booked, but creating the Zoom link failed. The booking has been automatically cancelled — please try again, and contact the academy if this keeps happening.',
      confirmed: 'Your booking is confirmed',
      unauthenticated: 'Please log in first',
    },
  },
} as const

export type Dictionary = typeof dictionary.ar
