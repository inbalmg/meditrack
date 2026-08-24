// --- Task "overdue" (באיחור) rule — single source of truth ---
//
// A task is overdue when it isn't done yet AND its due time has already passed.
// By default the flag flips the instant `due` slips into the past, but the clinic
// can widen a grace window in Settings (`overdueGraceHours`) so a task isn't
// painted red the moment its deadline ticks over — only once it's late by more
// than the configured number of hours. Grace 0 = the original instant behavior.
//
// This is a DERIVED state (see lib/useNow.js) — nothing mutates the task; every
// call site just recomputes against the live `now`.

// Grace window in milliseconds, clamped to a non-negative number.
export function overdueGraceMs(settings) {
  return Math.max(0, Number(settings?.overdueGraceHours) || 0) * 3_600_000
}

// True when `task` counts as overdue relative to `now` under the clinic's grace.
// `now` may be a Date or a timestamp; `task.due` is a Date. When overdue flagging
// is turned off in Settings (overdueEnabled=false), nothing is ever overdue.
export function isTaskOverdue(task, now, settings) {
  if (settings?.overdueEnabled === false) return false
  return task.due.getTime() + overdueGraceMs(settings) < now
}
