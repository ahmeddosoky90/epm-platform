/**
 * Arabic / English UI dictionary (basics). The language is chosen per user (profile or the account menu)
 * and stored in the `epm_lang` cookie; Arabic switches the document to right-to-left. Layouts use
 * logical CSS properties (start/end, ps/pe) so they mirror correctly. Page bodies are still English;
 * extend this dictionary to translate more of the interface.
 */
export type Lang = "en" | "ar";
const AR: Record<string, string> = {
  Home: "الرئيسية", "My Work": "أعمالي", Projects: "المشاريع", Portfolios: "المحافظ", Programs: "البرامج", Roadmap: "خارطة الطريق",
  Delivery: "التنفيذ", Boards: "اللوحات", Backlogs: "قوائم المهام", Sprints: "السباقات", "Issues & filters": "المهام والفلاتر",
  Insight: "التحليلات", Dashboards: "لوحات المؤشرات", Reports: "التقارير", PMO: "مكتب إدارة المشاريع", Resources: "الموارد", Financials: "المالية",
  Governance: "الحوكمة", Workspace: "مساحة العمل", "Mail & files": "البريد والملفات", "Technical portal": "البوابة التقنية", Administration: "الإدارة",
  Create: "إنشاء", Collapse: "طي", "Search issues, projects, people…  ( / )": "ابحث في المهام والمشاريع والأشخاص…  ( / )",
  "Profile & security": "الملف الشخصي والأمان", "Sign out": "تسجيل الخروج", Notifications: "الإشعارات", Help: "المساعدة", Search: "بحث",
  "Sign in": "تسجيل الدخول", Email: "البريد الإلكتروني", Password: "كلمة المرور",
};
export const t = (lang: Lang, s: string) => (lang === "ar" ? AR[s] ?? s : s);
export const langFrom = (v: string | undefined): Lang => (v === "ar" ? "ar" : "en");
