import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays, isSameDay, subMonths } from 'date-fns'
import { CalendarDays, Filter, X, Clock, Phone, ChevronRight, ChevronLeft, Ban } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { useSession } from '../../session.jsx'
import { Card, Badge, Avatar, Button } from '../../components/ui.jsx'
import AppointmentActions from '../../components/AppointmentActions.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import BlockDialog from '../../components/BlockDialog.jsx'
import {
  hhmm, dayName, shortDate, friendlyDate,
  weekStartOf, maxBookingWeekStart, BOOKING_HORIZON_MONTHS,
} from '../../lib/format.js'
import { clsx } from '../../components/clsx.js'
import { isUnresolvedPast } from '../../lib/appointments.js'
import { VISIT_TYPES, VISIT_TYPE_SHORT } from '../../data/seed.js'

const PX_PER_MIN = 1.6

const STATUS_RING = {
  קבוע: 'ring-white/40',
  הגיע: 'ring-white ring-2',
  הסתיים: 'opacity-70',
  'לא הגיע': 'ring-red-300 ring-2 line-through',
}

// Assign overlapping appointments within a day to side-by-side lanes.
// Column width is computed PER connected-overlap cluster (not globally over the
// whole day) so a lone appointment with no overlap spans the full column width —
// only appointments that actually overlap get subdivided.
function layoutDay(appts) {
  const sorted = [...appts].sort((a, b) => a.start - b.start)
  const placed = []
  let cluster = [] // items in the current connected-overlap cluster
  let lanes = [] // each lane holds the end time of its last appt (this cluster)
  let clusterMaxEnd = -Infinity

  const closeCluster = () => {
    const columns = Math.max(1, lanes.length)
    for (const item of cluster) item.columns = columns
    cluster = []
    lanes = []
    clusterMaxEnd = -Infinity
  }

  for (const a of sorted) {
    const start = a.start.getTime()
    const end = start + a.durationMin * 60000
    // A gap (start at/after everything seen so far) ends the current cluster.
    if (start >= clusterMaxEnd) closeCluster()
    let lane = lanes.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) {
      lane = lanes.length
      lanes.push(end)
    } else {
      lanes[lane] = end
    }
    const item = { appt: a, lane, columns: 1 }
    cluster.push(item)
    placed.push(item)
    clusterMaxEnd = Math.max(clusterMaxEnd, end)
  }
  closeCluster()
  return { placed }
}

export default function Calendar() {
  const { appointments, patientById, activeTherapists, therapistById, settings, blocks, removeBlock } = useData()
  const { role } = useSession()
  // Operating window (Settings): active weekdays + uniform daily hours [start, end).
  const workDays = settings.workDays
  const startHour = settings.workStartHour
  const endHour = settings.workEndHour
  const [therapistFilter, setTherapistFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockToEdit, setBlockToEdit] = useState(null)
  const [blockToRemove, setBlockToRemove] = useState(null)

  const selected = selectedId ? appointments.find((a) => a.id === selectedId) : null

  // ניווט שבועי: השבוע הנוכחי כברירת מחדל, עד ±6 חודשים.
  const thisWeekStart = useMemo(() => weekStartOf(new Date()), [])
  const minWeekStart = useMemo(() => weekStartOf(subMonths(new Date(), BOOKING_HORIZON_MONTHS)), [])
  const maxWeekStart = useMemo(() => maxBookingWeekStart(), [])
  const [weekStart, setWeekStart] = useState(thisWeekStart)
  const canPrev = weekStart > minWeekStart
  const canNext = weekStart < maxWeekStart
  const atThisWeek = isSameDay(weekStart, thisWeekStart)

  function shiftWeek(dir) {
    const next = addDays(weekStart, dir * 7)
    if (next < minWeekStart || next > maxWeekStart) return
    setWeekStart(next)
    setSelectedId(null)
  }

  // Columns = the clinic's active weekdays (weekStart is Sunday, so addDays(weekStart, dow)
  // lands on that weekday). Rows = the operating hours.
  const days = [...workDays].sort((a, b) => a - b).map((dow) => addDays(weekStart, dow))
  const hours = Array.from({ length: Math.max(0, endHour - startHour) }, (_, i) => startHour + i)

  const filtered = useMemo(
    () =>
      appointments.filter(
        (a) =>
          (therapistFilter === 'all' || a.therapistId === therapistFilter) &&
          (typeFilter === 'all' || a.visitType === typeFilter),
      ),
    [appointments, therapistFilter, typeFilter],
  )

  // Which blocks to DRAW (booking availability is unaffected — see isSlotBlocked).
  // Bands span the full day column, so a per-therapist block would visually cover other
  // providers' appointments in the combined view. Therefore: the "all therapists" view
  // shows only clinic-wide blocks (therapist_id null); filtering to one therapist adds
  // that therapist's personal blocks on top.
  const visibleBlocks = useMemo(
    () => blocks.filter((b) => b.therapistId === null || (therapistFilter !== 'all' && b.therapistId === therapistFilter)),
    [blocks, therapistFilter],
  )

  const gridHeight = Math.max(0, endHour - startHour) * 60 * PX_PER_MIN

  return (
    <div className="space-y-5 animate-fade">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">יומן הקליניקה</h1>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <p className="text-slate-500">תצוגה שבועית · {shortDate(days[0])}–{shortDate(days[days.length - 1])}</p>
            <div className="flex items-center gap-0.5 rounded-xl ring-1 ring-slate-200 bg-white p-0.5">
              <button
                onClick={() => shiftWeek(-1)}
                disabled={!canPrev}
                title="שבוע קודם"
                className="grid place-items-center h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent transition"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setWeekStart(thisWeekStart)}
                disabled={atThisWeek}
                className={clsx('px-2 h-8 rounded-lg text-sm font-semibold transition',
                  atThisWeek ? 'text-slate-400' : 'text-teal-700 hover:bg-teal-50')}
              >
                השבוע
              </button>
              <button
                onClick={() => shiftWeek(1)}
                disabled={!canNext}
                title="שבוע הבא"
                className="grid place-items-center h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent transition"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {role.canApprove && (
            <button
              onClick={() => setBlockOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-amber-700 ring-1 ring-amber-200 bg-white hover:bg-amber-50 transition"
            >
              <Ban size={15} /> חסימת זמן
            </button>
          )}
          <div className="flex items-center gap-2 rounded-xl ring-1 ring-slate-200 bg-slate-50 px-2 py-1">
            <Filter size={15} className="text-slate-400 shrink-0" />
            <Select value={therapistFilter} onChange={setTherapistFilter} ariaLabel="סינון לפי מטפל"
              options={[{ value: 'all', label: 'כל המטפלים' }, ...activeTherapists.map((t) => ({ value: t.id, label: t.name }))]} />
            <Select value={typeFilter} onChange={setTypeFilter} ariaLabel="סינון לפי סוג ביקור"
              options={[{ value: 'all', label: 'כל סוגי הביקור' }, ...VISIT_TYPES.map((v) => ({ value: v, label: v }))]} />
          </div>
        </div>
      </div>

      {/* Therapist legend */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        {activeTherapists.map((t) => (
          <span key={t.id} className="flex items-center gap-1.5 text-slate-600">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
            {t.name} <span className="text-slate-400">· {t.specialty}</span>
          </span>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <div className="min-w-[760px]">
            {/* Day headers */}
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
              <div className="border-b border-slate-100" />
              {days.map((d) => (
                <div key={d} className={clsx('border-b border-r border-slate-100 py-2.5 text-center',
                  isSameDay(d, new Date()) && 'bg-teal-50/60')}>
                  <p className={clsx('text-sm font-semibold', isSameDay(d, new Date()) ? 'text-teal-800' : 'text-slate-700')}>יום {dayName(d)}</p>
                  <p className={clsx('text-xs inline-flex items-center justify-center gap-1.5', isSameDay(d, new Date()) ? 'text-teal-600 font-medium' : 'text-slate-400')}>
                    {shortDate(d)}
                    {isSameDay(d, new Date()) && (
                      <Badge tone="teal" className="px-2 py-0">היום</Badge>
                    )}
                  </p>
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, height: gridHeight }}>
              {/* Hour labels */}
              <div className="relative">
                {hours.map((h) => (
                  <div key={h} className="absolute right-2 -translate-y-1/2 text-xs text-slate-400 tabular-nums"
                    style={{ top: (h - startHour) * 60 * PX_PER_MIN }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {days.map((d) => {
                const dayAppts = filtered.filter((a) => isSameDay(a.start, d))
                const { placed } = layoutDay(dayAppts)
                return (
                  <div key={d} className={clsx('relative border-r border-slate-100',
                    isSameDay(d, new Date()) && 'bg-teal-50/30')}>
                    {/* hour lines */}
                    {hours.map((h) => (
                      <div key={h} className="absolute inset-x-0 border-t border-slate-100"
                        style={{ top: (h - startHour) * 60 * PX_PER_MIN }} />
                    ))}
                    {/* manual blocks (behind appointments): gray hatched bands, click to edit/remove.
                        Combined view shows clinic-wide only; a therapist filter adds their own. */}
                    {visibleBlocks.filter((b) => isSameDay(b.start, d)).map((b) => {
                      const bStartMin = b.start.getHours() * 60 + b.start.getMinutes() - startHour * 60
                      const who = b.therapistId ? (therapistById[b.therapistId]?.name ?? '') : 'כל הקליניקה'
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => role.canApprove && setBlockToEdit(b)}
                          title={`חסימה · ${who}${b.reason ? ' · ' + b.reason : ''}${role.canApprove ? ' — לחצו לעריכה או הסרה' : ''}`}
                          className="absolute inset-x-1 rounded-lg bg-slate-200/80 ring-1 ring-slate-400/40 text-slate-600 overflow-hidden hover:bg-slate-300/80 transition text-right"
                          style={{
                            top: bStartMin * PX_PER_MIN + 1,
                            height: b.durationMin * PX_PER_MIN - 2,
                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(100,116,139,0.14) 5px, rgba(100,116,139,0.14) 10px)',
                          }}
                        >
                          <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-bold truncate">
                            <Ban size={12} className="shrink-0" /> {b.reason || 'חסום'} · {who}
                          </span>
                        </button>
                      )
                    })}
                    {/* appointments */}
                    {placed.map(({ appt, lane, columns }) => {
                      const t = therapistById[appt.therapistId]
                      const p = patientById[appt.patientId]
                      const startMin = appt.start.getHours() * 60 + appt.start.getMinutes() - startHour * 60
                      const width = `calc(${100 / columns}% - 4px)`
                      const left = `calc(${(lane * 100) / columns}% + 2px)`
                      return (
                        <div
                          key={appt.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedId(appt.id)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedId(appt.id)}
                          className={clsx('absolute rounded-lg px-1.5 py-0.5 text-white overflow-hidden shadow-sm ring-1 cursor-pointer hover:brightness-110 transition',
                            isUnresolvedPast(appt) ? 'ring-2 ring-amber-400' : STATUS_RING[appt.status])}
                          style={{
                            top: startMin * PX_PER_MIN + 1,
                            height: appt.durationMin * PX_PER_MIN - 2,
                            width,
                            right: left,
                            backgroundColor: t.color,
                          }}
                          title={isUnresolvedPast(appt)
                            ? `תור שעבר - לא עודכן הגיע/לא הגיע\n${p.name} · ${appt.visitType} · ${t.name}`
                            : `${p.name} · ${appt.visitType} · ${t.name} · ${appt.status}`}
                        >
                          <p className="text-xs font-bold leading-tight truncate">
                            <span className="font-medium text-white/70">{hhmm(appt.start)}</span> {p.name}
                          </p>
                          {appt.durationMin >= 20 && (
                            <p className="text-[11px] text-white/75 truncate leading-tight">
                              {VISIT_TYPE_SHORT[appt.visitType] || appt.visitType}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <CalendarDays size={14} /> לחצו על תור לפרטים וסימון הגעה. ריבוי מטפלים באותה שעה מוצג זה לצד זה.
      </p>

      {selected && (
        <AppointmentModal
          appt={selected}
          patient={patientById[selected.patientId]}
          therapist={therapistById[selected.therapistId]}
          onClose={() => setSelectedId(null)}
        />
      )}

      {blockOpen && <BlockDialog onClose={() => setBlockOpen(false)} />}

      {blockToEdit && (
        <BlockDialog
          editBlock={blockToEdit}
          onClose={() => setBlockToEdit(null)}
          onRemove={() => { const b = blockToEdit; setBlockToEdit(null); setBlockToRemove(b) }}
        />
      )}

      {blockToRemove && (
        <ConfirmDialog
          title="הסרת החסימה?"
          message={`${blockToRemove.therapistId ? (therapistById[blockToRemove.therapistId]?.name ?? '') : 'כל הקליניקה'} · ${friendlyDate(blockToRemove.start)} בשעה ${hhmm(blockToRemove.start)} · ${blockToRemove.durationMin} דק׳${blockToRemove.reason ? ' · ' + blockToRemove.reason : ''}`}
          confirmLabel="כן, הסר/י חסימה"
          cancelLabel="חזרה"
          onConfirm={() => { removeBlock(blockToRemove.id); setBlockToRemove(null) }}
          onClose={() => setBlockToRemove(null)}
        />
      )}
    </div>
  )
}

function AppointmentModal({ appt, patient, therapist, onClose }) {
  const { cancelAppointment, profileById } = useData()
  const { role } = useSession()
  const [confirmCancel, setConfirmCancel] = useState(false)
  // Provenance: who booked it + through which channel. A desk booking stamps created_by
  // (the secretary); a patient self-book / portal has no creator → attribute to the patient.
  const bookedByName = appt.createdBy ? (profileById[appt.createdBy]?.fullName ?? null) : null
  const selfBooked = !appt.createdBy && (appt.source === 'הזמנה עצמית' || appt.source === 'פורטל')
  // Cancelling makes sense for a still-scheduled appointment (not one already
  // arrived / completed / no-show); gated to staff who can approve.
  const canCancel = role?.canApprove && appt.status === 'קבוע'

  return (
    <>
    {createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center items-start bg-slate-900/40 backdrop-blur-sm p-4 animate-fade"
      onClick={onClose}
    >
      <Card className="w-full max-w-md p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-1.5" style={{ backgroundColor: therapist.color }} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar initials={patient.name.slice(0, 2)} color={therapist.color} size={46} />
              <div>
                <h3 className="font-bold text-slate-800 text-lg leading-tight">{patient.name}</h3>
                <p className="text-sm text-slate-400 flex items-center gap-1">
                  <Phone size={12} /> {patient.phone} · {patient.age}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Info label="מועד"><span className="flex items-center gap-1"><Clock size={13} /> {friendlyDate(appt.start)} · {hhmm(appt.start)}</span></Info>
            <Info label="משך">{appt.durationMin} דקות</Info>
            <Info label="סוג ביקור"><Badge tone="blue">{appt.visitType}</Badge></Info>
            <Info label="מטפל">{therapist.name}</Info>
          </div>

          {appt.reason && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400 mb-0.5">סיבת הפנייה</p>
              <p className="text-sm text-slate-700">"{appt.reason}"</p>
            </div>
          )}

          {/* Provenance — booking channel + who created it. */}
          {appt.source && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
              <span>מקור:</span>
              <Badge tone="slate">{appt.source}</Badge>
              {bookedByName ? <span>· נקבע ע״י {bookedByName}</span> : selfBooked ? <span>· נקבע ע״י המטופל/ת</span> : null}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">סטטוס וסימון:</span>
            <AppointmentActions appt={appt} size="md" />
          </div>

          {canCancel && (
            <div className="mt-3 flex justify-end">
              <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
                <X size={14} /> ביטול תור
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>,
      document.body,
    )}

    {confirmCancel && (
      <ConfirmDialog
        title="ביטול התור?"
        message={`${patient.name} · ${appt.visitType} · ${friendlyDate(appt.start)} בשעה ${hhmm(appt.start)}. פעולה זו אינה ניתנת לביטול.`}
        confirmLabel="כן, בטל/י תור"
        cancelLabel="חזרה"
        onConfirm={() => { cancelAppointment(appt.id); onClose() }}
        onClose={() => setConfirmCancel(false)}
      />
    )}
    </>
  )
}

function Info({ label, children }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <div className="text-slate-700 font-medium">{children}</div>
    </div>
  )
}

function Select({ value, onChange, options, ariaLabel }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className="h-8 rounded-lg ring-1 ring-slate-200 bg-white px-2.5 text-sm text-slate-700 hover:ring-teal-400 focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer transition"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
