// Demo seed data for MediTrack Clinic.
// Single source of truth shared by every persona (clinic / doctor / patient).
// Dates are generated relative to "today" so the calendar always looks live.

import {
  addDays,
  addMinutes,
  format,
  set,
  startOfWeek,
} from 'date-fns'

const today = new Date()
// Anchor the demo week to the current week (Sunday start, Israeli week).
const weekStart = startOfWeek(today, { weekStartsOn: 0 })

function at(dayOffset, hour, minute = 0) {
  return set(addDays(weekStart, dayOffset), {
    hours: hour,
    minutes: minute,
    seconds: 0,
    milliseconds: 0,
  })
}

export const therapists = [
  { id: 't1', name: 'ד"ר מאיה אבני', specialty: 'רפואת משפחה', color: '#0d9488', initials: 'מא' },
  { id: 't2', name: 'ד"ר יונתן לוי', specialty: 'רפואת ילדים', color: '#2563eb', initials: 'יל' },
  { id: 't3', name: 'ד"ר דנה כהן', specialty: 'עור', color: '#9333ea', initials: 'דכ' },
]

export const patients = [
  { id: 'p1', name: 'רותם ברק', phone: '050-1234567', age: 34, gender: 'נ' },
  { id: 'p2', name: 'אבי מזרחי', phone: '052-9876543', age: 58, gender: 'ז' },
  { id: 'p3', name: 'שירה גולן', phone: '054-5551212', age: 29, gender: 'נ' },
  { id: 'p4', name: 'נועם פרידמן', phone: '053-4448899', age: 3, gender: 'ז' },
  { id: 'p5', name: 'ליאור שמש', phone: '058-3332211', age: 45, gender: 'נ' },
  { id: 'p6', name: 'תמר אוחיון', phone: '050-7778866', age: 67, gender: 'נ' },
]

// The signed-in patient for the mobile portal demo.
export const currentPatientId = 'p1'

const VISIT_TYPES = [
  'בדיקה תקופתית',
  'מעקב / פולו-אפ',
  'חידוש מרשם',
  'ייעוץ',
  'בדיקה דחופה',
]

export { VISIT_TYPES }

// Short labels for tight spots (calendar blocks). Full label stays in tooltips.
export const VISIT_TYPE_SHORT = {
  'בדיקה תקופתית': 'תקופתית',
  'מעקב / פולו-אפ': 'מעקב',
  'חידוש מרשם': 'מרשם',
  'ייעוץ': 'ייעוץ',
  'בדיקה דחופה': 'דחופה',
}

// Appointment length by visit type — consultations / periodic checks run longer.
export function visitDuration(type) {
  return type === 'ייעוץ' || type === 'בדיקה תקופתית' ? 30 : 20
}

// The patient's preferred time-of-day window → working-hour range [from, to).
// Used by the scheduling dialog to highlight matching slots (09:00–18:00).
export const PREFERRED_WINDOWS = {
  'בוקר': [9, 12],
  'צהריים': [12, 14],
  'אחר הצהריים': [14, 18],
  'גמיש': [9, 18],
}

export const WORK_START_HOUR = 9
export const WORK_END_HOUR = 18

// --- Appointment requests (the intake pipeline) ---
export const seedRequests = [
  {
    id: 'r1',
    patientId: 'p4',
    createdAt: addMinutes(today, -25),
    description: 'הילד בן ה-3 עם חום גבוה מאתמול ולא נרגע, מודאגת מאוד',
    preferredTherapistId: null,
    visitTypeHint: null,
    preferredTime: 'בוקר',
    status: 'ממתין', // ממתין / אושר / נדחה
  },
  {
    id: 'r2',
    patientId: 'p3',
    createdAt: addMinutes(today, -90),
    description: 'פריחה אדומה בעור היד שלא עוברת כבר שבוע, מגרד',
    preferredTherapistId: null,
    visitTypeHint: null,
    preferredTime: 'אחר הצהריים',
    status: 'ממתין',
  },
  {
    id: 'r3',
    patientId: 'p2',
    createdAt: addMinutes(today, -180),
    description: 'צריך לחדש מרשם לתרופת לחץ דם, נגמרה לי',
    preferredTherapistId: 't1',
    visitTypeHint: 'חידוש מרשם',
    preferredTime: 'גמיש',
    status: 'ממתין',
  },
  {
    id: 'r4',
    patientId: 'p5',
    createdAt: addMinutes(today, -300),
    description: 'רוצה לקבוע בדיקה שנתית שגרתית',
    preferredTherapistId: 't1',
    visitTypeHint: 'בדיקה תקופתית',
    preferredTime: 'בוקר',
    status: 'ממתין',
  },
  {
    id: 'r5',
    patientId: 'p6',
    createdAt: addMinutes(today, -1440),
    description: 'מעקב אחרי בדיקות הדם מהחודש שעבר',
    preferredTherapistId: 't1',
    visitTypeHint: 'מעקב / פולו-אפ',
    preferredTime: 'אחר הצהריים',
    status: 'אושר',
  },
]

// --- Scheduled appointments (the clinic calendar) ---
// status: קבוע / הגיע / הסתיים / לא הגיע
export const seedAppointments = [
  { id: 'a1', patientId: 'p2', therapistId: 't1', start: at(0, 9, 0), durationMin: 20, visitType: 'חידוש מרשם', status: 'הסתיים', reason: 'חידוש מרשם ללחץ דם' },
  { id: 'a2', patientId: 'p5', therapistId: 't1', start: at(0, 9, 30), durationMin: 30, visitType: 'בדיקה תקופתית', status: 'הגיע', reason: 'בדיקה שנתית שגרתית' },
  { id: 'a3', patientId: 'p6', therapistId: 't1', start: at(0, 10, 30), durationMin: 20, visitType: 'מעקב / פולו-אפ', status: 'קבוע', reason: 'מעקב בדיקות דם' },
  { id: 'a4', patientId: 'p4', therapistId: 't2', start: at(0, 11, 0), durationMin: 20, visitType: 'בדיקה דחופה', status: 'קבוע', reason: 'חום גבוה אצל פעוט' },
  { id: 'a5', patientId: 'p3', therapistId: 't3', start: at(0, 12, 0), durationMin: 30, visitType: 'ייעוץ', status: 'קבוע', reason: 'פריחה בעור' },
  { id: 'a6', patientId: 'p1', therapistId: 't1', start: at(0, 14, 0), durationMin: 20, visitType: 'ייעוץ', status: 'קבוע', reason: 'כאבי גב' },
  { id: 'a7', patientId: 'p2', therapistId: 't1', start: at(1, 9, 0), durationMin: 20, visitType: 'מעקב / פולו-אפ', status: 'קבוע', reason: 'מעקב' },
  { id: 'a8', patientId: 'p5', therapistId: 't2', start: at(1, 10, 0), durationMin: 30, visitType: 'ייעוץ', status: 'קבוע', reason: 'ייעוץ' },
  { id: 'a9', patientId: 'p3', therapistId: 't3', start: at(2, 11, 30), durationMin: 30, visitType: 'מעקב / פולו-אפ', status: 'קבוע', reason: 'מעקב עור' },
  { id: 'a10', patientId: 'p6', therapistId: 't1', start: at(3, 9, 30), durationMin: 20, visitType: 'בדיקה תקופתית', status: 'קבוע', reason: 'בדיקה תקופתית' },
  { id: 'a11', patientId: 'p1', therapistId: 't1', start: at(4, 13, 0), durationMin: 20, visitType: 'חידוש מרשם', status: 'קבוע', reason: 'חידוש מרשם' },
  { id: 'a12', patientId: 'p4', therapistId: 't2', start: at(-3, 10, 0), durationMin: 20, visitType: 'בדיקה דחופה', status: 'לא הגיע', reason: 'חום' },
  ...buildFillers(),
]

// Generate a believable, fuller week (~40 appointments/week, per the spec's
// scale) so the calendar and reports don't look empty. Deterministic — no RNG.
function buildFillers() {
  const reasons = {
    'בדיקה תקופתית': 'בדיקה תקופתית',
    'מעקב / פולו-אפ': 'מעקב שגרתי',
    'חידוש מרשם': 'חידוש מרשם',
    'ייעוץ': 'ייעוץ כללי',
    'בדיקה דחופה': 'בדיקה דחופה',
  }
  const types = Object.keys(reasons)
  // [dayOffset, hour, minute, therapistId, patientId, typeIndex, status]
  const rows = [
    [0, 15, 0, 't1', 'p3', 1, 'קבוע'], [0, 15, 30, 't2', 'p2', 3, 'קבוע'],
    [0, 16, 0, 't1', 'p5', 0, 'קבוע'], [0, 13, 0, 't3', 'p6', 3, 'קבוע'],
    [1, 11, 0, 't1', 'p1', 2, 'קבוע'], [1, 12, 0, 't3', 'p4', 3, 'קבוע'],
    [1, 14, 0, 't1', 'p6', 1, 'קבוע'], [1, 15, 0, 't2', 'p3', 4, 'קבוע'],
    [1, 16, 30, 't1', 'p2', 2, 'קבוע'],
    [2, 9, 0, 't1', 'p5', 0, 'קבוע'], [2, 9, 30, 't2', 'p4', 4, 'קבוע'],
    [2, 10, 0, 't1', 'p1', 3, 'קבוע'], [2, 13, 0, 't3', 'p6', 1, 'קבוע'],
    [2, 14, 30, 't1', 'p2', 1, 'קבוע'], [2, 16, 0, 't2', 'p3', 3, 'קבוע'],
    [3, 10, 30, 't1', 'p1', 2, 'קבוע'], [3, 11, 0, 't2', 'p4', 4, 'קבוע'],
    [3, 12, 0, 't3', 'p3', 3, 'קבוע'], [3, 14, 0, 't1', 'p5', 1, 'קבוע'],
    [3, 15, 30, 't1', 'p6', 0, 'קבוע'],
    [4, 9, 0, 't1', 'p2', 2, 'קבוע'], [4, 9, 30, 't2', 'p4', 3, 'קבוע'],
    [4, 10, 30, 't3', 'p3', 3, 'קבוע'], [4, 11, 30, 't1', 'p1', 1, 'קבוע'],
    [4, 15, 0, 't1', 'p6', 1, 'קבוע'],
    // A couple of past days for a realistic (low) no-show rate.
    [-2, 9, 0, 't1', 'p2', 2, 'הסתיים'], [-2, 10, 0, 't1', 'p5', 0, 'הסתיים'],
    [-2, 11, 0, 't2', 'p4', 4, 'הסתיים'], [-2, 12, 0, 't3', 'p3', 3, 'הסתיים'],
    [-2, 14, 0, 't1', 'p6', 1, 'הסתיים'], [-1, 9, 30, 't1', 'p1', 3, 'הסתיים'],
    [-1, 10, 30, 't2', 'p4', 4, 'הסתיים'], [-1, 11, 30, 't1', 'p2', 2, 'הסתיים'],
    [-1, 13, 0, 't3', 'p3', 3, 'לא הגיע'], [-1, 14, 30, 't1', 'p5', 1, 'הסתיים'],
    [-1, 15, 30, 't1', 'p6', 0, 'הסתיים'],
  ]
  return rows.map(([d, h, m, tid, pid, ti, status], i) => {
    const type = types[ti]
    return {
      id: `af${i + 1}`,
      patientId: pid,
      therapistId: tid,
      start: at(d, h, m),
      durationMin: visitDuration(type),
      visitType: type,
      status,
      reason: reasons[type],
    }
  })
}

// --- Staff tasks (follow-ups) ---
// status: פתוח / בטיפול / הושלם
export const seedTasks = [
  { id: 'k1', title: 'פולו-אפ אי-הגעה — נועם פרידמן', patientId: 'p4', assigneeId: 't2', due: at(0, 12, 0), status: 'פתוח', source: 'אוטומציה', note: 'המטופל לא הגיע לתור. ליצור קשר ולתאם מחדש.' },
  { id: 'k2', title: 'לשלוח תוצאות בדיקות דם — תמר אוחיון', patientId: 'p6', assigneeId: 't1', due: at(0, 16, 0), status: 'בטיפול', source: 'ידני', note: 'להעביר תוצאות ולסמן במערכת.' },
  { id: 'k3', title: 'חידוש מרשם — אבי מזרחי', patientId: 'p2', assigneeId: 't1', due: at(1, 10, 0), status: 'הושלם', source: 'ידני', note: 'מרשם חודש ונשלח.' },
  { id: 'k4', title: 'תזכורת פולו-אפ תוצאות — שירה גולן', patientId: 'p3', assigneeId: 't3', due: at(2, 14, 0), status: 'פתוח', source: 'אוטומציה', note: 'לבדוק חזרה לגבי הפריחה בעוד שבוע.' },
]

// Helper: format for display
export { format }
