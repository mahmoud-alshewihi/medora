export type Locale = "en" | "ar";
export const dict = {
  en: {
    appName: "Medora", signIn: "Sign in", signOut: "Sign out", register: "Register", email: "Email", password: "Password", bookAppointment: "Book an appointment",
    doctors: "Doctors", specialties: "Specialties", services: "Services", branches: "Branches", faq: "FAQ", contact: "Contact", testimonials: "Testimonials (demonstration content)",
    dashboard: "Dashboard", patients: "Patients", appointments: "Appointments", billing: "Billing", expenses: "Expenses", inventory: "Inventory", reports: "Reports", staff: "Staff", settings: "Settings",
    notifications: "Notifications", reception: "Reception", queue: "Queue", save: "Save", cancel: "Cancel", confirm: "Confirm", search: "Search", loading: "Loading", retry: "Retry", empty: "Nothing here yet",
    next: "Next", back: "Back", date: "Date", time: "Time", status: "Status", total: "Total", paid: "Paid", outstanding: "Outstanding", privacy: "Privacy policy", terms: "Terms and conditions",
    selectBranch: "Select branch", selectSpecialty: "Select specialty", selectDoctor: "Select doctor", selectDate: "Select date", selectTime: "Select time", yourDetails: "Your details", review: "Review", confirmBooking: "Confirm appointment",
    portal: "My portal", language: "العربية", theme: "Theme",
  },
  ar: {
    appName: "ميدورا", signIn: "تسجيل الدخول", signOut: "تسجيل الخروج", register: "إنشاء حساب", email: "البريد الإلكتروني", password: "كلمة المرور", bookAppointment: "احجز موعدًا",
    doctors: "الأطباء", specialties: "التخصصات", services: "الخدمات", branches: "الفروع", faq: "الأسئلة الشائعة", contact: "اتصل بنا", testimonials: "آراء المرضى (محتوى توضيحي)",
    dashboard: "لوحة التحكم", patients: "المرضى", appointments: "المواعيد", billing: "الفواتير", expenses: "المصروفات", inventory: "المخزون", reports: "التقارير", staff: "الموظفون", settings: "الإعدادات",
    notifications: "الإشعارات", reception: "الاستقبال", queue: "قائمة الانتظار", save: "حفظ", cancel: "إلغاء", confirm: "تأكيد", search: "بحث", loading: "جارٍ التحميل", retry: "إعادة المحاولة", empty: "لا توجد بيانات بعد",
    next: "التالي", back: "رجوع", date: "التاريخ", time: "الوقت", status: "الحالة", total: "الإجمالي", paid: "المدفوع", outstanding: "المتبقي", privacy: "سياسة الخصوصية", terms: "الشروط والأحكام",
    selectBranch: "اختر الفرع", selectSpecialty: "اختر التخصص", selectDoctor: "اختر الطبيب", selectDate: "اختر التاريخ", selectTime: "اختر الوقت", yourDetails: "بياناتك", review: "مراجعة", confirmBooking: "تأكيد الموعد",
    portal: "بوابتي", language: "English", theme: "المظهر",
  },
} as const;
export type Key = keyof (typeof dict)["en"];
export const t = (l: Locale, k: Key) => dict[l][k];
