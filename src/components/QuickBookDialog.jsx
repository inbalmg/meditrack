import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays, isSameDay, set } from 'date-fns'
import { X, CalendarDays, Clock, Check, Send, Mail, Stethoscope } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { Card, Button } from './ui.jsx'
import { clsx } from './clsx.js'
import PatientPicker from './PatientPicker.jsx'
import {
  dayName, shortDate, hhmm,
  firstBookingDay, weekStartOf, maxBookingWeekStart, weekWorkingDays,
} from '../lib/format.js'
import { WORK_START_HOUR, WORK_END_HOUR } from '../data/seed.js'

// Direct Booking (קביעה ישירה בשיחה): the secretary schedules a call straight into the
// calendar — pick/register the patient, therapist, treatment and a free slot. No AI, no
// requests queue. Writes to appointments via bookAppointmentByStaff, which stamps
// created_by + source='טלפון' (quick bookings are, in practice, always phone calls — so
// there's no channel picker). Booking-success is shown by the shared modal in ClinicLayout.
export default function QuickBookDialog({ onClose }) {
  const { activeTherapists, appointments, patientById, treatmentsForTherapist, treatmentById, addPatient, bookAppointmentByStaff } = useData()

  const [patientSel, setPatientSel] = useState({ mode: 'existing', patientId: null, newPatient: null, ready: false })
  const [therapistId, setTherapistId] = useState(activeTherapists[0]?.id ?? '')
  const availableTreatments = useMemo(
    () => treatmentsForTherapist(therapistId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [therapistId],
  )
  const [treatmentId, setTreatmentId] = useState(availableTreatments[0]?.id ?? '')
  const duration = treatmentById[treatmentId]?.durationMin ?? 30

  const firstDay = useMemo(() => firstBookingDay(), [])
  const thisWeekStart = useMemo(() => weekStartOf(firstDay), [firstDay])
  const maxWeekStart = useMemo(() => maxBookingWeekStart(), [])

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
          (a) => a.therapistId === tId && isSameDay(a.start, d)
            && start.getTime() < a.start.getTime() + a.durationMin * 60000 && end > a.start.getTime(),
        )
        const past = start.getTime() < now.getTime()
        out.push({ hour: h, minute: m, start, taken, past, available: !taken && !past })
      }
    }
    return out
  }

  // Default date: earliest working day with an open slot for the selected therapist.
  const recommendedDate = useMemo(() => {
    let d = firstDay
    for (let i = 0; i < 180; i++) {
      if (d.getDay() <= 4 && buildSlots(d, therapistId).some((s) => s.available)) return d
      d = addDays(d, 1)
    }
    return firstDay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapistId])

  const [weekStart, setWeekStart] = useState(() => weekStartOf(firstDay))
  const [date, setDate] = useState(firstDay)
  const [selected, setSelected] = useState(null)
  const workingDays = useMemo(() => weekWorkingDays(weekStart, firstDay), [weekStart, firstDay])
  const canPrevWeek = weekStart > thisWeekStart
  const canNextWeek = weekStart < maxWeekStart

  // Follow the computed recommended date when the therapist changes.
  useEffect(() => { setDate(recommendedDate); setWeekStart(weekStartOf(recommendedDate)); setSelected(null) }, [recommendedDate])

  const slots = useMemo(
    () => buildSlots(date, therapistId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, therapistId, date, duration],
  )

  // Email availability for the confirmation toggle (existing patient record or new-patient input).
  const patientEmail = patientSel.mode === 'existing'
    ? (patientSel.patientId ? patientById[patientSel.patientId]?.email : null)
    : (patientSel.newPatient?.email?.trim() || null)
  const hasEmail = !!patientEmail
  const [notify, setNotify] = useState(true)
  const [notifyEmail, setNotifyEmail] = useState(false)

  function pickTherapist(id) {
    setTherapistId(id)
    const offered = treatmentsForTherapist(id)
    if (!offered.some((t) => t.id === treatmentId)) setTreatmentId(offered[0]?.id ?? '')
    setSelected(null)
  }

  const canConfirm = patientSel.ready && !!treatmentId && !!selected

  function confirm() {
    if (!canConfirm) return
    let pid = patientSel.patientId
    if (patientSel.mode === 'new') {
      const p = addPatient(patientSel.newPatient)
      pid = p.id
    }
    bookAppointmentByStaff({
      patientId: pid,
      therapistId,
      treatmentId,
      start: set(date, { hours: selected.hour, minutes: selected.minute, seconds: 0, milliseconds: 0 }),
      // source defaults to 'טלפון' in the store — quick bookings are always phone calls.
      notify,
      notifyEmail: notifyEmail && hasEmail,
    })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center items-start p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-lg p-0 overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 bg-ink-900 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-white/10 text-teal-300"><CalendarDays size={17} /></span>
            <h3 className="font-semibold text-white text-lg">קביעת תור מהירה</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 overflow-y-auto scroll-thin space-y-4">
          {/* Patient */}
          <Field label="מטופל">
            <PatientPicker onChange={setPatientSel} autoFocus />
          </Field>

          {/* Therapist */}
          <Field label="מטפל">
            <div className="flex flex-wrap gap-2">
              {activeTherapists.map((t) => (
                <button key={t.id} type="button" onClick={() => pickTherapist(t.id)}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 transition',
                    therapistId === t.id ? 'ring-teal-500 bg-teal-50' : 'ring-slate-200 hover:ring-teal-300',
                  )}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="font-medium text-slate-700">{t.name}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* Treatment */}
          <Field label="סוג טיפול" icon={Stethoscope}>
            <select value={treatmentId} onChange={(e) => { setTreatmentId(e.target.value); setSelected(null) }}
              className="w-full h-10 rounded-xl ring-1 ring-slate-300 px-3 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-teal-500">
              {availableTreatments.length === 0 && <option value="">— אין טיפולים למטפל זה —</option>}
              {availableTreatments.map((t) => (
                <option key={t.id} value={t.id}>{t.name} · {t.durationMin} דק׳</option>
              ))}
            </select>
          </Field>

          {/* Date */}
          <Field label="תאריך" icon={CalendarDays}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-400 tabular-nums">{shortDate(weekStart)}–{shortDate(addDays(weekStart, 4))}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => { if (canPrevWeek) { const n = addDays(weekStart, -7); setWeekStart(n); setDate(weekWorkingDays(n, firstDay)[0] ?? date); setSelected(null) } }} disabled={!canPrevWeek}
                  className="grid place-items-center h-7 px-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:text-slate-300 text-sm">‹</button>
                <button type="button" onClick={() => { if (canNextWeek) { const n = addDays(weekStart, 7); setWeekStart(n); setDate(weekWorkingDays(n, firstDay)[0] ?? date); setSelected(null) } }} disabled={!canNextWeek}
                  className="grid place-items-center h-7 px-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:text-slate-300 text-sm">›</button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
              {workingDays.map((d) => {
                const active = isSameDay(d, date)
                return (
                  <button key={d.toISOString()} type="button" onClick={() => { setDate(d); setSelected(null) }}
                    className={clsx(
                      'shrink-0 w-20 rounded-xl px-2 py-2 text-center ring-1 transition',
                      active ? 'ring-teal-500 bg-teal-600 text-white' : 'ring-slate-200 hover:ring-teal-300 text-slate-700',
                    )}>
                    <p className="text-xs">{isSameDay(d, new Date()) ? 'היום' : `יום ${dayName(d)}`}</p>
                    <p className="text-sm font-bold tabular-nums">{shortDate(d)}</p>
                  </button>
                )
              })}
            </div>
          </Field>

          {/* Slots */}
          <Field label="משבצת שעה" icon={Clock} hint="אפור = תפוס">
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((s) => {
                const isSel = selected && selected.hour === s.hour && selected.minute === s.minute
                return (
                  <button key={`${s.hour}:${s.minute}`} type="button" disabled={!s.available}
                    onClick={() => setSelected({ hour: s.hour, minute: s.minute })}
                    className={clsx(
                      'rounded-lg py-1.5 text-sm font-medium tabular-nums ring-1 transition',
                      isSel && 'bg-teal-600 text-white ring-teal-600',
                      !isSel && s.available && 'bg-white text-slate-600 ring-slate-200 hover:ring-teal-300',
                      !s.available && 'bg-slate-100 text-slate-300 ring-slate-100 line-through cursor-not-allowed',
                    )}>
                    {hhmm(s.start)}
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 space-y-3">
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-teal-600" />
              <Send size={15} className="text-teal-600 shrink-0" /> שלח הודעת אישור אוטומטית למטופל (WhatsApp/SMS)
            </label>
            <label className={clsx('flex items-center gap-2.5 text-sm select-none', hasEmail ? 'text-slate-700 cursor-pointer' : 'text-slate-400 cursor-not-allowed')}>
              <input type="checkbox" checked={notifyEmail && hasEmail} disabled={!hasEmail} onChange={(e) => setNotifyEmail(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-teal-600 disabled:opacity-50" />
              <Mail size={15} className={clsx('shrink-0', hasEmail ? 'text-teal-600' : 'text-slate-300')} /> שלח הודעת אישור באימייל
              {!hasEmail && <span className="text-[11px] text-slate-400">· אין אימייל</span>}
            </label>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">
              {selected
                ? <>נבחר: <b className="text-slate-700">{hhmm(set(date, { hours: selected.hour, minutes: selected.minute }))}</b></>
                : 'בחרו משבצת פנויה'}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>ביטול</Button>
              <Button disabled={!canConfirm} onClick={confirm}><Check size={16} /> קביעת תור</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>,
    document.body,
  )
}

function Field({ label, hint, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <label className="font-medium text-slate-700 text-sm flex items-center gap-1.5">
          {Icon && <Icon size={15} className="text-teal-600" />}{label}
        </label>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
