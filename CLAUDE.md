# MediTrack Clinic

פרויקט גמר · קורס "מיישם AI" (2026). דמו קליקבילי (frontend-first) בעברית מלאה (RTL)
של מערכת לניהול **קליניקת טיפולים** קטנה (פיזיותרפיה ורפואה משלימה) — הזמנת תורים,
בקשות ומשימות. מחליף תיאום טלפוני ופתקים בתהליך דיגיטלי מקצה-לקצה.

> אפיון מלא + מסמכי ההגשה (PDF/DOCX) ותרשימי הזרימה AS-IS/TO-BE (Whimsical):
> `C:\קורס מיישם AI\פרוייקט גמר\`.

## מודל המוצר — הזמנה עצמית היברידית

הלב של המערכת (מתועד גם בראש `src/data/seed.js`):

- הקליניקה מגדירה **טיפולים** (`treatments`): שם + משך + אילו מטפלים נותנים אותם.
- **מסלול ראשי — הזמנה עצמית:** המטופל בוחר מטפל → טיפול → משבצת פנויה, והתור נקבע
  ישירות (`bookAppointment`, סטטוס "קבוע", **ללא אישור מזכירה**). אורך המשבצת = משך הטיפול.
- **מסלול משני — "לא בטוח/ה":** תיאור חופשי → `classifyRequest` מציע טיפול+מטפל ומרים
  **דגל דחיפות** (safety-net). בקשה כזו נכנסת ל-`submitRequest` וממתינה לאישור אנושי.
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
  layouts/                 ClinicLayout (דסקטופ) · DoctorLayout (צפייה) · PatientLayout (מובייל)
  pages/
    Login.jsx              שתי כניסות (קליניקה / מטופל) + בחירת תפקיד
    clinic/  Dashboard · Calendar · TasksBoard · Reports · Settings
    doctor/  DoctorDay · DoctorCalendar · VisitCard   (צפייה בלבד)
    patient/ NewRequest (הזמנה עצמית רב-שלבית + מסלול "לא בטוח") · MyAppointments (כולל ביטול/שינוי)
```

## תפקידים (`session.jsx` → `ROLES`)

| תפקיד | אזור | עיקר |
|-------|------|------|
| מזכירות (`secretary`) | `/clinic` | בקשות (חריגים), יומן, משימות, הגדרות · **ללא דוחות** |
| מנהל/ת (`manager`) | `/clinic` | הכל + דוחות |
| מטפל (`therapist`) | `/doctor` | צפייה בלבד · רק היומן/המשימות שלו (`therapistId: t1`) |
| מטופל (`patient`) | `/patient` | הזמנה עצמית + מעקב (מובייל) |

`RequireRole` (`App.jsx`) חוסם גישה חוצת-אזור ומפנה ל-`role.home`. שתי כניסות נפרדות.

## פעולות ה-store (`store.jsx`)

- **הזמנה עצמית:** `bookAppointment({patientId,therapistId,treatmentId,start,reason})` — תור "קבוע" ישיר.
- **ביטול:** `cancelAppointment(id)` — מפנה את המשבצת.
- **מסלול AI:** `submitRequest({...,source})` → `approveRequest(id, slot)` / `rejectRequest(id)`.
- **ניהול טיפולים (Settings):** `addTreatment` / `updateTreatment` / `removeTreatment`.
- **צוות/מטפלים/מטופלים:** `addStaff`/`updateStaff`/`removeStaff`, `updateTherapist`, `addPatient`.
- **סטטוס/משימות:** `setAppointmentStatus` (אי-הגעה → משימת פולו-אפ אוטומטית לפי `settings.followUpOnNoShow`),
  `setTaskStatus`, `addTask`.
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

## מוסכמות

- עברית + RTL בכל הממשק (`dir="rtl"` ב-`index.html`); טקסטים בקוד בעברית — לשמור.
- צבעים דרך טוקני Tailwind (`teal-*`, `ink-*`, `canvas`) — לא hex ישיר ב-JSX.
- **state בזיכרון בלבד** — רענון דף מאפס את הסשן (מחזיר ל-login). ניווט אמיתי דרך קישורי SPA, לא URL.
- כל בעיה שנראית בדפדפן — לתקן בקוד המקור, לא ב-DevTools.
