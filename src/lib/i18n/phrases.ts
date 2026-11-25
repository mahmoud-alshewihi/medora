/** Arabic for UI phrases used in headings and table headers. Unknown phrases fall back to the English text. */
export const AR: Record<string, string> = {
  "Appointments": "المواعيد", "Book an appointment": "احجز موعد", "Clinic settings": "إعدادات العيادة", "Clinics": "العيادات", "Dashboard": "لوحة التحكم", "Expenses": "المصروفات",
  "Inventory": "المخزون", "Invoices": "الفواتير", "Live queue": "قائمة الانتظار المباشرة", "My day": "يومي", "Patients": "المرضى", "Reports": "التقارير", "Staff": "الموظفون",
  "Welcome": "مرحباً", "My appointments": "مواعيدي", "Prescriptions": "الوصفات الطبية", "Book new": "حجز جديد", "Consultation": "الكشف",
  "Amount": "المبلغ", "Branch": "الفرع", "Cancelled": "ملغي", "Category": "الفئة", "Clinic": "العيادة", "Completed": "مكتمل", "Date": "التاريخ", "Description": "الوصف", "Doctor": "الطبيب",
  "Email": "البريد الإلكتروني", "Est. wait (min)": "الانتظار المتوقع (دقيقة)", "Gender": "النوع", "Item": "الصنف", "Level": "المستوى", "MRN": "رقم الملف", "Method": "الطريقة", "Minimum": "الحد الأدنى",
  "Name": "الاسم", "Number": "الرقم", "Paid": "المدفوع", "Patient": "المريض", "Payments": "الدفعات", "Phone": "الهاتف", "Quantity": "الكمية", "Revenue": "الإيرادات", "Role": "الدور", "SKU": "الرمز",
  "Slug": "المعرّف", "Status": "الحالة", "Time": "الوقت", "Total": "الإجمالي", "When": "الموعد", "Branches": "الفروع", "Specialties": "التخصصات", "Services": "الخدمات",
  "Net income": "صافي الدخل", "Outstanding": "المستحق", "Refunds": "المستردات", "Cancellation rate": "نسبة الإلغاء", "Search": "بحث", "Apply": "تطبيق", "From": "من", "To": "إلى",
};
export function tx(locale: "en" | "ar", s: string): string { return locale === "ar" ? AR[s] ?? s : s; }
