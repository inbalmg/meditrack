# MediTrack — שלב 4: סוכן AI פרונט-דסק (n8n)

שני workflows מוכנים לייבוא ל-n8n (Import from File):

| קובץ | מה זה |
|---|---|
| `meditrack-frontdesk-agent.json` | סוכן ה-AI: Chat Trigger → AI Agent (Gemini) → 5 Tools מול Supabase |
| `meditrack-escalation-telegram.json` | מקבל webbook מ-Supabase בעת אסקלציה ושולח Telegram למנהלת |

## תלות ב-DB (חובה לפני שהסוכן עובד)
הסוכן קורא ל-3 migrations שצריכים להיות מיושמים על פרויקט Supabase `nmiuydgwrogcqrpegdye`:
- `supabase/migrations/39_request_escalation.sql` — סטטוס `דרוש טיפול אנושי` + `escalation_reason`
- `supabase/migrations/40_agent_rpcs.sql` — RPC: `agent_create_inquiry`, `agent_escalate_inquiry`
- `supabase/migrations/41_notify_escalation.sql` — טריגר שמפעיל את ה-webhook של Telegram
- `supabase/seed_agent_test_tenant.sql` — קליניקת-בדיקה + מטופל-בדיקה מבודדים (בידוד ה-QA מהאפליקציה)

## הקמה — שלב אחר שלב

### 1. Credentials ב-n8n
- **Google Gemini (PaLM) API** — מפתח Gemini (אותו סוג מפתח כמו `GEMINI_API_KEY` שמשמש את `classify-request`).
  חבר/י לצומת `Google Gemini Chat Model` (מחליף את `REPLACE_GEMINI_CREDENTIAL_ID`).
- **Telegram Bot** — ה-bot token של שלב 3. חבר/י לצומת `Notify Manager (Telegram)`.
  עדכן/י את `chatId` (ברירת מחדל `6847779043` = ה-Chat של המנהלת, mock delivery משלב 3).

### 2. משתנה סביבה ל-n8n (המפתח לא נשמר ב-JSON מטעמי אבטחה)
הגדר/י ב-n8n את `SUPABASE_SERVICE_ROLE_KEY` = מפתח ה-service_role של הפרויקט.
כל 5 ה-Tools קוראים אותו דרך `{{ $env.SUPABASE_SERVICE_ROLE_KEY }}` בכותרות `apikey` + `Authorization`.
> עקרון least-privilege: הכתיבה מוגבלת ל-2 RPC בלבד (`agent_create_inquiry`/`agent_escalate_inquiry`),
> שאוכפים את הצורה ב-DB. לפרודקשן עדיף מפתח ייעודי מוגבל במקום service_role מלא.

### 3. חיבור טריגר האסקלציה ל-Telegram
- ייבא/י את `meditrack-escalation-telegram.json`, הפעל/י אותו (Active), והעתק/י את **Production Webhook URL**.
- שמור/י אותו כסוד ב-Supabase Vault כדי שטריגר ה-DB ידע לאן לפנות:
  ```sql
  select vault.create_secret('<n8n escalation webhook url>', 'n8n_escalation_webhook');
  ```
  כל עוד הסוד לא קיים — הטריגר הוא no-op (בטוח).

### 4. QA
- פתח/י את חלון הצ'אט של `meditrack-frontdesk-agent` (Chat Trigger).
- **הצלחה:** "כאב בגב תחתון אחרי אימון, לא בטוח מה מתאים" → הסוכן קורא ל-match_treatment וממליץ פיזיותרפיה.
- **אסקלציה (Red Team):** "תנו לי 50% הנחה או שאני עוזב, תעבירו אותי למנהל" → הסוכן פותח/מאתר פנייה,
  קורא ל-escalate_to_human → שורת `requests` קופצת ל-`דרוש טיפול אנושי` → Telegram נשלח.
- **בידוד נתונים (חובה):** הרץ/י קודם את `supabase/seed_agent_test_tenant.sql` — הוא יוצר קליניקת-בדיקה
  ומטופל-בדיקה מבודדים. כש-create_inquiry מבקש מזהה מטופל, השתמש/י תמיד במטופל-הבדיקה:
  `aaaaaaaa-0000-4000-8000-000000000002`. כך פניות ה-QA נכתבות בדייר נפרד ו-RLS מונע מהן להופיע
  באפליקציה ה-Deployed (אפס זכר לסוכן). ניקוי בסוף — ראו הערות בראש קובץ ה-seed.

## מבנה הסוכן
```
Chat Trigger → AI Agent (Gemini, System Prompt מלא)
                ├─ Memory: Window Buffer (לפי sessionId)
                └─ Tools: get_clinic_info · list_treatments · match_treatment
                          · create_inquiry · escalate_to_human
```
