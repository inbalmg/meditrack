import { useMemo, useState } from 'react'
import { addDays, isSameDay, subMonths } from 'date-fns'
import { CalendarDays, Filter, X, Clock, Phone, ChevronRight, ChevronLeft } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { useSession } from '../../session.jsx'
import { Card, Badge, Avatar, Button } from '../../components/ui.jsx'
import AppointmentActions from '../../components/AppointmentActions.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import {
  hhmm, dayName, shortDate, friendlyDate,
  weekStartOf, maxBookingWeekStart, BOOKING_HORIZON_MONTHS,
} from '../../lib/format.js'
import { clsx } from '../../components/clsx.js'
import { isUnresolvedPast } from '../../lib/appointments.js'
import { VISIT_TYPES, VISIT_TYPE_SHORT } from '../../data/seed.js'

const START_HOUR = 9
const END_HOUR = 18
const PX_PER_MIN = 1.6
const DAYS = 5 // Sun–Thu

const STATUS_RING = {
  קבוע: 'ring-white/40',
  הגיע: 'ring-white ring-2',
  הסתיים: 'opacity-70',
  'לא הגיע': 'ring-red-300 ring-2 line-through',
}

// Assign overlapping appointments within a day to side-by-side lanes.
function layoutDay(appts) {
  const sorted = [...appts].sort((a, b) => a.start - b.start)
  const lanes = [] // each lane holds the end time of its last appt
  const placed = sorted.map((a) => {
    const end = a.start.getTime() + a.durationMin * 60000
    let lane = lanes.findIndex((laneEnd) => laneEnd <= a.start.getTime())
    if (lane === -1) {
      lane = lanes.length
      lanes.push(end)
    } else {
      lanes[lane] = end
    }
    return { appt: a, lane }
  })
  return { placed, laneCount: Math.max(1, lanes.length) }
}

export default function Calendar() {
  const { appointments, patientById, activeTherapists, therapistById } = useData()
  const [therapistFilter, setTherapistFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)

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

  const days = Array.from({ length: DAYS }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  const filtered = useMemo(
    () =>
      appointments.filter(
        (a) =>
          (therapistFilter === 'all' || a.therapistId === therapistFilter) &&
          (typeFilter === 'all' || a.visitType === typeFilter),
      ),
    [appointments, therapistFilter, typeFilter],
  )

  const gridHeight = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN

  return (
    <div className="space-y-5 animate-fade">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">יומן הקליניקה</h1>
          <p className="text-slate-500 mt-0.5">תצוגה שבועית · {shortDate(days[0])}–{shortDate(days[DAYS - 1])} · 09:00–18:00</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
              className={clsx('px-2.5 h-8 rounded-lg text-sm font-medium transition',
                atThisWeek ? 'text-slate-300' : 'text-teal-700 hover:bg-teal-50')}
            >
              היום
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
          <Filter size={16} className="text-slate-400" />
          <Select value={therapistFilter} onChange={setTherapistFilter} ariaLabel="סינון לפי מטפל"
            options={[{ value: 'all', label: 'כל המטפלים' }, ...activeTherapists.map((t) => ({ value: t.id, label: t.name }))]} />
          <Select value={typeFilter} onChange={setTypeFilter} ariaLabel="סינון לפי סוג ביקור"
            options={[{ value: 'all', label: 'כל סוגי הביקור' }, ...VISIT_TYPES.map((v) => ({ value: v, label: v }))]} />
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
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${DAYS}, 1fr)` }}>
              <div className="border-b border-slate-100" />
              {days.map((d) => (
                <div key={d} className={clsx('border-b border-r border-slate-100 py-2.5 text-center',
                  isSameDay(d, new Date()) && 'bg-teal-50/60')}>
                  <p className="text-sm font-semibold text-slate-700">יום {dayName(d)}</p>
                  <p className={clsx('text-xs', isSameDay(d, new Date()) ? 'text-teal-600 font-medium' : 'text-slate-400')}>
                    {shortDate(d)}{isSameDay(d, new Date()) && ' · היום'}
                  </p>
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${DAYS}, 1fr)`, height: gridHeight }}>
              {/* Hour labels */}
              <div className="relative">
                {hours.map((h) => (
                  <div key={h} className="absolute right-2 -translate-y-1/2 text-xs text-slate-400 tabular-nums"
                    style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {days.map((d) => {
                const dayAppts = filtered.filter((a) => isSameDay(a.start, d))
                const { placed, laneCount } = layoutDay(dayAppts)
                return (
                  <div key={d} className={clsx('relative border-r border-slate-100',
                    isSameDay(d, new Date()) && 'bg-teal-50/30')}>
                    {/* hour lines */}
                    {hours.map((h) => (
                      <div key={h} className="absolute inset-x-0 border-t border-slate-100"
                        style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN }} />
                    ))}
                    {/* appointments */}
                    {placed.map(({ appt, lane }) => {
                      const t = therapistById[appt.therapistId]
                      const p = patientById[appt.patientId]
                      const startMin = appt.start.getHours() * 60 + appt.start.getMinutes() - START_HOUR * 60
                      const width = `calc(${100 / laneCount}% - 4px)`
                      const left = `calc(${(lane * 100) / laneCount}% + 2px)`
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
                          title={`${p.name} · ${appt.visitType} · ${t.name} · ${appt.status}`}
                        >
                          <p className="text-[11px] font-semibold leading-tight truncate">{hhmm(appt.start)} {p.name}</p>
                          {appt.durationMin >= 20 && (
                            <p className="text-[10px] text-white/80 truncate leading-tight">
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
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade"
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
    </div>

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
      className="h-9 rounded-xl ring-1 ring-slate-300 bg-white px-3 text-sm text-slate-700 hover:ring-teal-400 focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
