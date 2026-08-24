-- MediTrack — demo seed for ONE clinic (translated from src/data/seed.js).
-- IDs are resolved by natural key (name) inside a single WITH chain — no hardcoded
-- UUIDs. Appointment/task/request times are generated relative to now() so the
-- calendar looks live, mirroring the seed.js anchoring to the current (Sunday) week.
-- NOTE: the requests queue holds human inquiries only (kind='inquiry'); phone calls are
-- handled directly by the desk (Direct Booking / Escalation). profiles are created by Auth.
--
-- Idempotency: run against an empty schema. Re-running appends a second clinic.

with
c as (
  insert into public.clinics (name)
  values ('קליניקת MediTrack')
  returning id
),
th as (
  insert into public.therapists (clinic_id, name, specialty, color, initials)
  select c.id, x.name, x.specialty, x.color, x.initials
  from c, (values
    ('רועי שקד',    'פיזיותרפיה',                 '#0d9488', 'רש'),
    ('ד"ר דנה כהן', 'רפואה סינית ודיקור',          '#2563eb', 'דכ'),
    ('מיכל לוי',    'רפלקסולוגיה ועיסוי רפואי',    '#9333ea', 'מל')
  ) as x(name, specialty, color, initials)
  returning id, name
),
tr as (
  insert into public.treatments (clinic_id, name, duration_min)
  select c.id, x.name, x.dur
  from c, (values
    ('פיזיותרפיה — הערכה ראשונית', 45),
    ('פיזיותרפיה — טיפול המשך',    30),
    ('דיקור סיני',                 30),
    ('ייעוץ רפואה סינית',          30),
    ('עיסוי רפואי',                45),
    ('רפלקסולוגיה',                45)
  ) as x(name, dur)
  returning id, name, duration_min
),
-- treatment -> its (single) provider, resolved by name.
prov as (
  select tr.id as treatment_id, tr.name as tname, th.id as therapist_id, th.name as thname
  from (values
    ('פיזיותרפיה — הערכה ראשונית', 'רועי שקד'),
    ('פיזיותרפיה — טיפול המשך',    'רועי שקד'),
    ('דיקור סיני',                 'ד"ר דנה כהן'),
    ('ייעוץ רפואה סינית',          'ד"ר דנה כהן'),
    ('עיסוי רפואי',                'מיכל לוי'),
    ('רפלקסולוגיה',                'מיכל לוי')
  ) as m(tname, thname)
  join tr on tr.name = m.tname
  join th on th.name = m.thname
),
tp as (
  insert into public.treatment_providers (treatment_id, therapist_id, clinic_id)
  select prov.treatment_id, prov.therapist_id, (select id from c)
  from prov
  returning 1
),
pt as (
  insert into public.patients (clinic_id, name, phone, birth_year, gender)
  select c.id, x.name, x.phone, x.birth_year, x.gender
  from c, (values
    ('רותם ברק',    '050-1234567', 1992, 'female'),
    ('אבי מזרחי',   '052-9876543', 1968, 'male'),
    ('שירה גולן',   '054-5551212', 1997, 'female'),
    ('נועם פרידמן', '053-4448899', 1985, 'male'),
    ('ליאור שמש',   '058-3332211', 1981, 'female'),
    ('תמר אוחיון',  '050-7778866', 1959, 'female')
  ) as x(name, phone, birth_year, gender)
  returning id, name
),
-- Named appointments a1..a15 (span past / this week / up to ~4 months out).
-- Provider is derived from the treatment, keeping therapist/treatment consistent.
appt as (
  insert into public.appointments
    (clinic_id, patient_id, therapist_id, treatment_id, start, duration_min, visit_type, status, reason, source)
  select (select id from c), pt.id, prov.therapist_id, tr.id,
         -- Intended wall-clock is Israel local; interpret it AT TIME ZONE 'Asia/Jerusalem'
         -- so the stored UTC instant renders at the right local hour in the browser.
         ((k.ws + a.d) + make_time(a.h, a.m, 0)) at time zone 'Asia/Jerusalem',
         tr.duration_min, tr.name, a.status, a.reason, 'הזמנה עצמית'
  from (select (date_trunc('week', now() at time zone 'Asia/Jerusalem')::date - 1) as ws) k
  cross join (values
    (0,   9,  0, 'אבי מזרחי',   'פיזיותרפיה — טיפול המשך',    'הסתיים', 'כאב גב כרוני — טיפול המשך'),
    (0,   9, 30, 'ליאור שמש',   'פיזיותרפיה — הערכה ראשונית', 'הגיע',   'פציעת ברך מריצה — הערכה'),
    (0,  11,  0, 'תמר אוחיון',  'דיקור סיני',                 'קבוע',   'סדרת דיקור לכאבי ראש'),
    (0,  12,  0, 'שירה גולן',   'עיסוי רפואי',                'קבוע',   'כאבי צוואר וכתפיים'),
    (0,  14,  0, 'רותם ברק',    'פיזיותרפיה — טיפול המשך',    'קבוע',   'שיקום גב תחתון'),
    (1,   9,  0, 'אבי מזרחי',   'פיזיותרפיה — טיפול המשך',    'קבוע',   'טיפול המשך'),
    (1,  10,  0, 'נועם פרידמן', 'רפלקסולוגיה',                'קבוע',   'רפלקסולוגיה להרפיה'),
    (2,  11, 30, 'שירה גולן',   'דיקור סיני',                 'קבוע',   'דיקור להפחתת מתח'),
    (3,   9, 30, 'תמר אוחיון',  'פיזיותרפיה — הערכה ראשונית', 'קבוע',   'הערכת כאב גב'),
    (4,  13,  0, 'רותם ברק',    'עיסוי רפואי',                'קבוע',   'עיסוי רפואי לגב'),
    (-3, 10,  0, 'נועם פרידמן', 'פיזיותרפיה — טיפול המשך',    'לא הגיע', 'טיפול המשך'),
    (14, 10,  0, 'רותם ברק',    'פיזיותרפיה — הערכה ראשונית', 'קבוע',   'הערכת פיזיותרפיה — מעקב'),
    (31, 11, 30, 'שירה גולן',   'דיקור סיני',                 'קבוע',   'סדרת דיקור — המשך'),
    (73,  9, 30, 'תמר אוחיון',  'רפלקסולוגיה',                'קבוע',   'רפלקסולוגיה — תחזוקה'),
    (115,14,  0, 'אבי מזרחי',   'עיסוי רפואי',                'קבוע',   'עיסוי רפואי — מעקב')
  ) as a(d, h, m, pname, tname, status, reason)
  join pt   on pt.name   = a.pname
  join tr   on tr.name   = a.tname
  join prov on prov.tname = a.tname
  returning 1
),
-- Secretary queue = human inquiries only (kind='inquiry') from the patient portal. Phone
-- calls are handled directly (Direct Booking / Escalation), never through this queue.
req as (
  insert into public.requests
    (clinic_id, patient_id, kind, subject, description, source, status, created_at)
  select (select id from c), pt.id, 'inquiry', r.subject, r.description, 'פורטל', r.status,
         now() - (r.mins || ' minutes')::interval
  from (values
    ('שירה גולן', 'אדמיניסטרציה', 'קיבלתי כמה טיפולים החודש — אפשר קבלה מרוכזת להחזר מקופת חולים?', 'ממתין', 14)
  ) as r(pname, subject, description, status, mins)
  join pt on pt.name = r.pname
  returning 1
),
-- Staff tasks (follow-ups). due_h/src_at_h are hours relative to now().
tsk as (
  insert into public.tasks
    (clinic_id, title, patient_id, assignee_id, source_at, due, status, source, note)
  select (select id from c), t.title, pt.id, ta.id,
         case when t.src_at_h is null then null
              else now() + (t.src_at_h || ' hours')::interval end,
         now() + (t.due_h || ' hours')::interval,
         t.status, t.source, t.note
  from (values
    ('פולו-אפ אי-הגעה — נועם פרידמן',      'נועם פרידמן', 'רועי שקד',    -1,   2, 'פתוח',  'אוטומציה', 'לא הגיע לטיפול המשך. ליצור קשר ולתאם מחדש.'),
    ('בקשת "לא בטוח" ממתינה — שירה גולן',  'שירה גולן',   'מיכל לוי',    NULL, 5, 'בטיפול', 'אוטומציה', 'ה-AI הציע עיסוי רפואי — לאשר ולהציע מועד.'),
    ('לחזור עם המלצת תרגילים — אבי מזרחי', 'אבי מזרחי',   'רועי שקד',    NULL, -3, 'בטיפול', 'ידני',     'להכין ולשלוח דף תרגילים לבית.'),
    ('תזכורת המשך סדרה — תמר אוחיון',      'תמר אוחיון',  'ד"ר דנה כהן', NULL, 7, 'פתוח',  'אוטומציה', 'לוודא קביעת הטיפול הבא בסדרת הדיקור.')
  ) as t(title, pname, thname, src_at_h, due_h, status, source, note)
  join pt on pt.name = t.pname
  join th ta on ta.name = t.thname
  returning 1
)
select
  (select count(*) from c)    as clinics,
  (select count(*) from th)   as therapists,
  (select count(*) from tr)   as treatments,
  (select count(*) from tp)   as treatment_providers,
  (select count(*) from pt)   as patients,
  (select count(*) from appt) as appointments,
  (select count(*) from req)  as requests,
  (select count(*) from tsk)  as tasks;
