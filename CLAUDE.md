## Project Context Maintenance
Keep this file as the single source of truth for project context.
Update only permanent decisions:
• Architecture.
• Core features.
• Data model.
• Major technology choices.
Do not add temporary details, bug fixes, styling changes, or session history.
Replace outdated information instead of appending.

# MediTrack Clinic

פרויקט גמר · קורס "מיישם AI" (2026). דמו קליקבילי (frontend-first) בעברית מלאה (RTL)
של מערכת לניהול **קליניקת טיפולים** קטנה (פיזיותרפיה ורפואה משלימה) — הזמנת תורים,
בקשות ומשימות. מחליף תיאום טלפוני ופתקים בתהליך דיגיטלי מקצה-לקצה.

> אפיון מלא + מסמכי ההגשה (PDF/DOCX) ותרשימי הזרימה AS-IS/TO-BE (Whimsical):
> `C:\קורס מיישם AI\פרוייקט גמר\`.
>
> **מסמכי הסבר (Word RTL) שמשקפים לוגיקה זו — לעדכן כשהלוגיקה משתנה:**
> `MediTrack-מנגנון-בקשות-ומשימות.docx` (בקשה vs משימה, 3 מקורות `source`, מחזורי חיים,
> תפקידים, AI + תרשים זרימת משימה native) · `MediTrack-מודל-אבטחה.docx`. נבנים עם ספריית
> `docx` npm v9 (`visuallyRightToLeft:true`; תרשימי זרימה = טבלאות+חצים native, לא PNG).

## מודל המוצר — הזמנה עצמית היברידית

הלב של המערכת (מתועד גם בראש `src/data/seed.js`):

- הקליניקה מגדירה **טיפולים** (`treatments`): שם + משך + אילו מטפלים נותנים אותם.
- **מסלול ראשי — הזמנה עצמית:** המטופל בוחר מטפל → טיפול → משבצת פנויה, והתור נקבע
  ישירות (`bookAppointment`, סטטוס "קבוע", **ללא אישור מזכירה**). אורך המשבצת = משך הטיפול.
- **מסלול משני — "לא בטוח/ה":** תיאור חופשי → `classifyRequest` מציע טיפול+מטפל ומרים
  **דגל דחיפות** (safety-net). בקשה כזו נכנסת ל-`submitRequest` וממתינה לאישור אנושי.
- **פרטי קשר / טלפון לתזכורות:** שדה טלפון נאסף **בתוך זרימת בקשת התור** (`NewRequest`, שלב
  "פרטים ליצירת קשר"), והוא היעד לתזכורות (וואטסאפ/SMS). מטופל **קיים** — הטלפון ממולא-מראש
  מהרשומה וניתן לעריכה; מטופל **חדש** — שם+טלפון ריקים וחובה. בסיום, `commitContact()` יוצר
  רשומת מטופל (`addPatient`) לחדש או מעדכן טלפון לקיים (`updatePatient`), ורק אז `bookAppointment`/
  `submitRequest`. המטופל המחובר (`currentPatientId`) הוא **state** ב-store — נקבע בכניסה: מזהה
  מטופל קיים או `null` למטופל חדש (ראו `Login.jsx`).
- **תור המזכירה = חריגים בלבד:** הפניות דחופות (דגל AI) + בקשות טלפוניות. רוב ההזמנות
  עצמיות וזורמות ישר ליומן. בקשות נושאות `source` (הזמנה עצמית / הפניה דחופה / טלפון / פורטל).
- כל תור נושא `treatmentId` + `visitType` (שם הטיפול, denormalized למסכי תצוגה).

מטפלים (`t1`–`t3`): רועי שקד·פיזיותרפיה · ד"ר דנה כהן·רפואה סינית ודיקור ·
מיכל לוי·רפלקסולוגיה ועיסוי. טיפולים `tr1`–`tr6` מוגדרים ב-`seed.js`.

## הרצה

```bash
npm install
npm run dev      # http://localhost:5180
npm run build
```

דרך Claude Code: `preview_start` עם `name: "meditrack"` (מוגדר ב-`C:\CLAUDE\.claude\launch.json`).

## סטאק

- **Vite 5** + **React 18** (JSX, ללא TypeScript)
- **Tailwind CSS v4** (`@tailwindcss/vite`, טוקנים ב-`src/index.css` תחת `@theme`, פלטת טורקיז/ink)
- **react-router-dom v6** · **lucide-react** · **date-fns**
- ערכת UI קטנה בסגנון shadcn שנבנתה ידנית ב-`src/components/ui.jsx` (ללא ספריית רכיבים חיצונית)

## ארכיטקטורה

```
src/
  main.jsx                 כניסה · BrowserRouter + DataProvider
  App.jsx                  ניתוב + SessionProvider + RequireRole (הגנת אזור לפי תפקיד)
  session.jsx              התפקיד המחובר + מטריצת הרשאות (ROLES)
  index.css                Tailwind v4 + טוקני עיצוב
  data/
    seed.js                מודל המוצר + נתוני דמו: treatments (מקור אמת), מטפלים, מטופלים,
                           בקשות (חריגים), ~40 תורים/שבוע, משימות. נגזרים: VISIT_TYPES, visitDuration
    store.jsx              DataProvider — state + כל הפעולות (ראו למטה)
  lib/
    aiClassifier.js        classifyRequest() — טיפול+מטפל מוצע + דגל דחיפות
    format.js              עזרי תאריך/שעה בעברית
  components/
    ui.jsx                 Card, Badge, Button, Kpi, Avatar, Empty ...
    RequestRow.jsx         שורת בקשה (מטופל / תגית source / סוג ביקור) + הרחבה (מלל/ניתוב/תגיות)
    ScheduleDialog.jsx     בורר משבצות לאישור בקשת AI/טלפון (מטפל/תאריך/שעה, זמינות חיה)
    PhoneRequestDialog.jsx קליטת בקשה טלפונית ע"י המזכירה (source:'טלפון')
    AppointmentActions.jsx check-in/out (הגיע/סיום/לא הגיע), מוגן ב-role.canApprove
    clsx.js
  layouts/                 ClinicLayout (דסקטופ) · DoctorLayout (צפייה) · PatientLayout (רספונסיבי: טאבים במובייל / סרגל עליון בדסקטופ)
  pages/
    Login.jsx              שתי כניסות: צוות (3 תפקידים) · מטופל (רשום 'p1' / חדש null → setCurrentPatient)
    clinic/  Dashboard · Calendar · TasksBoard · Reports · Settings
    doctor/  DoctorDay · DoctorCalendar · VisitCard   (צפייה בלבד)
    patient/ NewRequest (הזמנה עצמית רב-שלבית + "לא בטוח" + פרטי קשר/טלפון) · MyAppointments (ביטול/שינוי)
```

## תפקידים (`session.jsx` → `ROLES`)

| תפקיד | אזור | עיקר |
|-------|------|------|
| מזכירות (`secretary`) | `/clinic` | בקשות (חריגים), יומן, משימות, הגדרות · **ללא דוחות** |
| מנהל/ת (`manager`) | `/clinic` | הכל + דוחות |
| מטפל (`therapist`) | `/doctor` | צפייה בלבד · רק היומן/המשימות שלו (`therapistId: t1`) |
| מטופל (`patient`) | `/patient` | הזמנה עצמית + מעקב (רספונסיבי — מובייל ודסקטופ) |

`RequireRole` (`App.jsx`) חוסם גישה חוצת-אזור ומפנה ל-`role.home`. שתי כניסות נפרדות.

## פעולות ה-store (`store.jsx`)

- **הזמנה עצמית:** `bookAppointment({patientId,therapistId,treatmentId,start,reason})` — תור "קבוע" ישיר.
- **ביטול:** `cancelAppointment(id)` — מפנה את המשבצת.
- **מסלול AI:** `submitRequest({...,source})` → `approveRequest(id, slot)` / `rejectRequest(id)`.
- **ניהול טיפולים (Settings):** `addTreatment` / `updateTreatment` / `removeTreatment`.
- **צוות/מטפלים/מטופלים:** `addStaff`/`updateStaff`/`removeStaff`, `updateTherapist`, `addPatient`, `updatePatient`.
- **מטופל מחובר:** `currentPatientId` (state) + `setCurrentPatient(id|null)` — נקבע בכניסת המטופל.
- **סטטוס/משימות:** `setAppointmentStatus` (אי-הגעה → משימת פולו-אפ אוטומטית לפי `settings.followUpOnNoShow`),
  `bulkMarkNoShow(ids)` (סימון מרוכז של תורי-עבר שלא טופלו כ"לא הגיע", כל אחד מוליד משימת פולו-אפ),
  `setTaskStatus`, `addTask`.
- **תורים שלא טופלו (unresolved past):** תור "קבוע" שהמשבצת שלו הסתיימה ולא סומן הגיע/לא-הגיע = מצב
  לא-פתור שמעוות דוחות. הזיהוי הוא **state נגזר** (`lib/appointments.js` → `isUnresolvedPast`/`selectUnresolved`),
  ללא מוטציה שקטה; הפתרון אנושי. **UX היברידי:** Dashboard מציג רק **KPI קומפקטי** עם המונה שמנווט
  ל-`/clinic/tasks` (`state.focus:'unresolved'`); **תור הסקירה המלא** — `UnresolvedAppointments.jsx`,
  **אקורדיון רך מתקפל** (מקופל כברירת מחדל; ניווט מה-KPI פותח אותו) עם שורות `AppointmentActions` + סימון-מרוכז —
  חי בלוח המשימות. Reports מציג הערת "נתונים חלקיים" כל עוד קיימים כאלה.
- **הגדרות:** `updateSettings` (`remindersEnabled`/`reminderHours`/`autoNoShow`/`noShowMinutes`/`followUpOnNoShow`)
  — משפיעות בפועל ברחבי האפליקציה.

## AI ואוטומציות

- **`classifyRequest`** (`lib/aiClassifier.js`) מקבל `{description, preferredTherapistId, visitTypeHint}`
  ומחזיר `{urgency, urgencyScore, urgentFlag, treatmentId, visitType, routedTo, tags, rationale}`.
  עקרון: **בחירת המטופל מנצחת** — hint של מטפל/טיפול גובר; אחרת מיפוי מילות-מפתח (`TREATMENT_RULES`),
  ברירת מחדל `tr1` (פיזיו הערכה). דחיפות = `URGENT_TERMS` → `urgentFlag` → הפניה לאדם.
- **החלפה ל-LLM אמיתי:** להפוך את `classifyRequest` ל-async ולקרוא ל-API (Claude) עם אותו
  input/output schema — ה-UI לא משתנה.
- **אוטומציות ב-`store.jsx`:** אי-הגעה יוצרת משימת פולו-אפ; אישור בקשה קובע תור ומנתב למטפל שה-AI בחר.

## מודל אבטחה — מצב נוכחי ומתוכנן

**היום — מחובר ל-Supabase (Auth + DB + RLS):** `Login.jsx` = כניסת Supabase Auth אמיתית
(אימייל+סיסמה למשתמשי הדגמה; מטופל = OTP לטלפון מתוכנן). `session.jsx` גוזר את `role` מ-`app_metadata.role`
שב-JWT (ל-מטפל נגזר גם `role.therapistId` משורת המטפל), ו-`currentPatientId` מגיע מהסשן המאומת.
`store.jsx` = **מירור מקומי מעל Supabase** — טוען את כל הישויות בכניסה (RLS-scoped), וכל פעולה מעדכנת
state אופטימי (UUID מהלקוח) ומתמידה ל-DB ברקע; אותו חוזה `useData()` סינכרוני, הרכיבים לא השתנו.
**RLS הוא שכבת האכיפה** (מדיניות לפי `clinic_id`+`role`); `RequireRole` (`App.jsx`) = UX בלבד. פונקציות
Edge: `classify-request` (סיווג) ו-`send-reminder` (וואטסאפ/SMS) מחזיקות סודות בשרת. הסשן נשמר בין רענונים.

**מתוכנן ל-Production (עם Supabase) — לעקוב אחריו כשמחברים DB:**
- **Authentication (Supabase Auth):** מטופל = OTP לטלפון (הטלפון כבר ערוץ התזכורות); צוות
  (מזכירה/מטפל/מנהל) = Email+סיסמה / Magic Link. JWT session נושא `uid` + `role` + `clinic_id`;
  Logout מבטל את ה-refresh token. `currentPatientId` יגיע מהסשן המאומת, לא מבחירה ידנית.
- **RBAC:** תפקיד יחיד per-user ב-App Metadata (לא ניתן לשינוי מהלקוח); 4 התפקידים של `ROLES`; Least Privilege.
- **Multi-tenant:** כל רשומה נושאת `clinic_id` → בידוד מלא בין קליניקות.
- **RLS = שכבת האכיפה המרכזית:** מטופל→`patient_id = auth.uid()`; מטפל→`therapist_id = auth.uid()`
  (שיוך מטפל-מטופל); מזכירה/מנהל→לפי `clinic_id`; דוחות→manager בלבד.
- **Defense in depth:** הגנת ה-Frontend (Route Guards / הסתרת כפתורים) = UX בלבד; האכיפה המחייבת
  בשרת (JWT + RLS + Edge Functions). מפתחות סוד רק בשרת. עיקרון: *Never trust the client.*

**מסמך אפיון מלא:** `C:\קורס מיישם AI\פרוייקט גמר\MediTrack-מודל-אבטחה.docx` (Word RTL — 5 סעיפים
+ תרשים Security Flow; ממוקד Production עתידי).

## מוסכמות

- עברית + RTL בכל הממשק (`dir="rtl"` ב-`index.html`); טקסטים בקוד בעברית — לשמור.
- צבעים דרך טוקני Tailwind (`teal-*`, `ink-*`, `canvas`) — לא hex ישיר ב-JSX.
- **נתונים מ-Supabase, סשן נשמר** — הסשן המאומת נשמר בין רענונים; `store.jsx` טוען מה-DB בכניסה (RLS-scoped)
  ומתמיד פעולות ברקע. דורש `.env` עם `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (ראו `.env.example`). ניווט דרך קישורי SPA.
- כל בעיה שנראית בדפדפן — לתקן בקוד המקור, לא ב-DevTools.
- **נראות פורטל המטופל (רספונסיבי, `PatientLayout.jsx`):** אותה כתובת, שתי פריסות לפי breakpoint `md`:
  - **מובייל (`<md`):** כותרת כהה למעלה + **טאבים תחתונים** (2 טאבים), תוכן במסך מלא.
  - **דסקטופ (`≥md`):** **סרגל ניווט עליון** (לוגו + ניווט אופקי + שלום/יציאה) ותוכן **ממורכז**
    ב-`max-w-3xl`. כרטיסי התורים ב-`MyAppointments` עוברים ל**רשת 2 טורים** (`sm:grid-cols-2`);
    טופס `NewRequest` מוגבל ל-`max-w-xl` כדי שלא יתמתח. **אין יותר מסגרת-טלפון.**
  צד הקליניקה/רופא (`ClinicLayout` סייד-בר ימני / `DoctorLayout`) נפרשים לרוחב דסקטופ מלא (עד 1400px).
