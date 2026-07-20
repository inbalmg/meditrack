import { useMemo, useState } from 'react'
import { addDays, isSameDay, set, startOfDay } from 'date-fns'
import { X, Sparkles, CalendarDays, Clock, Check, Route } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { Card, Badge, Button, Avatar } from './ui.jsx'
import { clsx } from './clsx.js'
import { dayName, shortDate, hhmm } from '../lib/format.js'
import {
  PREFERRED_WINDOWS,
  WORK_START_HOUR,
  WORK_END_HOUR,
} from '../data/seed.js'

const URGENCY_TONE = { 'דחוף': 'red', 'בהקדם': 'amber', 'רגיל': 'teal' }
// How soon to suggest the appointment, by AI urgency (index into working days).
const URGENCY_DATE_OFFSET = { 'דחוף': 0, 'בהקדם': 1, 'רגיל': 2 }

// The next N working days (Sun–Thu), starting today.
function upcomingWorkingDays(n = 6) {
  const days = []
  let d = startOfDay(new Date())
  while (days.length < n) {
    if (d.getDay() <= 4) days.push(d) // 0=Sun … 4=Thu
    d = addDays(d, 1)
  }
  return days
}

// The scheduling flow: the secretary picks the therapist, date and an available
// slot. Availability is computed live from existing appointments so a therapist
// can't be double-booked; the patient's preferred window is highlighted, and the
// default date follows the AI urgency.
export default function ScheduleDialog({ request, onConfirm, onClose }) {
  const { appointments, therapists, patientById, visitDurations } = useData()
  const patient = patientById[request.patientId]
  const ai = request.ai
  // Appointment length comes from Settings (per visit type).
  const duration = visitDurations[ai.visitType] ?? 20
  const [wFrom, wTo] = PREFERRED_WINDOWS[request.preferredTime] || PREFERRED_WINDOWS['גמיש']

  const workingDays = useMemo(() => upcomingWorkingDays(6), [])

  // Build the 30-minute slot grid for a given therapist + date.
  function buildSlots(d, tId) {
    const now = new Date()
    const dayEnd = set(d, { hours: WORK_END_HOUR, minutes: 0, seconds: 0, milliseconds: 0 }).getTime()
    const out = []
    for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
      for (const m of [0, 30]) {
        const start = set(d, { hours: h, minutes: m, seconds: 0, milliseconds: 0 })
        const end = start.getTime() + duration * 60000
        if (end > dayEnd) continue
        const taken = appointments.some(
          (a) =>
            a.therapistId === tId &&
            isSameDay(a.start, d) &&
            start.getTime() < a.start.getTime() + a.durationMin * 60000 &&
            end > a.start.getTime(),
        )
        const past = start.getTime() < now.getTime()
        const preferred = h >= wFrom && h < wTo
        out.push({ hour: h, minute: m, start, taken, past, preferred, available: !taken && !past })
      }
    }
    return out
  }

  // Default date: earliest working day (from the urgency-preferred offset) that
  // actually has an open slot for the routed therapist — so "today" isn't
  // suggested when it's already fully booked or past working hours.
  const recommendedIdx = useMemo(() => {
    const startIdx = Math.min(URGENCY_DATE_OFFSET[ai.urgency] ?? 2, workingDays.length - 1)
    for (let i = startIdx; i < workingDays.length; i++) {
      if (buildSlots(workingDays[i], ai.routedTo).some((s) => s.available)) return i
    }
    return startIdx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingDays])

  const [therapistId, setTherapistId] = useState(ai.routedTo)
  const [date, setDate] = useState(workingDays[recommendedIdx])
  const [selected, setSelected] = useState(null) // { hour, minute }

  const slots = useMemo(
    () => buildSlots(date, therapistId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, therapistId, date, duration, wFrom, wTo],
  )

  function pickTherapist(id) {
    setTherapistId(id)
    setSelected(null)
  }
  function pickDate(d) {
    setDate(d)
    setSelected(null)
  }

  function confirm() {
    if (!selected) return
    onConfirm({
      therapistId,
      start: set(date, { hours: selected.hour, minutes: selected.minute, seconds: 0, milliseconds: 0 }),
      durationMin: duration,
    })
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade" onClick={onClose}>
      <Card className="w-full max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Avatar initials={patient.name.slice(0, 2)} color="#0d9488" size={42} />
            <div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight">קביעת תור — {patient.name}</h3>
              <p className="text-sm text-slate-400">{patient.phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 overflow-y-auto scroll-thin space-y-4">
          {/* AI summary */}
          <div className="rounded-xl bg-teal-50/70 ring-1 ring-teal-100 p-3">
            <div className="flex items-center gap-1.5 text-teal-700 text-xs font-semibold mb-2">
              <Sparkles size={14} /> המלצת AI
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <Badge tone={URGENCY_TONE[ai.urgency]}>{ai.urgency}</Badge>
              <Badge tone="slate">{ai.visitType}</Badge>
              <span className="text-slate-500">· משך {duration} דק׳</span>
              <span className="text-slate-500">· חלון מועדף: <b className="text-slate-700">{request.preferredTime}</b></span>
            </div>
          </div>

          {/* Therapist */}
          <Field label="מטפל">
            <div className="flex flex-wrap gap-2">
              {therapists.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickTherapist(t.id)}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 transition',
                    therapistId === t.id ? 'ring-teal-500 bg-teal-50' : 'ring-slate-200 hover:ring-teal-300',
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="font-medium text-slate-700">{t.name}</span>
                  {t.id === ai.routedTo && <Badge tone="teal"><Route size={11} /> מומלץ</Badge>}
                </button>
              ))}
            </div>
          </Field>

          {/* Date */}
          <Field label="תאריך">
            <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
              {workingDays.map((d, i) => {
                const active = isSameDay(d, date)
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => pickDate(d)}
                    className={clsx(
                      'shrink-0 w-20 rounded-xl px-2 py-2 text-center ring-1 transition',
                      active ? 'ring-teal-500 bg-teal-600 text-white' : 'ring-slate-200 hover:ring-teal-300 text-slate-700',
                    )}
                  >
                    <p className="text-xs">{i === 0 ? 'היום' : `יום ${dayName(d)}`}</p>
                    <p className="text-sm font-bold tabular-nums">{shortDate(d)}</p>
                    {i === recommendedIdx && (
                      <p className={clsx('text-[10px] mt-0.5', active ? 'text-teal-100' : 'text-teal-600')}>מומלץ</p>
                    )}
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Time slots */}
          <Field label="משבצת שעה" hint="מודגש = החלון המועדף · אפור = תפוס">
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((s) => {
                const isSel = selected && selected.hour === s.hour && selected.minute === s.minute
                return (
                  <button
                    key={`${s.hour}:${s.minute}`}
                    disabled={!s.available}
                    onClick={() => setSelected({ hour: s.hour, minute: s.minute })}
                    className={clsx(
                      'rounded-lg py-1.5 text-sm font-medium tabular-nums ring-1 transition',
                      isSel && 'bg-teal-600 text-white ring-teal-600',
                      !isSel && s.available && s.preferred && 'bg-teal-50 text-teal-700 ring-teal-300',
                      !isSel && s.available && !s.preferred && 'bg-white text-slate-600 ring-slate-200 hover:ring-teal-300',
                      !s.available && 'bg-slate-100 text-slate-300 ring-slate-100 line-through cursor-not-allowed',
                    )}
                    title={s.taken ? 'תפוס' : s.past ? 'עבר' : s.preferred ? 'בחלון המועדף' : ''}
                  >
                    {hhmm(s.start)}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">
            {selected
              ? <>נבחר: <b className="text-slate-700">{hhmm(set(date, { hours: selected.hour, minutes: selected.minute }))}</b></>
              : 'בחרו משבצת פנויה'}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>ביטול</Button>
            <Button disabled={!selected} onClick={confirm}><Check size={16} /> אישור וקביעת תור</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <label className="font-medium text-slate-700 text-sm flex items-center gap-1.5">
          {label === 'תאריך' && <CalendarDays size={15} className="text-teal-600" />}
          {label === 'משבצת שעה' && <Clock size={15} className="text-teal-600" />}
          {label}
        </label>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
