import { useMemo, useState } from 'react'
import { addDays, isSameDay, set } from 'date-fns'
import { X, Sparkles, CalendarDays, Clock, Check, Route, ChevronRight, ChevronLeft, Stethoscope, Send } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { Card, Badge, Button, Avatar } from './ui.jsx'
import { clsx } from './clsx.js'
import {
  dayName, shortDate, hhmm,
  firstBookingDay, weekStartOf, maxBookingWeekStart, weekWorkingDays,
} from '../lib/format.js'
import {
  PREFERRED_WINDOWS,
  WORK_START_HOUR,
  WORK_END_HOUR,
} from '../data/seed.js'

const URGENCY_TONE = { 'דחוף': 'red', 'בהקדם': 'amber', 'רגיל': 'teal' }
// How soon to suggest the appointment, by AI urgency (index into working days).
const URGENCY_DATE_OFFSET = { 'דחוף': 0, 'בהקדם': 1, 'רגיל': 2 }

// The scheduling flow: the secretary picks the therapist, date and an available
// slot. Availability is computed live from existing appointments so a therapist
// can't be double-booked; the patient's preferred window is highlighted, and the
// default date follows the AI urgency.
export default function ScheduleDialog({ request, onConfirm, onClose }) {
  const { appointments, activeTherapists, patientById, visitDurations, treatmentById, treatments, treatmentsForTherapist } = useData()
  const patient = patientById[request.patientId]
  const ai = request.ai

  // Editable treatment selection (defaults to the AI's suggestion). The reserved
  // slot length follows the *selected* treatment, so changing it re-grids the
  // available times. The AI card keeps showing the AI's own recommended duration.
  const [treatmentId, setTreatmentId] = useState(ai.treatmentId)
  // Whether to fire the WhatsApp/SMS confirmation to the patient on approval.
  const [notify, setNotify] = useState(true)
  const selectedTreatment = treatmentById[treatmentId]
  const duration = selectedTreatment?.durationMin ?? visitDurations[ai.visitType] ?? 20
  const aiDuration = visitDurations[ai.visitType] ?? 20
  const [wFrom, wTo] = PREFERRED_WINDOWS[request.preferredTime] || PREFERRED_WINDOWS['גמיש']

  // ניווט שבועי: מהיום ועד 6 חודשים קדימה (א׳–ה׳ בלבד).
  const firstDay = useMemo(() => firstBookingDay(), [])
  const thisWeekStart = useMemo(() => weekStartOf(firstDay), [firstDay])
  const maxWeekStart = useMemo(() => maxBookingWeekStart(), [])

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
  const recommendedDate = useMemo(() => {
    const offset = URGENCY_DATE_OFFSET[ai.urgency] ?? 2
    let d = firstDay
    let stepped = 0
    while (stepped < offset) {
      d = addDays(d, 1)
      if (d.getDay() <= 4) stepped++
    }
    for (let i = 0; i < 180; i++) {
      if (d.getDay() <= 4 && buildSlots(d, ai.routedTo).some((s) => s.available)) return d
      d = addDays(d, 1)
    }
    return firstDay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [therapistId, setTherapistId] = useState(ai.routedTo)
  // Treatments offered by the currently selected therapist (drives the dynamic list).
  const availableTreatments = useMemo(
    () => treatmentsForTherapist(therapistId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [therapistId, treatments],
  )
  const [weekStart, setWeekStart] = useState(() => weekStartOf(recommendedDate))
  const [date, setDate] = useState(recommendedDate)
  const [selected, setSelected] = useState(null) // { hour, minute }
  const workingDays = useMemo(() => weekWorkingDays(weekStart, firstDay), [weekStart, firstDay])
  const canPrevWeek = weekStart > thisWeekStart
  const canNextWeek = weekStart < maxWeekStart

  function shiftWeek(dir) {
    const next = addDays(weekStart, dir * 7)
    if (next < thisWeekStart || next > maxWeekStart) return
    setWeekStart(next)
    setDate(weekWorkingDays(next, firstDay)[0] ?? date)
    setSelected(null)
  }

  const slots = useMemo(
    () => buildSlots(date, therapistId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, therapistId, date, duration, wFrom, wTo],
  )

  function pickTherapist(id) {
    setTherapistId(id)
    // Keep the treatment valid: if the new therapist doesn't offer the current
    // one, fall back to their first available treatment.
    const offered = treatmentsForTherapist(id)
    if (!offered.some((t) => t.id === treatmentId)) {
      setTreatmentId(offered[0]?.id ?? treatmentId)
    }
    setSelected(null)
  }
  function pickTreatment(id) {
    setTreatmentId(id)
    setSelected(null) // duration may change → re-grid the slots
  }
  function pickDate(d) {
    setDate(d)
    setSelected(null)
  }

  function confirm() {
    if (!selected) return
    onConfirm({
      therapistId,
      treatmentId,
      start: set(date, { hours: selected.hour, minutes: selected.minute, seconds: 0, milliseconds: 0 }),
      durationMin: duration,
      notify,
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
              <span className="text-slate-500">· משך {aiDuration} דק׳</span>
            </div>
          </div>

          {/* Therapist */}
          <Field label="מטפל">
            <div className="flex flex-wrap gap-2">
              {activeTherapists.map((t) => (
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

          {/* Treatment type — list updates dynamically with the selected therapist */}
          <Field label="סוג טיפול">
            <select
              value={treatmentId ?? ''}
              onChange={(e) => pickTreatment(e.target.value)}
              className="w-full h-10 rounded-xl ring-1 ring-slate-300 px-3 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-teal-500"
            >
              {availableTreatments.length === 0 && <option value="">— אין טיפולים למטפל זה —</option>}
              {availableTreatments.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {t.durationMin} דק׳</option>
              ))}
            </select>
          </Field>

          {/* Date */}
          <Field label="תאריך">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-400 tabular-nums">{shortDate(weekStart)}–{shortDate(addDays(weekStart, 4))}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  disabled={!canPrevWeek}
                  title="שבוע קודם"
                  className="grid place-items-center h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent transition"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  disabled={!canNextWeek}
                  title="שבוע הבא"
                  className="grid place-items-center h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent transition"
                >
                  <ChevronLeft size={15} />
                </button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
              {workingDays.map((d) => {
                const active = isSameDay(d, date)
                const recommended = isSameDay(d, recommendedDate)
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => pickDate(d)}
                    className={clsx(
                      'shrink-0 w-20 rounded-xl px-2 py-2 text-center ring-1 transition',
                      active ? 'ring-teal-500 bg-teal-600 text-white' : 'ring-slate-200 hover:ring-teal-300 text-slate-700',
                    )}
                  >
                    <p className="text-xs">{isSameDay(d, new Date()) ? 'היום' : `יום ${dayName(d)}`}</p>
                    <p className="text-sm font-bold tabular-nums">{shortDate(d)}</p>
                    {recommended && (
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
        <div className="px-5 py-4 border-t border-slate-100 space-y-3">
          {/* Notify the patient with an automatic confirmation message */}
          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-teal-600"
            />
            <Send size={15} className="text-teal-600 shrink-0" />
            שלח הודעת אישור אוטומטית למטופל (WhatsApp/SMS)
          </label>
          <div className="flex items-center justify-between gap-3">
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
          {label === 'סוג טיפול' && <Stethoscope size={15} className="text-teal-600" />}
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
