// Demo seed data for MediTrack Clinic.
// Single source of truth shared by every persona (clinic / therapist / patient).
// Dates are generated relative to "today" so the calendar always looks live.
//
// Product model: HYBRID self-booking for a TREATMENT clinic. The clinic defines
// treatments (name + duration + which providers give them); patients self-book
// (provider → treatment → slot). An AI "not sure?" path classifies free text into
// a suggested treatment + provider. Appointments carry both a `treatmentId` and a
// denormalized `visitType` string (= treatment name) so display-only screens keep
// working unchanged.

import {
  addDays,
  addHours,
  addMinutes,
  format,
  set,
  startOfWeek,
} from 'date-fns'

const today = new Date()
// Anchor the demo week to the current week (Sunday start, Israeli week).
const weekStart = startOfWeek(today, { weekStartsOn: 0 })

// חלון טיפול למשימה אוטומטית: כמה שעות אחרי הטריגר היא באמת "אמורה" להיסגר.
// משמש כדי שמשימה אוטומטית לא תיוולד עם `due` ברגע האירוע ותיצבע מיד "באיחור".
export const AUTO_TASK_DUE_HOURS = 3

function at(dayOffset, hour, minute = 0) {
  return set(addDays(weekStart, dayOffset), {
    hours: hour,
    minutes: minute,
    seconds: 0,
    milliseconds: 0,
  })
}

// --- Providers (a treatment clinic: physiotherapy + complementary medicine) ---
export const therapists = [
  { id: 't1', name: 'רועי שקד', specialty: 'פיזיותרפיה', color: '#0d9488', initials: 'רש' },
  { id: 't2', name: 'ד"ר דנה כהן', specialty: 'רפואה סינית ודיקור', color: '#2563eb', initials: 'דכ' },
  { id: 't3', name: 'מיכל לוי', specialty: 'רפלקסולוגיה ועיסוי רפואי', color: '#9333ea', initials: 'מל' },
]

// --- Treatments: name + duration + which providers offer them ---
// This is the heart of the self-booking model: the patient picks a provider,
// sees that provider's treatments (each with a fixed duration), and the chosen
// slot reserves exactly that length in the calendar.
export const treatments = [
  { id: 'tr1', name: 'פיזיותרפיה — הערכה ראשונית', durationMin: 45, therapistIds: ['t1'] },
  { id: 'tr2', name: 'פיזיותרפיה — טיפול המשך', durationMin: 30, therapistIds: ['t1'] },
  { id: 'tr3', name: 'דיקור סיני', durationMin: 30, therapistIds: ['t2'] },
  { id: 'tr4', name: 'ייעוץ רפואה סינית', durationMin: 30, therapistIds: ['t2'] },
  { id: 'tr5', name: 'עיסוי רפואי', durationMin: 45, therapistIds: ['t3'] },
  { id: 'tr6', name: 'רפלקסולוגיה', durationMin: 45, therapistIds: ['t3'] },
]

const treatmentByName = Object.fromEntries(treatments.map((t) => [t.name, t]))
const treatmentById = Object.fromEntries(treatments.map((t) => [t.id, t]))
export function treatmentsForTherapist(therapistId) {
  return treatments.filter((t) => t.therapistIds.includes(therapistId))
}

export const patients = [
  { id: 'p1', name: 'רותם ברק', phone: '050-1234567', age: 34, gender: 'נ' },
  { id: 'p2', name: 'אבי מזרחי', phone: '052-9876543', age: 58, gender: 'ז' },
  { id: 'p3', name: 'שירה גולן', phone: '054-5551212', age: 29, gender: 'נ' },
  { id: 'p4', name: 'נועם פרידמן', phone: '053-4448899', age: 41, gender: 'ז' },
  { id: 'p5', name: 'ליאור שמש', phone: '058-3332211', age: 45, gender: 'נ' },
  { id: 'p6', name: 'תמר אוחיון', phone: '050-7778866', age: 67, gender: 'נ' },
]

// The signed-in patient for the mobile portal demo.
export const currentPatientId = 'p1'

// Staff accounts (managed from the Settings screen). roleId matches ROLES keys.
export const seedStaff = [
  { id: 'u1', name: 'אורית שקד', roleId: 'manager' },
  { id: 'u2', name: 'רונית לוי', roleId: 'secretary' },
  { id: 'u3', name: 'רועי שקד', roleId: 'therapist' },
  { id: 'u4', name: 'מיכל לוי', roleId: 'therapist' },
]

// Backward-compatible: many screens still read a `visitType` string and iterate
// VISIT_TYPES. We derive both from the treatments list (the new source of truth).
export const VISIT_TYPES = treatments.map((t) => t.name)

// Short labels for tight spots (calendar blocks). Full name stays in tooltips.
export const VISIT_TYPE_SHORT = {
  'פיזיותרפיה — הערכה ראשונית': 'פיזיו·הערכה',
  'פיזיותרפיה — טיפול המשך': 'פיזיו·המשך',
  'דיקור סיני': 'דיקור',
  'ייעוץ רפואה סינית': 'ייעוץ סיני',
  'עיסוי רפואי': 'עיסוי',
  'רפלקסולוגיה': 'רפלקס׳',
}

// Appointment length by treatment name (drives the scheduling slot grid).
export function visitDuration(name) {
  return treatmentByName[name]?.durationMin ?? 30
}

// The patient's preferred time-of-day window → working-hour range [from, to).
// Used by the scheduling grid to highlight matching slots (09:00–18:00).
export const PREFERRED_WINDOWS = {
  'בוקר': [9, 12],
  'צהריים': [12, 14],
  'אחר הצהריים': [14, 18],
  'גמיש': [9, 18],
}

export const WORK_START_HOUR = 9
export const WORK_END_HOUR = 18

// Helper to build an appointment from a treatment (keeps therapist/treatment/
// duration consistent).
function appt(id, patientId, treatmentId, dayOffset, hour, minute, status, reason) {
  const tr = treatmentById[treatmentId]
  return {
    id,
    patientId,
    therapistId: tr.therapistIds[0],
    treatmentId,
    start: at(dayOffset, hour, minute),
    durationMin: tr.durationMin,
    visitType: tr.name, // denormalized for display-only screens
    status,
    reason,
  }
}

// --- The secretary's queue = EXCEPTIONS only (not every appointment). Most
// bookings are self-served and flow straight to the calendar. What lands here:
//   1. urgent AI referrals — the AI flagged the case, so it is NOT auto-booked;
//      a human triages and coordinates.
//   2. phone bookings — patients who called instead of self-serving.
export const seedRequests = [
  {
    id: 'r1', patientId: 'p4', createdAt: addMinutes(today, -25),
    description: 'כאב חד ופתאומי בגב אחרי נפילה, קשה מאוד לזוז ומחמיר',
    preferredTherapistId: null, visitTypeHint: null, preferredTime: 'בוקר',
    source: 'הפניה דחופה', status: 'ממתין',
  },
  {
    id: 'r2', patientId: 'p6', createdAt: addMinutes(today, -95),
    description: 'התקשרה לקבוע המשך סדרת טיפולי דיקור אצל ד"ר כהן',
    preferredTherapistId: 't2', visitTypeHint: 'דיקור סיני', preferredTime: 'אחר הצהריים',
    source: 'טלפון', status: 'ממתין',
  },
  {
    id: 'r3', patientId: 'p3', createdAt: addMinutes(today, -1440),
    description: 'מתח וכאבי צוואר — ה-AI הציע עיסוי רפואי',
    preferredTherapistId: 't3', visitTypeHint: 'עיסוי רפואי', preferredTime: 'גמיש',
    source: 'הפניה דחופה', status: 'אושר',
  },
]

// --- Scheduled appointments (the clinic calendar) ---
// status: קבוע / הגיע / הסתיים / לא הגיע
export const seedAppointments = [
  appt('a1', 'p2', 'tr2', 0, 9, 0, 'הסתיים', 'כאב גב כרוני — טיפול המשך'),
  appt('a2', 'p5', 'tr1', 0, 9, 30, 'הגיע', 'פציעת ברך מריצה — הערכה'),
  appt('a3', 'p6', 'tr3', 0, 11, 0, 'קבוע', 'סדרת דיקור לכאבי ראש'),
  appt('a4', 'p3', 'tr5', 0, 12, 0, 'קבוע', 'כאבי צוואר וכתפיים'),
  appt('a5', 'p1', 'tr2', 0, 14, 0, 'קבוע', 'שיקום גב תחתון'),
  appt('a6', 'p2', 'tr2', 1, 9, 0, 'קבוע', 'טיפול המשך'),
  appt('a7', 'p4', 'tr6', 1, 10, 0, 'קבוע', 'רפלקסולוגיה להרפיה'),
  appt('a8', 'p3', 'tr3', 2, 11, 30, 'קבוע', 'דיקור להפחתת מתח'),
  appt('a9', 'p6', 'tr1', 3, 9, 30, 'קבוע', 'הערכת כאב גב'),
  appt('a10', 'p1', 'tr5', 4, 13, 0, 'קבוע', 'עיסוי רפואי לגב'),
  appt('a11', 'p4', 'tr2', -3, 10, 0, 'לא הגיע', 'טיפול המשך'),
  // תורים עתידיים (עד ~4 חודשים קדימה) — מדגימים את אופק 6 החודשים בניווט היומן.
  appt('a12', 'p1', 'tr1', 14, 10, 0, 'קבוע', 'הערכת פיזיותרפיה — מעקב'),
  appt('a13', 'p3', 'tr3', 31, 11, 30, 'קבוע', 'סדרת דיקור — המשך'),
  appt('a14', 'p6', 'tr6', 73, 9, 30, 'קבוע', 'רפלקסולוגיה — תחזוקה'),
  appt('a15', 'p2', 'tr5', 115, 14, 0, 'קבוע', 'עיסוי רפואי — מעקב'),
  ...buildFillers(),
]

// Generate a believable, fuller week (~40 appointments/week) so the calendar and
// reports don't look empty. Deterministic — no RNG. Each row picks a treatment,
// and the provider is derived from it (kept consistent automatically).
function buildFillers() {
  // [dayOffset, hour, minute, patientId, treatmentId, status]
  const rows = [
    [0, 15, 0, 'p3', 'tr4', 'קבוע'], [0, 15, 30, 'p2', 'tr3', 'קבוע'],
    [0, 16, 0, 'p5', 'tr2', 'קבוע'], [0, 13, 0, 'p6', 'tr6', 'קבוע'],
    [1, 11, 0, 'p1', 'tr1', 'קבוע'], [1, 12, 0, 'p4', 'tr3', 'קבוע'],
    [1, 14, 0, 'p6', 'tr2', 'קבוע'], [1, 15, 0, 'p3', 'tr5', 'קבוע'],
    [1, 16, 30, 'p2', 'tr2', 'קבוע'],
    [2, 9, 0, 'p5', 'tr1', 'קבוע'], [2, 9, 0, 'p1', 'tr3', 'קבוע'], [2, 9, 30, 'p4', 'tr4', 'קבוע'],
    [2, 10, 30, 'p1', 'tr6', 'קבוע'], [2, 13, 0, 'p6', 'tr3', 'קבוע'],
    [2, 14, 30, 'p2', 'tr2', 'קבוע'], [2, 16, 0, 'p3', 'tr5', 'קבוע'],
    [3, 10, 30, 'p1', 'tr2', 'קבוע'], [3, 11, 0, 'p4', 'tr6', 'קבוע'],
    [3, 12, 0, 'p3', 'tr3', 'קבוע'], [3, 14, 0, 'p5', 'tr2', 'קבוע'],
    [3, 15, 30, 'p6', 'tr1', 'קבוע'],
    // 09:00 — שני תורים מקבילים (מטפלים שונים) כדי להדגים קיבוץ לפי שעה בלוח היום.
    [4, 9, 0, 'p2', 'tr2', 'קבוע'], [4, 9, 0, 'p4', 'tr5', 'קבוע'],
    [4, 10, 30, 'p3', 'tr3', 'קבוע'], [4, 11, 30, 'p1', 'tr2', 'קבוע'],
    [4, 15, 0, 'p6', 'tr2', 'קבוע'],
    // A couple of past days for a realistic (low) no-show rate.
    [-2, 9, 0, 'p2', 'tr2', 'הסתיים'], [-2, 10, 0, 'p5', 'tr1', 'הסתיים'],
    [-2, 11, 0, 'p4', 'tr6', 'הסתיים'], [-2, 12, 0, 'p3', 'tr3', 'הסתיים'],
    [-2, 14, 0, 'p6', 'tr2', 'הסתיים'], [-1, 9, 30, 'p1', 'tr5', 'הסתיים'],
    [-1, 10, 30, 'p4', 'tr6', 'הסתיים'], [-1, 11, 30, 'p2', 'tr2', 'הסתיים'],
    [-1, 13, 0, 'p3', 'tr3', 'לא הגיע'], [-1, 14, 30, 'p5', 'tr2', 'הסתיים'],
    [-1, 15, 30, 'p6', 'tr1', 'הסתיים'],
  ]
  return rows.map(([d, h, m, pid, trid, status], i) =>
    appt(`af${i + 1}`, pid, trid, d, h, m, status, treatmentById[trid].name),
  )
}

// --- Staff tasks (follow-ups) ---
// status: פתוח / בטיפול / הושלם
export const seedTasks = [
  // משימות אוטומטיות: due = חלון טיפול קדימה מ"עכשיו", כדי שלא ייטענו כ"באיחור" שגוי.
  // createdAt/sourceAt מעגנים כל משימה לרגע ההתרחשות (מוצג בשורה כ"מקור") — כדי ששעת
  // היעד לא תיראה מנותקת. אי-הגעה: sourceAt = שעת התור שלא הגיע (~שעה לפני עכשיו).
  { id: 'k1', title: 'פולו-אפ אי-הגעה — נועם פרידמן', patientId: 'p4', assigneeId: 't1', createdAt: addHours(today, -1), sourceAt: addHours(today, -1), due: addHours(today, AUTO_TASK_DUE_HOURS - 1), status: 'פתוח', source: 'אוטומציה', note: 'לא הגיע לטיפול המשך. ליצור קשר ולתאם מחדש.' },
  { id: 'k2', title: 'בקשת "לא בטוח" ממתינה — שירה גולן', patientId: 'p3', assigneeId: 't3', createdAt: addHours(today, -2), due: addHours(today, AUTO_TASK_DUE_HOURS + 2), status: 'בטיפול', source: 'אוטומציה', note: 'ה-AI הציע עיסוי רפואי — לאשר ולהציע מועד.' },
  // משימה ידנית שכבר עברה את זמנה — משאירה את מצב ה"באיחור" האדום מודגם במערכת.
  { id: 'k3', title: 'לחזור עם המלצת תרגילים — אבי מזרחי', patientId: 'p2', assigneeId: 't1', createdAt: addHours(today, -4), due: addHours(today, -3), status: 'בטיפול', source: 'ידני', note: 'להכין ולשלוח דף תרגילים לבית.' },
  { id: 'k4', title: 'תזכורת המשך סדרה — תמר אוחיון', patientId: 'p6', assigneeId: 't2', createdAt: addHours(today, -5), due: addHours(today, AUTO_TASK_DUE_HOURS + 4), status: 'פתוח', source: 'אוטומציה', note: 'לוודא קביעת הטיפול הבא בסדרת הדיקור.' },
]

// Helper: format for display
export { format }
