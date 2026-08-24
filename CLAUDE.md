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
- **מסלול משני — "לא בטוח/ה איזה טיפול מתאים?":** **פנייה אנושית ללא AI.** המטופל בוחר
  **נושא הפנייה** (שירות פעיל של הקליניקה, או "אדמיניסטרציה" / "אחר") ומוסיף פירוט חופשי (רשות),
  והפנייה נשלחת ישירות למזכירה (`submitInquiry`, נשמרת כ-`requests` עם `kind:'inquiry'`, ללא `ai`).
  הפנייה נכנסת לתור המזכירה בסטטוס `ממתין` עם באדג׳ **"פנייה מהפורטל"**; המזכירה קוראת, מוסיפה
  **הערה פנימית** (`staff_note`, לא נראית למטופל) ו**פותרת אותה בשני מסלולים סופיים, סותרים זה את זה**
  (שניהם מסירים אותה מהלוח): **סימון כטופל** (`updateInquiry`→`סגור`, ללא יצירת משימה) **או**
  **הפיכה למשימה** (`convertInquiryToTask` — יוצרת משימה `בטיפול` ומסמנת את הבקשה `הומר למשימה`).
  אין ניתוב/שיבוץ אוטומטי.
- **קליטת מטופל חדש = שלב אונבורדינג לפני ההזמנה:** מטופל **חדש** (ללא רשומה, `currentPatientId` → `null`)
  רואה תחילה **טופס אונבורדינג** (`NewRequest` → `Onboarding`) האוסף שם + טלפון + שנת לידה + מין (חובה,
  מולידציה), צ׳קבוקס **חובה** למדיניות פרטיות/תנאי שימוש, וצ׳קבוקס **רשות** לקבלת התראות (SMS/אימייל).
  בשליחה `addPatient` יוצר את רשומת ה-`patients` (כולל `notify_opt_in`) ו-`setCurrentPatient` הופך אותו
  למחובר — רק אז נפתח מסך ההזמנה. **מטופל קיים** מדלג על האונבורדינג לגמרי. מסך ההזמנה מציג **ברכה מותאמת
  אישית** למעלה ("שלום {שם} 👋") ובורר מטפל→טיפול→מועד; שדות **טלפון + אימייל** מוצגים בו **ממולאים-מראש
  מהרשומה וניתנים לעריכה** — עריכה מותמדת ל-`patients` באישור (`persistContactEdits` → `updatePatient`,
  רק אם השתנו). **הסכמות הקליטה (פרטיות + אישור התראות) נאספות אך ורק באונבורדינג ואינן מופיעות במסך
  ההזמנה.** הטלפון הוא היעד לתזכורות (וואטסאפ/SMS). המטופל המחובר (`currentPatientId`) הוא **state**
  ב-store — נקבע בכניסה (ראו `Login.jsx`).
- **שדות חובה של מטופל (`patients`, נאכף ב-DB):** `phone` / `birth_year` / `gender` הם NOT NULL;
  `gender` הוא ערך קנוני `CHECK (gender IN ('male','female','other'))` — נאסף בטופסי הקליטה
  (`NewRequest`, `PatientPicker` בטופסי המזכירה) ומוצג בעברית דרך `genderLabel` (`lib/format.js`). **גיל נגזר
  ואינו נשמר** — `age = currentYear − birth_year` (`ageFromBirthYear`); עמודת `age` הוסרה (migration 18).
- **`email` (אופציונלי):** ערוץ **התראות משני** — הטלפון נשאר הערוץ המחייב. עמודה nullable עם
  `CHECK` פורמט שחל רק כשקיים ערך (migration 20); ולידציה בקליינט דרך `emailValid`/`normalizeEmail`
  (`lib/validation.js`). נאסף (רשות) בטופסי הקליטה ומוצג בתיק המטופל (`VisitCard`) כשקיים.
- **שיחות טלפון = פעולה ישירה של המזכירה (ללא AI):** שני כפתורים בשורת המדדים של הדשבורד
  (`Dashboard` → "קביעה מהירה" / "פתיחת בקשה"): **(1) קביעה ישירה בשיחה (Direct Booking)** —
  `QuickBookDialog` → `bookAppointmentByStaff` יוצר תור ישירות ב-`appointments` (עוקף את `requests`),
  `source='טלפון'` + `created_by` (המזכירה). **(2) פתיחת בקשה** — `EscalationDialog` → `openStaffRequest`
  פותח **בקשה** (`requests`, `kind:'inquiry'`, `source='טלפון'`, `status='ממתין'`) עם מטופל + קטגוריה
  (→`subject`) + פירוט (→`description`) + דחיפות רשות (`urgency`). הבקשה נכנסת ל**"בקשות הדורשות טיפול"**
  ונפתרת שם כמו כל פנייה (סימון טופל / המרה למשימה) — לא נוצרת משימה אוטומטית.
- **תור המזכירה (`requests`) = פניות אנושיות בלבד (`kind:'inquiry'`) — שני מקורות באותו לוח
  "בקשות הדורשות טיפול"** (`RequestRow`→`InquiryRow`, בסטטוס `ממתין`; רוב ההזמנות עצמיות וזורמות ישר ליומן):
  **(א) פנייה מהפורטל** (`source='פורטל'`, `submitInquiry`) — המטופל בוחר `subject` (נושא) + פירוט חופשי
  (רשות), `urgency=null`. **(ב) בקשה שנפתחה בדלפק** (`source='טלפון'`, `openStaffRequest`) — המזכירה מזינה
  מטופל + קטגוריה (→`subject`) + פירוט (→`description`) + דחיפות רשות. בלוח נבדלים **ויזואלית בלבד**: באדג׳
  מקור (`פנייה מהפורטל`/`נפתחה במשרד`), באדג׳ דחיפות (`דחוף`) וצ׳יפים לסינון (דחופות/חדשות). `urgency` = שתי
  רמות `רגיל`/`דחוף` (migrations 34–35). מקור הקביעה + זהות הקובע/ת של **תורים** (לא בקשות) מוצגים
  ב-`Calendar`/`VisitCard`.

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
    triage.js              קטגוריות + דחיפות משותפות (EscalationDialog + RequestRow + TasksBoard)
    format.js              עזרי תאריך/שעה בעברית
  components/
    ui.jsx                 Card, Badge, Button, Kpi, Avatar, Empty ...
    RequestRow.jsx         שורת פנייה (inquiry) בתור המזכירה — badge מקור (פורטל/משרד) + דחיפות + הרחבה/פתרון
    PatientPicker.jsx      בורר מטופל משותף (קיים/חדש) לטופסי המזכירה (QuickBook + Escalation)
    QuickBookDialog.jsx    קביעה ישירה בשיחה — מטופל→מטפל→טיפול→משבצת (זמינות חיה) → bookAppointmentByStaff
    EscalationDialog.jsx   פתיחת בקשה — מטופל + קטגוריה + דחיפות + פירוט → openStaffRequest (בקשה בתור המזכירה)
    AppointmentActions.jsx check-in/out (הגיע/סיום/לא הגיע), מוגן ב-role.canApprove
    clsx.js
  layouts/                 ClinicLayout (דסקטופ) · DoctorLayout (צפייה) · PatientLayout (רספונסיבי: טאבים במובייל / סרגל עליון בדסקטופ)
  pages/
    Login.jsx              שתי כניסות: צוות (3 תפקידים) · מטופל (רשום 'p1' / חדש null → setCurrentPatient)
    clinic/  Dashboard · Calendar · TasksBoard · Reports · Settings
    doctor/  DoctorDay · DoctorCalendar · VisitCard (תיק מטופל: סיבת הפנייה, **סיכום ביקור** לעריכה
             (clinical_note לביקור הנוכחי) — **פעיל רק כשסטטוס הביקור "הגיע"**, נעול לביקור עתידי/אחר,
             **היסטוריית ביקורים** חוצת-מטפלים — כל הסקשן מתקפל בכפתור chevron
             (מקופל כברירת מחדל), ובתוכו אקורדיון פר-ביקור עם סיכום קליני · תרופות)
    patient/ NewRequest (הזמנה עצמית רב-שלבית + "לא בטוח" + פרטי קשר/טלפון) · MyAppointments (ביטול/שינוי)
```

## תפקידים (`session.jsx` → `ROLES`)

| תפקיד | אזור | עיקר |
|-------|------|------|
| מזכירות (`secretary`) | `/clinic` | בקשות (חריגים), יומן, משימות, הגדרות · **ללא דוחות** |
| מנהל/ת (`manager`) | `/clinic` | הכל + דוחות |
| מטפל (`therapist`) | `/doctor` | יומן בצפייה · לוח המשימות שלו: יצירה/עדכון/**מחיקה** של המשימות שלו בלבד · תיק מטופל: סימון **הגיע/הסתיים** לביקור שלו + כתיבת **סיכום ביקור** (פעיל בסטטוס הגיע/הסתיים) (`therapistId: t1`) |
| מטופל (`patient`) | `/patient` | הזמנה עצמית + מעקב (רספונסיבי — מובייל ודסקטופ) |

`RequireRole` (`App.jsx`) חוסם גישה חוצת-אזור ומפנה ל-`role.home`. שתי כניסות נפרדות.

## פעולות ה-store (`store.jsx`)

- **הזמנה עצמית:** `bookAppointment({patientId,therapistId,treatmentId,start,reason})` — תור "קבוע" ישיר.
- **ביטול:** `cancelAppointment(id)` — מפנה את המשבצת.
- **קביעה ישירה בשיחה (מזכירה):** `bookAppointmentByStaff({patientId,therapistId,treatmentId,start,source,notify,notifyEmail})`
  — תור "קבוע" ישיר ב-`appointments` עם `source` (`טלפון`/`ביקור ללא תור`) ו-`created_by` (המזכירה),
  מפעיל תזכורת/אישור (`send-reminder`) ומציג את מודל אישור-ההזמנה המשותף.
- **פתיחת בקשה (מזכירה):** `openStaffRequest({patientId,category,description,urgency})` — בקשה
  `kind:'inquiry'` בסטטוס `ממתין` (`source:'טלפון'`); `subject`=קטגוריה, `urgency` שתי רמות רגיל/דחוף
  (migrations 34–35). נפתרת דרך `updateInquiry`/`convertInquiryToTask` כמו פניית פורטל.
- **פניות אנושיות ("לא בטוח/ה"):** `submitInquiry({patientId,subject,description})` יוצר `requests`
  עם `kind:'inquiry'` (ללא `ai`, סטטוס `ממתין`, `source:'פורטל'`). **שני מסלולי פתרון סופיים סותרים**
  (שניהם מסירים מהלוח): **(A) סגירה ישירה** — `updateInquiry(id,{status:'סגור',staffNote})` (ללא משימה);
  **(B) המרה למשימה** — `convertInquiryToTask(id)` יוצרת `tasks` בסטטוס `בטיפול` (אחראי null = "ללא שיוך
  (צוות המשרד / כללי)"), **מעבירה נתונים**: `subject`→`category`, `urgency`→`urgency`,
  `description`+`staff_note`→`note`, וכותרת = `subject` + שם המטופל; מקשרת דרך `requests.converted_task_id`
  ומעדכנת את הבקשה ל-`הומר למשימה`. הערה פנימית (`staff_note`) נשמרת **אוטומטית** (`updateRequestNote`, ללא
  כפתור, לא נראית למטופל).
- **שיקוף השלמת משימה למטופל:** מטופל לא רשאי לקרוא `tasks` (RLS), לכן סטטוס הבקשה הוא הערוץ היחיד שלו.
  `reflectConvertedTask` (נקרא מ-`setTaskStatus`/`restoreTask`) ממפה את מחזור-החיים של המשימה המקושרת חזרה
  לבקשה: משימה שהושלמה → `סגור`, משימה פעילה → `הומר למשימה`. פורטל המטופל (`MyAppointments`) מציג לפי
  סטטוס הבקשה: `הומר למשימה` → **"בטיפול הצוות"** (גלוי ברצף), `סגור` → **"טופל"** (ירוק, נשמר 48ש׳ מאז
  `updated_at` ואז יורד מהפיד).
- **ניהול טיפולים (Settings):** `addTreatment` / `updateTreatment` / `removeTreatment`.
- **צוות/מטפלים/מטופלים:** `addStaff`/`updateStaff`/`removeStaff`, `addTherapist`/`updateTherapist`, `addPatient`, `updatePatient`.
  **המטפל (`therapists`) הוא ישות הספק היחידה** — הזמנה, יומן, `treatment_providers` ולוגין המטפל תלויים בו; נוצר דרך `addTherapist` (הגדרות → מטפלים) והופך לניתן-להזמנה כששויך לו טיפול. רשומת `staff` היא **ספר משרד בלבד** (מזכירות/מנהל) ואינה מקושרת ל-`therapists`.
  **ארכיון מטפל (soft-delete):** מטפל עוזב מסומן `active:false` דרך `updateTherapist` (לא נמחק — `appointments.therapist_id` הוא ON DELETE RESTRICT וההיסטוריה נשמרת). `activeTherapists` (נגזר) מסנן את המוסתרים מהזמנה/יומן/בוררי המטפלים ומטבלת השיוך; `therapistById` נשאר מעל **כל** המטפלים כדי שתורים היסטוריים ימשיכו להיות מוצגים. שחזור = `active:true`. אותו דפוס כמו `treatments.active`.
- **מטופל מחובר:** `currentPatientId` (state) + `setCurrentPatient(id|null)` — נקבע בכניסת המטופל.
- **לוחות יומיים (Dashboard/DoctorDay):** תורי **היום שהסתיימו** נשארים גלויים כל היום בעיצוב **מעומעם**
  (opacity + badge) — רקורד ולא "לטיפול"; אינם נספרים ב"נותרו להיום". (תורי-עבר לא-סומנו עדיין הולכים לתור הסקירה.)
- **סטטוס/משימות:** `setAppointmentStatus` (role-aware: מטפל → RPC `set_appointment_status`, צוות → UPDATE ישיר;
  אי-הגעה → משימת פולו-אפ אוטומטית לפי `settings.followUpOnNoShow`),
  `bulkMarkNoShow(ids)` (סימון מרוכז של תורי-עבר שלא טופלו כ"לא הגיע", כל אחד מוליד משימת פולו-אפ),
  `saveClinicalNote(apptId, note)` (סיכום ביקור → `set_clinical_note` RPC), `setTaskStatus`, `addTask`, `updateTask`, `deleteTask`.
- **תורים שלא טופלו (unresolved past):** תור "קבוע" שהמשבצת שלו הסתיימה ולא סומן הגיע/לא-הגיע = מצב
  לא-פתור שמעוות דוחות. הזיהוי הוא **state נגזר** (`lib/appointments.js` → `isUnresolvedPast`/`selectUnresolved`),
  ללא מוטציה שקטה; הפתרון אנושי. **UX היברידי:** Dashboard מציג רק **KPI קומפקטי** עם המונה שמנווט
  ל-`/clinic/tasks` (`state.focus:'unresolved'`); **תור הסקירה המלא** — `UnresolvedAppointments.jsx`,
  **אקורדיון רך מתקפל** (מקופל כברירת מחדל; ניווט מה-KPI פותח אותו) עם שורות `AppointmentActions` + סימון-מרוכז —
  חי בלוח המשימות. Reports מציג הערת "נתונים חלקיים" כל עוד קיימים כאלה.
- **הגדרות:** `updateSettings` (`remindersEnabled`/`reminderHours`/`autoNoShow`/`noShowMinutes`/`followUpOnNoShow`)
  — משפיעות בפועל ברחבי האפליקציה.

## אוטומציות

- **אין AI בקליינט.** סיווג ה-AI (`classifyRequest`/`aiClassifier.js`) הוסר לחלוטין — הוא אינו חלק
  מאף מסלול (הזמנה עצמית, פניות אנושיות, שיחות טלפון) וגם לא משמש עוד לתצוגת תגיות בתיק המטופל
  (`VisitCard`/`DoctorDay`). כל הקביעות/הפניות נקבעות/נפתחות ידנית. (Edge function `classify-request`
  נותרה בשרת כשריד היסטורי ואינה נקראת מהקליינט.)
- **אוטומציות ב-`store.jsx`:** אי-הגעה יוצרת משימת פולו-אפ אוטומטית (`bulkMarkNoShow`/`setAppointmentStatus`).

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
  (שיוך מטפל-מטופל); מזכירה/מנהל→לפי `clinic_id`; דוחות→manager בלבד. **הרשמה עצמית של מטופל:** מטופל
  חדש (ללא רשומה) יוצר את רשומת ה-`patients` **של עצמו** בהזמנה הראשונה — policy `patients_insert_self`
  (`role='patient'` + `clinic_id` + `profile_id = auth.uid()`, migration 21) + אינדקס ייחודי חלקי על
  `profile_id` (רשומה אחת לכל לוגין). `addPatient` מטביע `profile_id = auth.uid()` רק בהרשמה עצמית (רשומות
  ספר-משרד של המזכירה נשארות `profile_id = null`), וה-store משרשר את insert התור/הבקשה **אחרי** שרשומת
  המטופל נשמרה (`afterPatientWrite`) כדי ש-`app.patient_id()` יפתור בבדיקת ה-RLS. **היסטוריית ביקורים:** מטפל
  רשאי לקרוא את **כל** התורים של מטופל שהוא מטפל בו (`app.therapist_treats_patient(patient_id)`, migration 13)
  — לתיק המטופל חוצה-המטפלים; מסכי היום/היומן שלו עדיין מסננים ל-`therapist_id` שלו ב-UI. התור נושא
  `clinical_note` (סיכום קליני שמוצג בהיסטוריה). מטפל מקדם את הביקור **שלו** ל-`הגיע`/`הסתיים` דרך RPC
  `set_appointment_status` (migration 15) וכותב את ה-`clinical_note` דרך RPC `set_clinical_note` (migration 14) —
  שניהם SECURITY DEFINER, מעדכנים רק את העמודה הרלוונטית ורק כשה-`therapist_id` שלו; ללא הרשאת UPDATE
  רחבה על appointments (סימון `לא הגיע` נשאר אצל המזכירה בלבד). עריכת הסיכום ב-UI פעילה רק בסטטוס הגיע/הסתיים. **משימות:** מטפל רשאי לקרוא/ליצור/לעדכן/**למחוק**
  רק את המשימות שלו — משויכות אליו (`assignee_id = app.therapist_id()`) או שיצר (`created_by = auth.uid()`);
  יצירה מוצמדת אליו כאחראי (migrations 12, 14).
- **Defense in depth:** הגנת ה-Frontend (Route Guards / הסתרת כפתורים) = UX בלבד; האכיפה המחייבת
  בשרת (JWT + RLS + Edge Functions). מפתחות סוד רק בשרת. עיקרון: *Never trust the client.*

**מסמך אפיון מלא:** `C:\קורס מיישם AI\פרוייקט גמר\MediTrack-מודל-אבטחה.docx` (Word RTL — 5 סעיפים
+ תרשים Security Flow; ממוקד Production עתידי).

## מוסכמות

- עברית + RTL בכל הממשק (`dir="rtl"` ב-`index.html`); טקסטים בקוד בעברית — לשמור.
- צבעים דרך טוקני Tailwind (`teal-*`, `ink-*`, `canvas`) — לא hex ישיר ב-JSX.
- **אזור זמן = שעון הקליניקה (Asia/Jerusalem), לא של הצופה:** כל הצגת תאריך/שעה עוברת דרך
  `lib/format.js` (`hhmm`/`dayName`/`shortDate`/`friendlyDate`) שמעצבים ב-Asia/Jerusalem דרך `Intl`
  (ללא `date-fns format`, שמשתמש ב-TZ של הדפדפן — היה מציג UTC על סביבה לא-ישראלית). קלט
  `datetime-local` (טופס משימות) עובר דרך `toClinicInput`/`clinicInputToDate` באותו אזור זמן, כך
  שהשעה שנשמרת/מוצגת עקבית בכל מכשיר.
- **נתונים מ-Supabase, סשן נשמר** — הסשן המאומת נשמר בין רענונים; `store.jsx` טוען מה-DB בכניסה (RLS-scoped)
  ומתמיד פעולות ברקע. דורש `.env` עם `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (ראו `.env.example`). ניווט דרך קישורי SPA.
- כל בעיה שנראית בדפדפן — לתקן בקוד המקור, לא ב-DevTools.
- **נראות פורטל המטופל (רספונסיבי, `PatientLayout.jsx`):** אותה כתובת, שתי פריסות לפי breakpoint `md`:
  - **מובייל (`<md`):** כותרת כהה למעלה + **טאבים תחתונים** (2 טאבים), תוכן במסך מלא.
  - **דסקטופ (`≥md`):** **סרגל ניווט עליון** (לוגו + ניווט אופקי + שלום/יציאה) ותוכן **ממורכז**
    ב-`max-w-3xl`. כרטיסי התורים ב-`MyAppointments` עוברים ל**רשת 2 טורים** (`sm:grid-cols-2`);
    טופס `NewRequest` מוגבל ל-`max-w-xl` כדי שלא יתמתח. **אין יותר מסגרת-טלפון.**
  צד הקליניקה/רופא (`ClinicLayout` סייד-בר ימני / `DoctorLayout`) נפרשים לרוחב דסקטופ מלא (עד 1400px).
