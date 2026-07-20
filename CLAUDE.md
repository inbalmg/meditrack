# MediTrack Clinic

פרויקט גמר · קורס "מיישם AI" (יולי 2026). B2B SaaS לניהול תורים, בקשות ומשימות
עבור קליניקה רפואית קטנה — מחליף תיאום טלפוני ופתקים בתהליך דיגיטלי מקצה-לקצה, עם
סיווג בקשות אוטומטי (AI) ואוטומציות לתזכורות ומעקב.

> מסמך האפיון המלא: `C:\קורס מיישם AI\פרוייקט גמר\MediTrack-אפיון-מלא.pdf` (20 עמ').
> אפליקציית מטופלים קיימת (נספח, אב-טיפוס): `C:\AI_Projects\Med-Appt-Tracker`.

## מה זה

הדגמה קליקבילית (frontend-first) של המערכת, בעברית מלאה (RTL), בפלטת "טורקיז רפואי".
כל הנתונים הם **נתוני דמו בזיכרון** — אין backend. סיווג ה-AI רץ כרגע כלוגיקה
דטרמיניסטית (rule-based) בעלת אותו input/output schema של קריאת LLM אמיתית, כך שאפשר
להחליף אותה בקריאת API (למשל Claude) בלי לגעת ב-UI.

זהו "מסלול B" מהאפיון (React + נתונים), בגרסת דמו ללא Supabase/n8n בשלב זה.

## הרצה

```bash
npm install
npm run dev      # http://localhost:5180
npm run build    # בנייה לפרודקשן
```

הפעלה דרך Claude Code: preview_start עם `name: "meditrack"` (מוגדר ב-`C:\CLAUDE\.claude\launch.json`).

## סטאק

- **Vite 5** + **React 18** (JSX, ללא TypeScript)
- **Tailwind CSS v4** (דרך `@tailwindcss/vite`, טוקנים ב-`src/index.css` תחת `@theme`)
- **react-router-dom v6** · **lucide-react** (אייקונים) · **date-fns** (תאריכים)
- ללא ספריית רכיבים חיצונית — ערכת UI קטנה בסגנון shadcn נבנתה ידנית ב-`src/components/ui.jsx`

## ארכיטקטורה

```
src/
  main.jsx                 נקודת כניסה · עוטף ב-BrowserRouter + DataProvider
  App.jsx                  ניתוב + SessionProvider + RequireRole (הגנת אזורים לפי תפקיד)
  session.jsx              מצב התפקיד המחובר + מטריצת ההרשאות (ROLES)
  index.css                Tailwind v4 + טוקני עיצוב (טורקיז, ink, canvas)

  data/
    seed.js                נתוני דמו: מטפלים, מטופלים, בקשות, תורים, משימות (~40 תורים/שבוע)
    store.jsx              DataProvider — state מוטבל (כולל מטופלים) + פעולות (submitRequest, addPatient, אישור בקשה, סימון הגעה, משימות)
  lib/
    aiClassifier.js        classifyRequest() — סיווג דחיפות + סוג ביקור + ניתוב + תגיות
    format.js              עזרי תאריך/שעה בעברית (hhmm, friendlyDate, relativeFromNow)
  components/
    ui.jsx                 Card, Badge, Button, Kpi, Avatar, Empty ...
    RequestRow.jsx         שורת בקשה בטבלה (מטופל/סוג ביקור/התקבלה) + חץ הרחבה (גיל/טלפון/מלל/ניתוב/תגיות)
    AppointmentActions.jsx כפתורי check-in/out (הגיע/סיום/לא הגיע), מוגן ב-role.canApprove · prop `compact` (אייקונים בלבד)
    ScheduleDialog.jsx     בורר משבצות לקביעת תור (מטפל/תאריך/שעה, זמינות חיה)
    PhoneRequestDialog.jsx טופס קליטת בקשה טלפונית ע״י המזכירה (מטופל קיים/חדש → submitRequest + סיווג AI)
    clsx.js                מאחד classNames (ללא תלות)
  layouts/
    ClinicLayout.jsx       סייד-בר כהה (RTL) לצוות הקליניקה
    DoctorLayout.jsx       פריסת רופא — מצב צפייה בלבד
    PatientLayout.jsx      מסגרת מובייל לפורטל המטופל
  pages/
    Login.jsx              שתי כניסות (קליניקה / מטופל) + בחירת תפקיד
    clinic/  Dashboard · Calendar · TasksBoard · Reports · Settings
    doctor/  DoctorDay · DoctorCalendar · VisitCard
    patient/ NewRequest · MyAppointments
```

## פרסונות ותפקידים (`session.jsx` → `ROLES`)

| תפקיד | אזור | הרשאות עיקריות |
|-------|------|----------------|
| מזכירות (`secretary`) | `/clinic` | צינור הבקשות, יומן, משימות · אישור/דחייה · הגדרות · **ללא דוחות** |
| מנהל/ת (`manager`) | `/clinic` | הכל + דוחות ואנליטיקה |
| רופא/מטפל (`therapist`) | `/doctor` | צפייה בלבד · רק היומן והמשימות שלו (`therapistId: t1`) |
| מטופל (`patient`) | `/patient` | בקשת תור + מעקב (מובייל) |

`RequireRole` (ב-`App.jsx`) חוסם גישה חוצת-אזורים ומפנה ל-`role.home`. שתי כניסות
נפרדות — אין מסך משותף עם הרשאות (הפרדה ברמת הכניסה, כמו באפיון).

## 9 המסכים (מיפוי לאפיון)

**צד הקליניקה (דסקטופ):** מרכז פעילות (KPI + בקשות עם סיווג AI + תורי היום + משימות) ·
יומן שבועי (09:00–18:00, סינון לפי מטפל/סוג, ריבוי מטפלים זה לצד זה) · לוח משימות
(קנבן, תגית "אוטומציה") · דוחות ואנליטיקה (תפוסה, מגמת אי-הגעות, פילוח, סיכום AI).

**צד הרופא (צפייה בלבד):** היום שלי (כרטיס "התור הבא" עם תגיות AI) · היומן שלי (ללא
בורר מטפל) · כרטיס ביקור (סיבת פנייה, תגיות AI, היסטוריה ותרופות — לקריאה בלבד).

**צד המטופל (מובייל):** בקשת תור חדש (סוג ביקור/מטפל רשות + תיאור חופשי כקלט ל-AI) ·
התורים שלי (סטטוס בקשה אחרונה, תורים קרובים, תזכורות).

## AI ואוטומציות

- **`classifyRequest`** (`src/lib/aiClassifier.js`) מחזיר `{ urgency, urgencyScore,
  visitType, routedTo, tags, rationale }`. עקרון מפתח מהאפיון: **בחירת המטופל מנצחת** —
  אם המטופל בחר סוג ביקור/מטפל, ה-AI רק משלים חוסר; אחרת מסיק מהטקסט החופשי.
- **החלפה ל-LLM אמיתי:** להפוך את `classifyRequest` ל-async ולקרוא ל-API עם אותו schema.
- **אוטומציות מדומות** ב-`store.jsx`: אי-הגעה (`status = 'לא הגיע'`) יוצרת אוטומטית משימת
  פולו-אפ; אישור בקשה קובע תור ומנתב למטפל שה-AI בחר.
- **סימון הגעה/סיום/אי-הגעה** (`AppointmentActions`): המזכירה/מנהל מסמנים check-in ו-check-out
  מרשימת "תורי היום" (דשבורד) ומלחיצה על תור ביומן (מודל). לפי האפיון אי-הגעה אוטומטית
  אחרי X דק' — כאן ידני לדמו (עם tooltip מסביר). הרופא בצפייה בלבד (הרכיב מוגן ב-`role.canApprove`).
- **הגדרות** (`pages/clinic/Settings.jsx`, מזכירות+מנהל/ת דרך `role.canSettings`): כל ההגדרות
  יושבות ב-`store` ו**משפיעות בפועל** — `reminderHours`/`remindersEnabled` → טקסט התזכורת
  בפורטל המטופל; `noShowMinutes` → ה-tooltip של "לא הגיע"; `followUpOnNoShow` → האם
  `setAppointmentStatus` יוצר משימת פולו-אפ; `visitDurations` → אורך המשבצת ב-`ScheduleDialog`;
  עריכת מטפל (שם/צבע) → מתעדכנת חי ביומן ובכל האפליקציה. בנוסף: ניהול משתמשי צוות (`staff`).
- **קביעת תור באישור בקשה** (`ScheduleDialog`): לחיצה על "אישור וקביעת תור" פותחת בורר —
  מטפל (ברירת מחדל = ניתוב ה-AI), תאריך (מוצע לפי דחיפות, מדלג על ימים ללא זמינות),
  ומשבצת שעה מרשת 09:00–18:00 המחושבת חי מ-`appointments`: משבצות תפוסות חסומות (מונע
  כפל-הזמנה), והחלון המועדף של המטופל (`PREFERRED_WINDOWS`) מודגש. אישור קורא
  `approveRequest(id, slot)` — התור נוצר במשבצת שנבחרה.

## מוסכמות

- עברית + RTL בכל הממשק (`dir="rtl"` ב-`index.html`). טקסטים בקוד בעברית — לשמור על כך.
- צבעים דרך טוקני Tailwind (`teal-*`, `ink-*`, `canvas`) — לא hex ישיר ב-JSX.
- state הוא בזיכרון בלבד — **רענון דף מאפס את הסשן** (מנתק ומחזיר ל-login). זו התנהגות
  צפויה בדמו; ניווט אמיתי הוא דרך קישורי ה-in-app (SPA), לא הקלדת URL.
- כל בעיה שנראית בדפדפן: לתקן בקוד המקור ולא ב-DevTools.

## מצב

כל 9 המסכים נבנו ואומתו בדפדפן (הרשאות, סיווג AI, אישור בקשה, קנבן, טופס מטופל).
צעד הבא אפשרי: חיבור Supabase (מסלול B מלא) והחלפת הסיווג בקריאת Claude אמיתית.
