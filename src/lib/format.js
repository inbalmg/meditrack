import {
  addDays,
  addMonths,
  differenceInMinutes,
  startOfDay,
  startOfWeek,
} from 'date-fns'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

// This is a single-clinic Israeli app: all times are CLINIC time, not the viewer's.
// date-fns `format` renders in the viewer's local timezone, so an instant (e.g. an
// auto-created task's due/created_at) would show UTC on any non-Israel device. These
// helpers pin display + input to Asia/Jerusalem via Intl (no extra dependency), so the
// wall-clock shown is always Israel time regardless of where the app runs.
const CLINIC_TZ = 'Asia/Jerusalem'
const EN_DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

// Wall-clock parts of an instant, as seen in the clinic timezone (minute precision).
function clinicParts(d) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  }).formatToParts(d)
  const g = (t) => parts.find((p) => p.type === t)?.value
  return { year: +g('year'), month: +g('month'), day: +g('day'), hour: g('hour'), minute: g('minute'), weekday: g('weekday') }
}

// Comparable YYYYMMDD of an instant in the clinic timezone (for today/tomorrow labels).
const clinicYMD = (d) => { const p = clinicParts(d); return p.year * 10000 + p.month * 100 + p.day }

// כמה קדימה (וגם אחורה, ביומנים) מותר לנווט/לקבוע תורים.
export const BOOKING_HORIZON_MONTHS = 6

// תחילת השבוע הישראלי (ראשון) שמכיל את d.
export const weekStartOf = (d) => startOfWeek(d, { weekStartsOn: 0 })

// היום הראשון שניתן לקבוע בו תור: היום, או יום א׳–ה׳ הקרוב אם היום שישי/שבת.
export function firstBookingDay() {
  let d = startOfDay(new Date())
  while (d.getDay() > 4) d = addDays(d, 1) // 0=ראשון … 4=חמישי
  return d
}

// תחילת השבוע האחרון שאליו מותר לנווט קדימה (6 חודשים מהיום).
export const maxBookingWeekStart = () =>
  weekStartOf(addMonths(new Date(), BOOKING_HORIZON_MONTHS))

// ימי העבודה (א׳–ה׳) של שבוע נתון, לא לפני minDay (אם ניתן).
export function weekWorkingDays(weekStart, minDay) {
  const out = []
  for (let i = 0; i <= 4; i++) {
    const d = addDays(weekStart, i)
    if (!minDay || d >= minDay) out.push(d)
  }
  return out
}

export function hhmm(d) {
  const p = clinicParts(d)
  return `${p.hour}:${p.minute}`
}

export function dayName(d) {
  return DAY_NAMES[EN_DOW[clinicParts(d).weekday]]
}

export function shortDate(d) {
  const p = clinicParts(d)
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}`
}

export function friendlyDate(d) {
  const now = new Date()
  const target = clinicYMD(d)
  if (target === clinicYMD(now)) return 'היום'
  if (target === clinicYMD(new Date(now.getTime() + 86400000))) return 'מחר'
  return `יום ${dayName(d)} · ${shortDate(d)}`
}

// --- <input type="datetime-local"> <-> instant, pinned to the clinic timezone ---
// The task form edits a wall-clock time the clinic staff mean in Israel time. These keep
// the round-trip in Asia/Jerusalem so a task entered as 14:00 is stored/shown as 14:00
// Israel time on any device (mirrors the display helpers above).
function clinicOffsetMs(d) {
  const p = clinicParts(d)
  const wallAsUTC = Date.UTC(p.year, p.month - 1, p.day, +p.hour, +p.minute)
  return wallAsUTC - Math.floor(d.getTime() / 60000) * 60000
}

export function toClinicInput(d) {
  const p = clinicParts(d)
  const pad = (n) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${p.hour}:${p.minute}`
}

export function clinicInputToDate(str) {
  const asUTC = new Date(`${str}:00.000Z`)
  // Two passes so the offset is taken at the correct side of a DST boundary.
  let inst = new Date(asUTC.getTime() - clinicOffsetMs(asUTC))
  inst = new Date(asUTC.getTime() - clinicOffsetMs(inst))
  return inst
}

export function relativeFromNow(d) {
  const mins = differenceInMinutes(new Date(), d)
  if (mins < 1) return 'הרגע'
  if (mins < 60) return `לפני ${mins} דק׳`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `לפני ${hrs} שע׳`
  const days = Math.floor(hrs / 24)
  return `לפני ${days} ימים`
}

// Patient age derived from year of birth (year-based, matching the birth-year
// input). Returns null when unknown, so callers can render a blank gracefully.
export function ageFromBirthYear(birthYear) {
  if (!birthYear) return null
  return new Date().getFullYear() - birthYear
}

// Hebrew display labels for the canonical gender values (see lib/validation.js → GENDERS).
export const GENDER_LABELS = { male: 'זכר', female: 'נקבה', other: 'אחר' }
export function genderLabel(g) {
  return GENDER_LABELS[g] ?? ''
}
