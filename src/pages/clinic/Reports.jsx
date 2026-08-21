import { useMemo, useState } from 'react'
import { Sparkles, TrendingUp, TrendingDown, Gauge, UserX, PieChart, AlertTriangle, ListChecks, Clock, Users, CheckCircle2, Filter } from 'lucide-react'
import { startOfDay, subDays, addDays } from 'date-fns'
import { useData } from '../../data/store.jsx'
import { Card, CardHeader, Kpi, Avatar, Empty } from '../../components/ui.jsx'
import { isUnresolvedPast } from '../../lib/appointments.js'
import { useNow } from '../../lib/useNow.js'
import { dayName } from '../../lib/format.js'
import { VISIT_TYPES } from '../../data/seed.js'

const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳']
const TYPE_COLORS = ['#0d9488', '#2563eb', '#9333ea', '#f59e0b', '#ef4444']

// Duration in Hebrew — used for the average time-to-close task KPI.
function formatDuration(ms) {
  const hours = ms / 3.6e6
  if (hours < 1) return 'פחות משעה'
  if (hours < 24) return `${Math.round(hours)} שע׳`
  return `${(hours / 24).toFixed(1)} ימים`
}

export default function Reports() {
  const { appointments, tasks, assignees, assigneeById, activeTherapists } = useData()
  const now = useNow()

  // Manager's one active control: scope the appointment analytics (KPIs + charts
  // below) to a single therapist, or 'all' for the whole clinic. The AI summary, the
  // data-integrity notice and the tasks section stay clinic-wide regardless.
  const [therapistFilter, setTherapistFilter] = useState('all')
  const scopedAppointments = useMemo(
    () => (therapistFilter === 'all'
      ? appointments
      : appointments.filter((a) => a.therapistId === therapistFilter)),
    [appointments, therapistFilter],
  )

  // Clinic capacity is 12 slots/day; when scoped to one therapist, divide by the
  // active-therapist count so the occupancy % stays meaningful (not artificially low).
  const CAPACITY = 12
  const capacity = therapistFilter === 'all'
    ? CAPACITY
    : Math.max(1, Math.round(CAPACITY / (activeTherapists.length || 1)))

  // Occupancy per day (Sun–Thu) for the scoped appointments.
  const perDay = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]
    scopedAppointments.forEach((a) => {
      const d = a.start.getDay()
      if (d >= 0 && d <= 4) counts[d] += 1
    })
    return counts
  }, [scopedAppointments])

  const totalBooked = perDay.reduce((s, n) => s + n, 0)
  const occupancy = Math.round((totalBooked / (capacity * 5)) * 100)

  const noShows = scopedAppointments.filter((a) => a.status === 'לא הגיע').length
  const completedOrPast = scopedAppointments.filter((a) => ['לא הגיע', 'הסתיים', 'הגיע'].includes(a.status)).length
  const noShowRate = completedOrPast ? Math.round((noShows / completedOrPast) * 100) : 0

  // Clinic-wide figures for the AI summary + the data-integrity notice — always the
  // whole clinic, independent of the therapist filter. Past appointments left as 'קבוע'
  // are excluded from the no-show base, so while any remain the rate is provisional; the
  // unresolved count nudges the manager to resolve them (from the clinic Dashboard).
  const clinicStats = useMemo(() => {
    const total = appointments.filter((a) => { const d = a.start.getDay(); return d >= 0 && d <= 4 }).length
    const occ = Math.round((total / (CAPACITY * 5)) * 100)
    const ns = appointments.filter((a) => a.status === 'לא הגיע').length
    const base = appointments.filter((a) => ['לא הגיע', 'הסתיים', 'הגיע'].includes(a.status)).length
    const nsRate = base ? Math.round((ns / base) * 100) : 0
    const unresolved = appointments.filter((a) => isUnresolvedPast(a)).length
    return { total, occ, nsRate, unresolved }
  }, [appointments])

  const typeBreakdown = useMemo(() => {
    const map = Object.fromEntries(VISIT_TYPES.map((v) => [v, 0]))
    scopedAppointments.forEach((a) => {
      map[a.visitType] = (map[a.visitType] || 0) + 1
    })
    const total = scopedAppointments.length || 1
    return VISIT_TYPES.map((v, i) => ({
      label: v,
      count: map[v],
      pct: Math.round((map[v] / total) * 100),
      color: TYPE_COLORS[i % TYPE_COLORS.length],
    }))
  }, [scopedAppointments])

  // 4-week no-show trend for the demo (declining = good). The final point is
  // the live computed rate so the graph and the KPI stay in sync.
  const noShowTrend = [24, 19, 15, noShowRate]

  // --- Task analytics ---
  // Overdue rule matches the clinic Dashboard: not done AND past its due date.
  const taskStats = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'הושלם')
    const overdue = open.filter((t) => t.due < now)
    const completed = tasks.filter((t) => t.status === 'הושלם')
    const completionRate = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0

    // Avg time-to-close = mean(completedAt − createdAt) over completed tasks that have both.
    const durations = completed.filter((t) => t.completedAt && t.createdAt).map((t) => t.completedAt - t.createdAt)
    const avgMs = durations.length ? durations.reduce((s, ms) => s + ms, 0) / durations.length : 0

    // On-time % = of completed tasks with a due date, the share finished on/before it.
    const dueCompleted = completed.filter((t) => t.completedAt && t.due)
    const onTimePct = dueCompleted.length
      ? Math.round((dueCompleted.filter((t) => t.completedAt <= t.due).length / dueCompleted.length) * 100)
      : 0

    return { open: open.length, overdue: overdue.length, completionRate, avgMs, onTimePct }
  }, [tasks, now])

  // Workload per assignee: open tasks (overdue highlighted), busiest first. An
  // "ללא אחראי" bucket collects unassigned open tasks so nothing is invisible.
  const workload = useMemo(() => {
    const rows = assignees.map((a) => {
      const mine = tasks.filter((t) => t.assigneeId === a.id && t.status !== 'הושלם')
      return { id: a.id, name: a.name, initials: a.initials, color: a.color, open: mine.length, overdue: mine.filter((t) => t.due < now).length }
    })
    const orphan = tasks.filter((t) => !t.assigneeId && t.status !== 'הושלם')
    if (orphan.length) {
      rows.push({ id: 'none', name: 'ללא אחראי', initials: '—', color: '#94a3b8', open: orphan.length, overdue: orphan.filter((t) => t.due < now).length })
    }
    return rows.filter((r) => r.open > 0).sort((a, b) => b.open - a.open)
  }, [tasks, assignees, now])
  const maxOpen = workload.reduce((m, r) => Math.max(m, r.open), 0) || 1

  // Completion throughput: tasks completed per day over the last 7 days.
  const completionTrend = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(subDays(now, i))
      const next = addDays(day, 1)
      const count = tasks.filter((t) => t.completedAt && t.completedAt >= day && t.completedAt < next).length
      days.push({ label: dayName(day).charAt(0), count })
    }
    return days
  }, [tasks, now])
  const maxDone = completionTrend.reduce((m, d) => Math.max(m, d.count), 0) || 1

  return (
    <div className="space-y-6 animate-fade">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">דוחות ואנליטיקה</h1>
        <p className="text-slate-500 mt-0.5">גישת מנהל/ת בלבד · תמונת מצב שבועית לקבלת החלטות</p>
      </div>

      {/* AI weekly summary */}
      <Card className="p-5 bg-gradient-to-l from-teal-50 to-white ring-teal-100">
        <div className="flex items-center gap-2 text-teal-700 font-semibold mb-2">
          <Sparkles size={18} /> סיכום שבועי חכם (AI)
        </div>
        <p className="text-slate-700 leading-relaxed">
          השבוע נקבעו <b>{clinicStats.total}</b> תורים בתפוסה של <b>{clinicStats.occ}%</b>. שיעור אי-ההגעות ירד ל־
          <b> {clinicStats.nsRate}%</b> — מגמת שיפור מתמשכת בזכות התזכורות האוטומטיות. עומס השיא הוא בימי
          ראשון–שני בבוקר. <b>המלצה:</b> להוסיף משבצת בוקר אצל ד״ר אבני בימי ראשון ולהפעיל תזכורת
          נוספת 3 שעות לפני התור לבקשות שסווגו כ״דחוף״.
          {clinicStats.unresolved > 0 && (
            <> <b>שים/י לב:</b> {clinicStats.unresolved} תורים מהעבר טרם סומנו — שיעור אי-ההגעות חלקי עד לעדכונם.</>
          )}
        </p>
      </Card>

      {/* Therapist filter — scopes the appointment analytics below (KPIs + charts).
          The AI summary above, the data-integrity notice and the tasks section stay clinic-wide. */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-sm text-slate-500">
          <Filter size={15} className="text-slate-400" /> פילוח נתוני התורים לפי מטפל:
        </span>
        <select
          value={therapistFilter}
          onChange={(e) => setTherapistFilter(e.target.value)}
          className="h-9 rounded-xl ring-1 ring-slate-300 bg-white px-3 text-sm text-slate-700 hover:ring-teal-400 focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer"
        >
          <option value="all">כל המטפלים</option>
          {activeTherapists.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* KPIs — scoped to the selected therapist */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="תפוסה שבועית" value={`${occupancy}%`} icon={Gauge} delta="+6%" deltaTone="green" />
        <Kpi label="שיעור אי-הגעות" value={`${noShowRate}%`} icon={UserX} delta="-3%" deltaTone="green" />
        <Kpi label="תורים שבועיים" value={totalBooked} icon={TrendingUp} />
        <Kpi label="בקשות דיגיטליות" value="52%" icon={PieChart} delta="יעד 50%" deltaTone="green" />
      </div>

      {/* Data-integrity notice: the no-show rate is provisional while past
          appointments remain unmarked. Resolution happens on the Dashboard. */}
      {clinicStats.unresolved > 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={17} className="text-amber-600 shrink-0" />
          <span>
            <b>{clinicStats.unresolved}</b> תורים מהעבר טרם סומנו (הגיע/לא הגיע) — הנתונים חלקיים עד לעדכונם בלוח הבקרה.
          </span>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Occupancy per day */}
        <Card>
          <CardHeader title="תפוסה לפי יום" subtitle={`מספר תורים · קיבולת ${capacity} ליום`} icon={Gauge} />
          <div className="px-5 pb-6 pt-2">
            <div className="flex items-end justify-between gap-3 h-48">
              {perDay.map((n, i) => {
                const pct = Math.round((n / capacity) * 100)
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 tabular-nums">{n}</span>
                    <div className="w-full bg-slate-100 rounded-lg relative" style={{ height: '150px' }}>
                      <div
                        className="absolute bottom-0 inset-x-0 rounded-lg bg-gradient-to-t from-teal-600 to-teal-400 transition-all"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{DAY_LABELS[i]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        {/* No-show trend */}
        <Card>
          <CardHeader title="מגמת אי-הגעות" subtitle="4 שבועות אחרונים · %" icon={TrendingDown} />
          <div className="px-5 pb-6 pt-4">
            <TrendLine values={noShowTrend} />
            <div className="flex justify-between mt-3 text-xs text-slate-400">
              {['לפני 3 שב׳', 'לפני שבועיים', 'שבוע שעבר', 'השבוע'].map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
            <p className="mt-4 text-sm text-emerald-600 flex items-center gap-1">
              <TrendingDown size={15} /> ירידה של כ-50% מאז הפעלת התזכורות
            </p>
          </div>
        </Card>

        {/* Visit type breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader title="פילוח סוגי ביקור" icon={PieChart} />
          <div className="px-5 pb-6 pt-2 space-y-3">
            {typeBreakdown.map((t) => (
              <div key={t.label} className="flex items-center gap-3">
                <span className="w-32 text-sm text-slate-600 shrink-0">{t.label}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                  <div className="h-full rounded-lg transition-all flex items-center justify-end px-2"
                    style={{ width: `${Math.max(t.pct, 3)}%`, backgroundColor: t.color }}>
                    {t.pct >= 12 && <span className="text-[11px] text-white font-medium">{t.pct}%</span>}
                  </div>
                </div>
                <span className="w-10 text-sm text-slate-500 tabular-nums text-left">{t.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Tasks ── */}
      <div className="pt-2">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <ListChecks size={20} className="text-teal-600" /> משימות
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">עומס, עמידה ביעדים וקצב טיפול של צוות הקליניקה</p>
      </div>

      {/* Task KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="משימות פתוחות" value={taskStats.open} icon={ListChecks} tone="blue" />
        <Kpi label="משימות באיחור" value={taskStats.overdue} icon={AlertTriangle} tone="red" accent={taskStats.overdue > 0 ? 'red' : undefined} />
        <Kpi label="שיעור השלמה" value={`${taskStats.completionRate}%`} icon={CheckCircle2} tone="green" />
        <Kpi label="זמן טיפול ממוצע" value={formatDuration(taskStats.avgMs)} icon={Clock} tone="purple" sub={`${taskStats.onTimePct}% בזמן`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Workload by assignee */}
        <Card>
          <CardHeader title="עומס לפי אחראי/ת" subtitle="משימות פתוחות · באיחור מודגש באדום" icon={Users} />
          <div className="px-5 pb-6 pt-2">
            {workload.length === 0 ? (
              <Empty icon={ListChecks} title="אין משימות פתוחות" />
            ) : (
              <div className="space-y-3">
                {workload.map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="w-32 flex items-center gap-2 shrink-0 min-w-0">
                      <Avatar initials={r.initials} color={r.color} size={24} />
                      <span className="text-sm text-slate-600 truncate">{r.name}</span>
                    </span>
                    <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden flex">
                      <div className="h-full bg-teal-500 transition-all" style={{ width: `${((r.open - r.overdue) / maxOpen) * 100}%` }} />
                      {r.overdue > 0 && (
                        <div className="h-full bg-red-500 transition-all" style={{ width: `${(r.overdue / maxOpen) * 100}%` }} />
                      )}
                    </div>
                    <span className="w-24 text-sm text-slate-500 tabular-nums text-left shrink-0">
                      {r.open}{r.overdue > 0 && <span className="text-red-500"> · {r.overdue} באיחור</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Completion throughput */}
        <Card>
          <CardHeader title="מגמת השלמות" subtitle="משימות שהושלמו · 7 ימים אחרונים" icon={CheckCircle2} />
          <div className="px-5 pb-6 pt-2">
            <div className="flex items-end justify-between gap-3 h-48">
              {completionTrend.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 tabular-nums">{d.count}</span>
                  <div className="w-full bg-slate-100 rounded-lg relative" style={{ height: '150px' }}>
                    <div
                      className="absolute bottom-0 inset-x-0 rounded-lg bg-gradient-to-t from-teal-600 to-teal-400 transition-all"
                      style={{ height: `${d.count === 0 ? 2 : Math.max((d.count / maxDone) * 100, 4)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function TrendLine({ values }) {
  const w = 100
  const h = 40
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / span) * (h - 8) - 4
    return [x, y]
  })
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const area = `${path} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#tg)" />
      <path d={path} fill="none" stroke="#0d9488" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.8" fill="#0d9488" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}
