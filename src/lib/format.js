import { format, isToday, isTomorrow, differenceInMinutes } from 'date-fns'

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

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
