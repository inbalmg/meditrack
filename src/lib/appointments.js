// Derived appointment-status helpers — a single source of truth for the
// predicates that were previously inlined across screens. `appt.status` stays
// the real state; "unresolved past" is *computed*, never silently written, so
// an attendee who simply wasn't checked in is never auto-recorded as a no-show.

const MIN = 60000

// When the scheduled slot ends (start + duration).
export const apptEnd = (a) => a.start.getTime() + (a.durationMin ?? 0) * MIN

// Already handled: arrived-and-finished or marked no-show.
export const isTerminal = (a) => a.status === 'הסתיים' || a.status === 'לא הגיע'

// Past-but-unresolved: still 'קבוע' although its slot has fully ended, so no
// arrival/no-show was ever recorded. `now` accepts a Date or a timestamp.
export const isUnresolvedPast = (a, now = Date.now()) =>
  a.status === 'קבוע' && apptEnd(a) < (now instanceof Date ? now.getTime() : now)

// The unresolved-past queue, oldest-first so a backlog clears in order.
export const selectUnresolved = (appointments, now = Date.now()) =>
  appointments.filter((a) => isUnresolvedPast(a, now)).sort((a, b) => a.start - b.start)
