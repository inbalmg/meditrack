import { useMemo, useState } from 'react'
import { addDays, isSameDay, subMonths } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Eye, ChevronRight, ChevronLeft } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { useSession } from '../../session.jsx'
import { Card, Badge } from '../../components/ui.jsx'
import {
  hhmm, dayName, shortDate,
  weekStartOf, maxBookingWeekStart, BOOKING_HORIZON_MONTHS,
} from '../../lib/format.js'
import { clsx } from '../../components/clsx.js'
import { VISIT_TYPE_SHORT } from '../../data/seed.js'

const START_HOUR = 9
const END_HOUR = 18
const PX_PER_MIN = 1.6
const DAYS = 5

export default function DoctorCalendar() {
  const { appointments, patientById, therapistById } = useData()
  const { role } = useSession()
  const navigate = useNavigate()
  const myId = role.therapistId
  const me = therapistById[myId]

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

  const days = Array.from({ length: DAYS }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const gridHeight = (END_HOUR - START_HOUR) * 60 * PX_PER_MIN

  const mine = useMemo(() => appointments.filter((a) => a.therapistId === myId), [appointments, myId])

  return (
    <div className="space-y-5 animate-fade">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">היומן שלי</h1>
          <p className="text-slate-500 mt-0.5">{me.name} · רק התורים שלי · {shortDate(days[0])}–{shortDate(days[DAYS - 1])}</p>
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
          <Badge tone="slate"><Eye size={13} /> ללא בורר מטפל</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <div className="min-w-[720px]">
            <div className="grid" style={{ gridTemplateColumns: `56px repeat(${DAYS}, 1fr)` }}>
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
            <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(${DAYS}, 1fr)`, height: gridHeight }}>
              <div className="relative">
                {hours.map((h) => (
                  <div key={h} className="absolute right-2 -translate-y-1/2 text-xs text-slate-400 tabular-nums" style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN }}>
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>
              {days.map((d) => {
                const dayAppts = mine.filter((a) => isSameDay(a.start, d)).sort((a, b) => a.start - b.start)
                return (
                  <div key={d} className={clsx('relative border-r border-slate-100', isSameDay(d, new Date()) && 'bg-teal-50/30')}>
                    {hours.map((h) => (
                      <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (h - START_HOUR) * 60 * PX_PER_MIN }} />
                    ))}
                    {dayAppts.map((a) => {
                      const p = patientById[a.patientId]
                      const startMin = a.start.getHours() * 60 + a.start.getMinutes() - START_HOUR * 60
                      return (
                        <button
                          key={a.id}
                          onClick={() => navigate(`/doctor/visit/${a.id}`)}
                          className="absolute inset-x-1 rounded-lg px-2 py-0.5 text-white text-right overflow-hidden shadow-sm hover:brightness-110 transition"
                          style={{ top: startMin * PX_PER_MIN + 1, height: a.durationMin * PX_PER_MIN - 2, backgroundColor: me.color }}
                          title={`${p.name} · ${a.visitType}`}
                        >
                          <p className="text-[11px] font-semibold leading-tight truncate">{hhmm(a.start)} {p.name}</p>
                          {a.durationMin >= 20 && (
                            <p className="text-[10px] text-white/80 truncate leading-tight">
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
      <p className="text-xs text-slate-400 flex items-center gap-1.5"><CalendarDays size={14} /> לחיצה על תור פותחת את כרטיס הביקור (צפייה בלבד).</p>
    </div>
  )
}
