import { useMemo, useState } from 'react'
import { isToday, isThisWeek } from 'date-fns'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Clock3,
  ListTodo,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Phone,
} from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { useSession } from '../../session.jsx'
import { Card, CardHeader, Kpi, Badge, Avatar, Empty } from '../../components/ui.jsx'
import RequestRow, { REQ_COLS } from '../../components/RequestRow.jsx'
import AppointmentActions from '../../components/AppointmentActions.jsx'
import PhoneRequestDialog from '../../components/PhoneRequestDialog.jsx'
import { hhmm } from '../../lib/format.js'

export default function Dashboard() {
  const { requests, appointments, tasks, patientById, therapistById } = useData()
  const { role } = useSession()
  const [phoneOpen, setPhoneOpen] = useState(false)

  const pending = requests.filter((r) => r.status === 'ממתין')
  const todayAppts = useMemo(
    () => appointments.filter((a) => isToday(a.start)).sort((a, b) => a.start - b.start),
    [appointments],
  )
  const noShowsThisWeek = appointments.filter(
    (a) => a.status === 'לא הגיע' && isThisWeek(a.start, { weekStartsOn: 0 }),
  ).length
  const openTasks = tasks.filter((t) => t.status !== 'הושלם')

  return (
    <div className="space-y-6 animate-fade">
      {/* Page heading */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">מרכז פעילות</h1>
          <p className="text-slate-500 mt-0.5">
            שלום {role.label} 👋 הנה מה שדורש את תשומת ליבך היום.
          </p>
        </div>
        <Badge tone="teal">
          <Clock size={13} /> {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Badge>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="בקשות ממתינות" value={pending.length} icon={Clock3} tone="teal" delta={pending.length ? 'דורש טיפול' : ''} deltaTone="red" />
        <Kpi label="תורים היום" value={todayAppts.length} icon={CalendarDays} tone="blue" />
        <Kpi label="אי-הגעות (השבוע)" value={noShowsThisWeek} icon={AlertTriangle} tone="amber" />
        <Kpi label="משימות פתוחות" value={openTasks.length} icon={ListTodo} tone="green" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Requests pipeline */}
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          {/* Dark header (mockup style) */}
          <div className="flex items-center justify-between gap-3 bg-ink-900 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center h-8 w-8 rounded-lg bg-white/10 text-amber-300 shrink-0">
                <AlertTriangle size={17} />
              </span>
              <h3 className="font-semibold text-white">הפניות ובקשות טלפוניות</h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-full bg-red-500 text-white px-3 py-1 text-xs font-semibold">
                {pending.length} חדשות
              </span>
              {role.canApprove && (
                <button
                  onClick={() => setPhoneOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white px-3 h-8 text-sm font-medium transition"
                >
                  <Phone size={15} /> בקשה טלפונית
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 px-5 pt-2.5">
            רוב ההזמנות עצמיות וזורמות ישר ליומן — כאן רק מקרים שדורשים מגע אנושי (הפניה דחופה / טלפון)
          </p>
          <div className="overflow-x-auto scroll-thin">
            <div className="min-w-[460px]">
              {/* Column headers */}
              <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 text-xs font-medium text-slate-400">
                <div className={REQ_COLS.patient}>מטופל</div>
                <div className={REQ_COLS.visitType}>סוג ביקור</div>
                <div className={REQ_COLS.received}>התקבלה</div>
                <div className={REQ_COLS.spacer} />
                <div className={REQ_COLS.action} />
                <div className={REQ_COLS.chevron} />
              </div>
            <div className="max-h-[520px] overflow-y-auto scroll-thin">
              {pending.length === 0 ? (
                <Empty icon={CheckCircle2} title="הכול טופל!" hint="אין בקשות ממתינות כרגע" />
              ) : (
                pending.map((r) => <RequestRow key={r.id} request={r} canApprove={role.canApprove} />)
              )}
            </div>
          </div>
        </div>
      </Card>

        {/* Side column — today's appointments + tasks */}
        <div className="space-y-6">
          {/* Today's appointments */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader
              dark
              title="תורי היום"
              icon={CalendarDays}
              action={
                <Link to="/clinic/calendar" className="text-sm text-teal-300 hover:text-teal-200 flex items-center gap-0.5">
                  יומן מלא <ArrowLeft size={15} />
                </Link>
              }
            />
            <div className="px-3 pb-3 space-y-1.5 overflow-y-auto scroll-thin max-h-72">
              {todayAppts.length === 0 ? (
                <Empty icon={CalendarDays} title="אין תורים היום" />
              ) : (
                todayAppts.map((a) => {
                  const p = patientById[a.patientId]
                  const t = therapistById[a.therapistId]
                  return (
                    <div key={a.id} className="flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-slate-50">
                      <div className="text-center w-10 shrink-0">
                        <p className="text-sm font-bold text-slate-700 tabular-nums">{hhmm(a.start)}</p>
                        <p className="text-[10px] text-slate-400">{a.durationMin}′</p>
                      </div>
                      <span className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                        <p className="text-xs text-slate-400 truncate">{a.visitType} · {t.name}</p>
                      </div>
                      <AppointmentActions appt={a} compact />
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          {/* Tasks snapshot */}
          <Card className="flex flex-col overflow-hidden">
            <CardHeader
              dark
              title="משימות מעקב"
              icon={ListTodo}
              action={
                <Link to="/clinic/tasks" className="text-sm text-teal-300 hover:text-teal-200 flex items-center gap-0.5">
                  לוח מלא <ArrowLeft size={15} />
                </Link>
              }
            />
            <div className="px-3 pb-3 space-y-1.5 overflow-y-auto scroll-thin max-h-56">
              {openTasks.length === 0 ? (
                <Empty icon={CheckCircle2} title="אין משימות פתוחות" />
              ) : (
                openTasks.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-slate-50">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${t.status === 'בטיפול' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                    <p className="flex-1 text-sm text-slate-700 truncate">{t.title}</p>
                    {t.source === 'אוטומציה' && <Badge tone="purple">אוטומציה</Badge>}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {phoneOpen && <PhoneRequestDialog onClose={() => setPhoneOpen(false)} />}
    </div>
  )
}
