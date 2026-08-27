// Derived appointment-status helpers — a single source of truth for the
// predicates that were previously inlined across screens. `appt.status` stays
// the real state; "unresolved past" is *computed*, never silently written, so
// an attendee who simply wasn't checked in is never auto-recorded as a no-show.

import { isClinicToday } from './format.js'

const MIN = 60000

const ts = (now) => (now instanceof Date ? now.getTime() : now)

// When the scheduled slot ends (start + duration).
export const apptEnd = (a) => a.start.getTime() + (a.durationMin ?? 0) * MIN

// Already handled: arrived-and-finished or marked no-show.
export const isTerminal = (a) => a.status === 'הסתיים' || a.status === 'לא הגיע'

// המשבצת הסתיימה אך התור עדיין 'קבוע' (לא עודכן הגעה/אי-הגעה) — הבסיס לשני המצבים למטה.
// `now` מקבל Date או timestamp. אין סימון אי-הגעה אוטומטי (ראו migration 11): תור עבר שלא-עודכן
// נשאר כזה עד שהמזכירה מטפלת בו ידנית — הזיהוי נגזר, ללא מוטציה שקטה.
export const isPastUnmarked = (a, now = Date.now()) =>
  a.status === 'קבוע' && apptEnd(a) < ts(now)

// מודל מבוסס-יום (במקום חלון חסד): "ממתין לעדכון" = תור של **היום** שהמשבצת שלו נגמרה וטרם עודכן —
// עדיין נספר, אך מטופל בלוח היום בדשבורד. המעבר ל"לא עודכן" קורה אוטומטית בחצות: ברגע שהיום מתחלף,
// התור כבר אינו של היום ולכן נגזר כ-isUnresolvedPast — ללא cron.
export const isAwaitingUpdate = (a, now = Date.now()) =>
  isPastUnmarked(a, now) && isClinicToday(a.start, now)

// "לא עודכן" = תור מ**יום קודם** (אתמול ואחורה) שלא עודכן — backlog אמיתי שמעוות דוחות. זה מה שנספר
// בדוחות / בתור הסקירה / בטבעת ביומן. תורי היום ("ממתין לעדכון") אינם כאן.
export const isUnresolvedPast = (a, now = Date.now()) =>
  isPastUnmarked(a, now) && !isClinicToday(a.start, now)

// תור הסקירה — תורי "לא עודכן" מימים קודמים בלבד, oldest-first כדי שה-backlog יתנקה לפי סדר.
export const selectUnresolved = (appointments, now = Date.now()) =>
  appointments.filter((a) => isUnresolvedPast(a, now)).sort((a, b) => a.start - b.start)

// חסימות: האם משבצת [startMs, endMs) חוסמת ע"י חסימה ידנית. חסימה כלל-קליניקה
// (therapistId=null) חוסמת כל מטפל; חסימה עם מטפל חוסמת רק אותו. משמש את יצירת
// המשבצות הפנויות (QuickBookDialog / NewRequest) לצד בדיקת התורים.
export function isSlotBlocked(blocks, therapistId, startMs, endMs) {
  return (blocks ?? []).some((b) => {
    if (b.therapistId && b.therapistId !== therapistId) return false
    const bStart = b.start.getTime()
    const bEnd = bStart + (b.durationMin ?? 0) * MIN
    return startMs < bEnd && endMs > bStart
  })
}
