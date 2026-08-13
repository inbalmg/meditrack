import {
  addDays,
  addMonths,
  differenceInMinutes,
  format,
  isToday,
  isTomorrow,
  startOfDay,
  startOfWeek,
} from 'date-fns'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

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
  return format(d, 'HH:mm')
}

export function dayName(d) {
  return DAY_NAMES[d.getDay()]
}

export function shortDate(d) {
  return format(d, 'dd/MM')
}

export function friendlyDate(d) {
  if (isToday(d)) return 'היום'
  if (isTomorrow(d)) return 'מחר'
  return `יום ${dayName(d)} · ${shortDate(d)}`
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
