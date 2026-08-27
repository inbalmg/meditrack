import { useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays } from 'date-fns'
import { X, Ban, Clock, Check, Building2, CheckCircle2, Info, Trash2 } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { Card, Button } from './ui.jsx'
import { clsx } from './clsx.js'
import { toClinicInput, clinicInputToDate, friendlyDate, hhmm } from '../lib/format.js'

// Duration presets for a block (minutes). "כל היום" is offered separately (fills the
// whole operating window from workStartHour to workEndHour).
const DURATIONS = [
  { min: 30, label: '30 דק׳' },
  { min: 60, label: 'שעה' },
  { min: 120, label: 'שעתיים' },
  { min: 240, label: '4 שעות' },
]

const pad = (n) => String(n).padStart(2, '0')
const fmtHour = (h) => `${pad(h)}:00`

// Create OR edit a manual calendar block (חסימת זמן). Scope is a specific therapist OR the
// whole clinic (therapist_id null). When `lockedTherapistId` is passed (a therapist blocking
// their own time from DoctorCalendar) the scope picker is hidden and locked to them.
// `defaultStart` (a Date) prefills the start field; otherwise it defaults to the clinic
// opening hour (workStartHour, 09:00 by default) on today's date.
// Edit mode: pass an existing `editBlock` to prefill every field and save via updateBlock;
// `onRemove` (called from the "הסר חסימה" button) lets the caller run its own delete-confirm.
export default function BlockDialog({ onClose, lockedTherapistId = null, defaultStart = null, editBlock = null, onRemove = null }) {
  const { activeTherapists, therapistById, addBlock, updateBlock, settings } = useData()
  const startHour = settings.workStartHour
  const endHour = settings.workEndHour
  const workDays = settings.workDays
  const isEdit = !!editBlock
  const fullDayMin = Math.max(30, (endHour - startHour) * 60)

  // scope: null = whole clinic; otherwise a therapist id. Locked to self for a therapist.
  const [scope, setScope] = useState(lockedTherapistId ?? editBlock?.therapistId ?? null)
  // Default start: the clicked slot, or the next OPEN slot — the current time rounded up
  // to the next half-hour within working hours; if the clinic is already closed for today
  // (or today isn't a working day) it jumps to the next working day at the opening hour.
  // This guarantees a valid (future) default so the form never opens in an error state.
  const [startInput, setStartInput] = useState(() => {
    if (editBlock) return toClinicInput(editBlock.start)
    if (defaultStart) return toClinicInput(defaultStart)
    const [datePart, timePart] = toClinicInput(new Date()).split('T')
    const [hh, mm] = timePart.split(':').map(Number)
    const openMin = startHour * 60
    const closeMin = endHour * 60
    const todayDow = new Date(`${datePart}T00:00`).getDay()
    const nextHalf = (Math.floor((hh * 60 + mm) / 30) + 1) * 30 // strictly after now
    if (workDays.includes(todayDow)) {
      const startMin = Math.max(nextHalf, openMin)
      if (startMin < closeMin) return `${datePart}T${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`
    }
    // Clinic closed for today (or not a working day) → next working day at the opening hour.
    let d = new Date(`${datePart}T00:00`)
    let guard = 0
    do { d = addDays(d, 1) } while (!workDays.includes(d.getDay()) && guard++ < 14)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(startHour)}:00`
  })
  const [durationMin, setDurationMin] = useState(editBlock ? editBlock.durationMin : 60)
  const [allDay, setAllDay] = useState(editBlock ? editBlock.durationMin >= fullDayMin : false)
  const [reason, setReason] = useState(editBlock ? (editBlock.reason || '') : '')
  // Success confirmation — the secretary can't see personal blocks on the main calendar,
  // so on create we show an explicit summary of exactly what was blocked.
  const [done, setDone] = useState(null)

  // --- Validation of the start field (+ hours/day/past) ---
  const error = (() => {
    if (!startInput) return 'יש לבחור מועד תחילה'
    const [datePart, timePart] = startInput.split('T')
    if (!datePart || !timePart) return 'מועד לא תקין'
    const [Y, M, D] = datePart.split('-').map(Number)
    const [hh, mm] = timePart.split(':').map(Number)
    const dow = new Date(Y, M - 1, D).getDay()
    if (!workDays.includes(dow)) return 'היום שנבחר אינו יום פעילות בקליניקה'
    if (allDay) {
      const chosen = new Date(Y, M - 1, D).setHours(0, 0, 0, 0)
      const today = new Date().setHours(0, 0, 0, 0)
      if (!isEdit && chosen < today) return 'לא ניתן לחסום יום שכבר עבר'
      return ''
    }
    if (!isEdit && clinicInputToDate(startInput).getTime() < Date.now()) return 'לא ניתן לחסום מועד שכבר עבר'
    if (hh < startHour || hh >= endHour) return `השעה מחוץ לשעות הפעילות (${fmtHour(startHour)}–${fmtHour(endHour)})`
    if (hh * 60 + mm + durationMin > endHour * 60) return `החסימה חורגת משעת הסגירה (${fmtHour(endHour)})`
    return ''
  })()
  const canConfirm = !error

  function confirm() {
    if (!canConfirm) return
    let start = clinicInputToDate(startInput)
    let dur = durationMin
    if (allDay) {
      // Whole working day: pin start to the clinic opening hour on the chosen date.
      const d = clinicInputToDate(`${startInput.slice(0, 10)}T00:00`)
      d.setHours(startHour, 0, 0, 0)
      start = d
      dur = Math.max(30, (endHour - startHour) * 60)
    }
    const therapistId = lockedTherapistId ?? scope
    if (isEdit) {
      updateBlock(editBlock.id, { therapistId, start, durationMin: dur, reason })
      onClose()
      return
    }
    addBlock({ therapistId, start, durationMin: dur, reason })
    setDone({
      who: therapistId ? (therapistById[therapistId]?.name ?? '') : 'כל הקליניקה',
      start, durationMin: dur, reason: (reason || '').trim(),
      isPersonal: !!therapistId,
    })
  }

  function reset() {
    setDone(null)
    setReason('')
    setAllDay(false)
    setDurationMin(60)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center items-start p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-lg p-0 overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 bg-ink-900 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-white/10 text-amber-300"><Ban size={17} /></span>
            <h3 className="font-semibold text-white text-lg">{isEdit ? 'עריכת חסימת זמן' : 'חסימת זמן ביומן'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"><X size={18} /></button>
        </div>

        {done ? (
          /* ---- Success confirmation ---- */
          <div className="px-5 py-6 flex flex-col items-center text-center gap-3">
            <span className="grid place-items-center h-14 w-14 rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={30} /></span>
            <h4 className="text-lg font-bold text-slate-800">החסימה נוספה ליומן</h4>
            <div className="w-full rounded-xl ring-1 ring-slate-200 bg-slate-50 p-4 text-right">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-slate-500">היקף:</dt><dd className="font-medium text-slate-700">{done.who}</dd>
                <dt className="text-slate-500">מועד:</dt><dd className="font-medium text-slate-700">{friendlyDate(done.start)} · {hhmm(done.start)}</dd>
                <dt className="text-slate-500">משך:</dt><dd className="font-medium text-slate-700">{done.durationMin} דק׳</dd>
                {done.reason && (<><dt className="text-slate-500">סיבה:</dt><dd className="font-medium text-slate-700">{done.reason}</dd></>)}
              </dl>
            </div>
            {done.isPersonal && (
              <p className="flex items-start gap-1.5 text-xs text-slate-500 text-right">
                <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
                חסימה אישית אינה מוצגת בתצוגת "כל המטפלים" — סננו לפי המטפל ביומן כדי לראותה. המשבצת חסומה לתיאום בכל מקרה.
              </p>
            )}
            <div className="flex items-center gap-2 w-full pt-1">
              <Button variant="soft" className="flex-1" onClick={reset}>הוספת חסימה נוספת</Button>
              <Button className="flex-1" onClick={onClose}><Check size={16} /> סיום</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 overflow-y-auto scroll-thin space-y-4">
              {/* Scope — hidden when a therapist blocks their own time */}
              {!lockedTherapistId && (
                <Field label="למי החסימה?">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setScope(null)}
                      className={clsx('flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 transition',
                        scope === null ? 'ring-teal-500 bg-teal-50' : 'ring-slate-200 hover:ring-teal-300')}>
                      <Building2 size={15} className="text-slate-500" />
                      <span className="font-medium text-slate-700">כל הקליניקה</span>
                    </button>
                    {activeTherapists.map((t) => (
                      <button key={t.id} type="button" onClick={() => setScope(t.id)}
                        className={clsx('flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 transition',
                          scope === t.id ? 'ring-teal-500 bg-teal-50' : 'ring-slate-200 hover:ring-teal-300')}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        <span className="font-medium text-slate-700">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              {/* Start — validated */}
              <Field label="תחילת החסימה" icon={Clock}>
                <input
                  type="datetime-local"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  aria-invalid={!!error}
                  className={clsx(
                    'w-full h-10 rounded-xl ring-1 px-3 text-sm text-slate-700 bg-white outline-none focus:ring-2',
                    error ? 'ring-red-400 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
                  )}
                />
                {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
              </Field>

              {/* Duration */}
              <Field label="משך">
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map((d) => (
                    <button key={d.min} type="button" disabled={allDay} onClick={() => setDurationMin(d.min)}
                      className={clsx('rounded-xl px-3 py-1.5 text-sm ring-1 transition',
                        allDay ? 'ring-slate-100 text-slate-300 cursor-not-allowed'
                          : durationMin === d.min ? 'ring-teal-500 bg-teal-50 text-teal-700' : 'ring-slate-200 text-slate-600 hover:ring-teal-300')}>
                      {d.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => setAllDay((v) => !v)}
                    className={clsx('rounded-xl px-3 py-1.5 text-sm font-medium ring-1 transition',
                      allDay ? 'ring-amber-500 bg-amber-50 text-amber-700' : 'ring-slate-200 text-slate-600 hover:ring-amber-300')}>
                    כל היום
                  </button>
                </div>
              </Field>

              {/* Reason */}
              <Field label="סיבה (רשות)">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="לדוגמה: הפסקת צהריים, יום חופש, חג"
                  className="w-full h-10 rounded-xl ring-1 ring-slate-300 px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-500"
                />
              </Field>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-2">
              {isEdit && onRemove ? (
                <button type="button" onClick={onRemove}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition">
                  <Trash2 size={16} /> הסר חסימה
                </button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={onClose}>ביטול</Button>
                <Button disabled={!canConfirm} onClick={confirm}><Check size={16} /> {isEdit ? 'שמירת שינויים' : 'חסימת הזמן'}</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>,
    document.body,
  )
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="font-medium text-slate-700 text-sm flex items-center gap-1.5 mb-2">
        {Icon && <Icon size={15} className="text-teal-600" />}{label}
      </label>
      {children}
    </div>
  )
}
