import { useMemo } from 'react'
import { isToday } from 'date-fns'
import { Link } from 'react-router-dom'
import { CalendarClock, Sparkles, ArrowLeft, Clock, ListChecks, Stethoscope, CheckCircle2 } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { useSession } from '../../session.jsx'
import { Card, CardHeader, Kpi, Badge, Avatar, Empty } from '../../components/ui.jsx'
import { hhmm } from '../../lib/format.js'
import { classifyRequest } from '../../lib/aiClassifier.js'

const STATUS_TONE = { קבוע: 'blue', הגיע: 'teal', הסתיים: 'green', 'לא הגיע': 'red' }

export default function DoctorDay() {
  const { appointments, tasks, patientById } = useData()
  const { role } = useSession()
  const myId = role.therapistId

  const todayAppts = useMemo(
    () => appointments.filter((a) => a.therapistId === myId && isToday(a.start)).sort((a, b) => a.start - b.start),
    [appointments, myId],
  )
  const myOpenTasks = tasks.filter((t) => t.assigneeId === myId && t.status !== 'הושלם')

  // "Next appointment" = first one today not yet finished.
  const next = todayAppts.find((a) => a.status === 'קבוע' || a.status === 'הגיע') || todayAppts[0]

  return (
    <div className="space-y-6 animate-fade">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">היום שלי</h1>
        <p className="text-slate-500 mt-0.5">
          {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })} · תצוגה אישית
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="תורים היום" value={todayAppts.length} icon={CalendarClock} />
        <Kpi label="הסתיימו" value={todayAppts.filter((a) => a.status === 'הסתיים').length} icon={CheckCircle2} />
        <Kpi label="ממתינים" value={todayAppts.filter((a) => a.status === 'קבוע').length} icon={Clock} />
        <Kpi label="משימות שלי" value={myOpenTasks.length} icon={ListChecks} />
      </div>

      {/* Next appointment spotlight */}
      {next && <NextCard appt={next} patient={patientById[next.patientId]} />}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="התורים שלי היום" icon={CalendarClock}
            action={<Link to="/doctor/calendar" className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-0.5">היומן שלי <ArrowLeft size={15} /></Link>} />
          <div className="px-3 pb-4 space-y-1.5">
            {todayAppts.length === 0 ? (
              <Empty icon={CalendarClock} title="אין תורים היום" />
            ) : (
              todayAppts.map((a) => {
                const p = patientById[a.patientId]
                return (
                  <Link key={a.id} to={`/doctor/visit/${a.id}`}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-slate-50 transition group">
                    <div className="text-center w-12 shrink-0">
                      <p className="text-sm font-bold text-slate-700 tabular-nums">{hhmm(a.start)}</p>
                      <p className="text-[10px] text-slate-400">{a.durationMin}′</p>
                    </div>
                    <Avatar initials={p.name.slice(0, 2)} color="#334155" size={38} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                      <p className="text-xs text-slate-400 truncate">{a.reason}</p>
                    </div>
                    <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                    <ArrowLeft size={16} className="text-slate-300 group-hover:text-teal-500" />
                  </Link>
                )
              })
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="המשימות שלי" icon={ListChecks} />
          <div className="px-3 pb-4 space-y-2">
            {myOpenTasks.length === 0 ? (
              <Empty icon={CheckCircle2} title="אין משימות פתוחות" />
            ) : (
              myOpenTasks.map((t) => (
                <div key={t.id} className="rounded-xl ring-1 ring-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-700 leading-snug">{t.title}</p>
                    {t.source === 'אוטומציה' && <Badge tone="purple">אוטומציה</Badge>}
                  </div>
                  {t.note && <p className="text-xs text-slate-400 mt-1">{t.note}</p>}
                  <Badge tone={t.status === 'בטיפול' ? 'amber' : 'slate'} className="mt-2">{t.status}</Badge>
                </div>
              ))
            )}
            <p className="text-[11px] text-slate-400 flex items-center gap-1 pt-1 px-1">
              <Stethoscope size={13} /> צפייה בלבד — סטטוס מנוהל ע״י המזכירות
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

function NextCard({ appt, patient }) {
  const ai = classifyRequest({ description: appt.reason })
  return (
    <Card className="p-5 bg-gradient-to-l from-teal-600 to-teal-500 text-white ring-0">
      <div className="flex items-center gap-2 text-teal-50 text-sm font-medium mb-3">
        <Clock size={16} /> התור הבא
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <Avatar initials={patient.name.slice(0, 2)} color="rgba(255,255,255,0.25)" size={52} />
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold">{patient.name}</p>
          <p className="text-teal-50/90 text-sm">{patient.age} · {patient.gender === 'ז' ? 'זכר' : 'נקבה'} · {patient.phone}</p>
        </div>
        <div className="text-left">
          <p className="text-3xl font-bold tabular-nums">{hhmm(appt.start)}</p>
          <p className="text-teal-50/80 text-sm">{appt.visitType}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-white/20">
        <p className="text-teal-50/80 text-sm mb-1">סיבת הפנייה:</p>
        <p className="font-medium">"{appt.reason}"</p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs text-teal-50"><Sparkles size={13} /> תגיות AI:</span>
          {ai.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">{tag}</span>
          ))}
        </div>
      </div>
      <Link to={`/doctor/visit/${appt.id}`} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white text-teal-700 font-medium px-4 h-9 hover:bg-teal-50 transition">
        פתיחת כרטיס ביקור <ArrowLeft size={16} />
      </Link>
    </Card>
  )
}
