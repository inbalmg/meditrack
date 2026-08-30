import { useMemo, useState } from 'react'
import { addDays, isSameDay, subMonths } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, ChevronLeft, Ban } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { useSession } from '../../session.jsx'
import { Card } from '../../components/ui.jsx'
import {
  hhmm, dayName, shortDate, friendlyDate,
  weekStartOf, maxBookingWeekStart, BOOKING_HORIZON_MONTHS,
} from '../../lib/format.js'
import { clsx } from '../../components/clsx.js'
import { VISIT_TYPE_SHORT } from '../../data/seed.js'
import BlockDialog from '../../components/BlockDialog.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'

const PX_PER_MIN = 1.6

export default function DoctorCalendar() {
  const { appointments, patientById, therapistById, settings, blocks, removeBlock } = useData()
  // Operating window (Settings): active weekdays + uniform daily hours [start, end).
  const workDays = settings.workDays
  const startHour = settings.workStartHour
  const endHour = settings.workEndHour
  const { role } = useSession()
  const navigate = useNavigate()
  const myId = role.therapistId
  const me = therapistById[myId]
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockToEdit, setBlockToEdit] = useState(null)
  const [blockToRemove, setBlockToRemove] = useState(null)
  // Blocks that affect this therapist: their own + clinic-wide (therapist_id null).
  const myBlocks = blocks.filter((b) => b.therapistId === myId || b.therapistId === null)

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
    if (next >= minWeekStart && next <= maxWeekStart) setWeekStart(next)
  }

  // Columns = the clinic's active weekdays (weekStart is Sunday); rows = operating hours.
  const days = [...workDays].sort((a, b) => a - b).map((dow) => addDays(weekStart, dow))
  const hours = Array.from({ length: Math.max(0, endHour - startHour) }, (_, i) => startHour + i)
  const gridHeight = Math.max(0, endHour - startHour) * 60 * PX_PER_MIN

  const mine = useMemo(() => appointments.filter((a) => a.therapistId === myId), [appointments, myId])

  return (
    <div className="space-y-5 animate-fade">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">היומן שלי</h1>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <p className="text-slate-500">{me.name} · רק התורים שלי · {shortDate(days[0])}–{shortDate(days[days.length - 1])}</p>
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
          <button
            onClick={() => setBlockOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-amber-700 ring-1 ring-amber-200 bg-white hover:bg-amber-50 transition"
          >
            <Ban size={15} /> חסימת זמן
          </button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <div className="min-w-[720px]">
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
              <div className="border-b border-slate-100" />
              {days.map((d) => (
                <div key={d} className={clsx('border-b border-r border-slate-100 py-2.5 text-center', isSameDay(d, new Date()) && 'bg-teal-50/60')}>
                  <p className="text-sm font-semibold text-slate-700">יום {dayName(d)}</p>
                  <p className={clsx('text-xs', isSameDay(d, new Date()) ? 'text-teal-600 font-medium' : 'text-slate-400')}>
                    {shortDate(d)}{isSameDay(d, new Date()) && ' · היום'}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, height: gridHeight }}>
              <div className="relative">
                {hours.map((h) => (
                  <div key={h} className="absolute right-2 -translate-y-1/2 text-xs text-slate-400 tabular-nums" style={{ top: (h - startHour) * 60 * PX_PER_MIN }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              {days.map((d) => {
                const dayAppts = mine.filter((a) => isSameDay(a.start, d)).sort((a, b) => a.start - b.start)
                return (
                  <div key={d} className={clsx('relative border-r border-slate-100', isSameDay(d, new Date()) && 'bg-teal-50/30')}>
                    {hours.map((h) => (
                      <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (h - startHour) * 60 * PX_PER_MIN }} />
                    ))}
                    {/* manual blocks affecting me (own + clinic-wide). Own blocks are removable. */}
                    {myBlocks.filter((b) => isSameDay(b.start, d)).map((b) => {
                      const bStartMin = b.start.getHours() * 60 + b.start.getMinutes() - startHour * 60
                      const isMine = b.therapistId === myId
                      const label = isMine ? (b.reason || 'חסום') : `${b.reason || 'חסום'} · כל הקליניקה`
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => isMine && setBlockToEdit(b)}
                          title={`חסימה · ${label}${isMine ? ' — לחצו לעריכה או הסרה' : ''}`}
                          className={clsx(
                            'absolute inset-x-1 rounded-lg bg-slate-200/80 ring-1 ring-slate-400/40 text-slate-600 overflow-hidden text-right transition',
                            isMine ? 'hover:bg-slate-300/80 cursor-pointer' : 'cursor-default',
                          )}
                          style={{
                            top: bStartMin * PX_PER_MIN + 1,
                            height: b.durationMin * PX_PER_MIN - 2,
                            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(100,116,139,0.14) 5px, rgba(100,116,139,0.14) 10px)',
                          }}
                        >
                          <span className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-bold truncate">
                            <Ban size={12} className="shrink-0" /> {label}
                          </span>
                        </button>
                      )
                    })}
                    {dayAppts.map((a) => {
                      const p = patientById[a.patientId]
                      // A newly self-booked patient's appointment can stream in over Realtime
                      // before their patient row does — fall back so it never white-screens.
                      const patientName = p?.name ?? 'מטופל/ת'
                      const startMin = a.start.getHours() * 60 + a.start.getMinutes() - startHour * 60
                      return (
                        <button
                          key={a.id}
                          onClick={() => navigate(`/doctor/visit/${a.id}`)}
                          className="absolute inset-x-1 rounded-lg px-2 py-0.5 text-white text-right overflow-hidden shadow-sm hover:brightness-110 transition"
                          style={{ top: startMin * PX_PER_MIN + 1, height: a.durationMin * PX_PER_MIN - 2, backgroundColor: me.color }}
                          title={`${patientName} · ${a.visitType}`}
                        >
                          <p className="text-xs font-bold leading-tight truncate">
                            <span className="font-medium text-white/70">{hhmm(a.start)}</span> {patientName}
                          </p>
                          {a.durationMin >= 20 && (
                            <p className="text-[11px] text-white/75 truncate leading-tight">
                              {VISIT_TYPE_SHORT[a.visitType] || a.visitType}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>
      <p className="text-xs text-slate-400 flex items-center gap-1.5"><CalendarDays size={14} /> לחיצה על תור פותחת את כרטיס המטופל · חסימות מסומנות באפור.</p>

      {blockOpen && <BlockDialog onClose={() => setBlockOpen(false)} lockedTherapistId={myId} />}

      {blockToEdit && (
        <BlockDialog
          editBlock={blockToEdit}
          lockedTherapistId={myId}
          onClose={() => setBlockToEdit(null)}
          onRemove={() => { const b = blockToEdit; setBlockToEdit(null); setBlockToRemove(b) }}
        />
      )}

      {blockToRemove && (
        <ConfirmDialog
          title="הסרת החסימה?"
          message={`${friendlyDate(blockToRemove.start)} בשעה ${hhmm(blockToRemove.start)} · ${blockToRemove.durationMin} דק׳${blockToRemove.reason ? ' · ' + blockToRemove.reason : ''}`}
          confirmLabel="כן, הסר/י חסימה"
          cancelLabel="חזרה"
          onConfirm={() => { removeBlock(blockToRemove.id); setBlockToRemove(null) }}
          onClose={() => setBlockToRemove(null)}
        />
      )}
    </div>
  )
}
