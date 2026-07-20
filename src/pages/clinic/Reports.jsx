import { useMemo } from 'react'
import { Sparkles, TrendingUp, TrendingDown, Gauge, UserX, PieChart } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { Card, CardHeader, Kpi } from '../../components/ui.jsx'
import { VISIT_TYPES } from '../../data/seed.js'

const DAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳']
const TYPE_COLORS = ['#0d9488', '#2563eb', '#9333ea', '#f59e0b', '#ef4444']

export default function Reports() {
  const { appointments } = useData()

  // Occupancy per day (Sun–Thu), capacity assumed 12 slots/day.
  const CAPACITY = 12
  const perDay = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]
    appointments.forEach((a) => {
      const d = a.start.getDay()
      if (d >= 0 && d <= 4) counts[d] += 1
    })
    return counts
  }, [appointments])

  const totalBooked = perDay.reduce((s, n) => s + n, 0)
  const occupancy = Math.round((totalBooked / (CAPACITY * 5)) * 100)

  const noShows = appointments.filter((a) => a.status === 'לא הגיע').length
  const completedOrPast = appointments.filter((a) => ['לא הגיע', 'הסתיים', 'הגיע'].includes(a.status)).length
  const noShowRate = completedOrPast ? Math.round((noShows / completedOrPast) * 100) : 0

  const typeBreakdown = useMemo(() => {
    const map = Object.fromEntries(VISIT_TYPES.map((v) => [v, 0]))
    appointments.forEach((a) => {
      map[a.visitType] = (map[a.visitType] || 0) + 1
    })
    const total = appointments.length || 1
    return VISIT_TYPES.map((v, i) => ({
      label: v,
      count: map[v],
      pct: Math.round((map[v] / total) * 100),
      color: TYPE_COLORS[i % TYPE_COLORS.length],
    }))
  }, [appointments])

  // 4-week no-show trend for the demo (declining = good). The final point is
  // the live computed rate so the graph and the KPI stay in sync.
  const noShowTrend = [24, 19, 15, noShowRate]

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
          השבוע נקבעו <b>{totalBooked}</b> תורים בתפוסה של <b>{occupancy}%</b>. שיעור אי-ההגעות ירד ל־
          <b> {noShowRate}%</b> — מגמת שיפור מתמשכת בזכות התזכורות האוטומטיות. עומס השיא הוא בימי
          ראשון–שני בבוקר. <b>המלצה:</b> להוסיף משבצת בוקר אצל ד״ר אבני בימי ראשון ולהפעיל תזכורת
          נוספת 3 שעות לפני התור לבקשות שסווגו כ״דחוף״.
        </p>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="תפוסה שבועית" value={`${occupancy}%`} icon={Gauge} delta="+6%" deltaTone="green" />
        <Kpi label="שיעור אי-הגעות" value={`${noShowRate}%`} icon={UserX} delta="-3%" deltaTone="green" />
        <Kpi label="תורים שבועיים" value={totalBooked} icon={TrendingUp} />
        <Kpi label="בקשות דיגיטליות" value="52%" icon={PieChart} delta="יעד 50%" deltaTone="green" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Occupancy per day */}
        <Card>
          <CardHeader title="תפוסה לפי יום" subtitle="מספר תורים · קיבולת 12 ליום" icon={Gauge} />
          <div className="px-5 pb-6 pt-2">
            <div className="flex items-end justify-between gap-3 h-48">
              {perDay.map((n, i) => {
                const pct = Math.round((n / CAPACITY) * 100)
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
