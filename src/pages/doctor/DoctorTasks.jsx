import { useMemo } from 'react'
import { ListChecks, Zap, User, Clock, Eye } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { useSession } from '../../session.jsx'
import { Card, Badge, Empty } from '../../components/ui.jsx'
import { friendlyDate, hhmm } from '../../lib/format.js'
import { clsx } from '../../components/clsx.js'

const COLUMNS = [
  { key: 'פתוח', accent: 'bg-slate-400' },
  { key: 'בטיפול', accent: 'bg-amber-500' },
  { key: 'הושלם', accent: 'bg-emerald-500' },
]

export default function DoctorTasks() {
  const { tasks, patientById } = useData()
  const { role } = useSession()
  const myId = role.therapistId

  // Only tasks assigned to (owned by) this therapist — read-only view.
  const myTasks = useMemo(() => tasks.filter((t) => t.assigneeId === myId), [tasks, myId])

  return (
    <div className="space-y-5 animate-fade">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">לוח משימות</h1>
        <p className="text-slate-500 mt-0.5">המשימות שמשויכות אליי · מעקב בלבד</p>
      </div>

      {myTasks.length === 0 ? (
        <Card className="py-4">
          <Empty icon={ListChecks} title="אין משימות משויכות אליך" />
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {COLUMNS.map((col) => {
            const items = myTasks.filter((t) => t.status === col.key)
            return (
              <div key={col.key} className="flex flex-col">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={clsx('h-2.5 w-2.5 rounded-full', col.accent)} />
                  <h2 className="font-semibold text-slate-700">{col.key}</h2>
                  <span className="text-sm text-slate-400">· {items.length}</span>
                </div>
                <div className="space-y-3 flex-1 min-h-24">
                  {items.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 py-8">
                      <Empty icon={ListChecks} title="אין משימות" />
                    </div>
                  ) : (
                    items.map((t) => {
                      const patient = t.patientId ? patientById[t.patientId] : null
                      return (
                        <Card key={t.id} className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-slate-800 leading-snug">{t.title}</p>
                            {t.source === 'אוטומציה' ? (
                              <Badge tone="purple"><Zap size={12} /> אוטומציה</Badge>
                            ) : (
                              <Badge tone="slate"><User size={12} /> ידני</Badge>
                            )}
                          </div>
                          {t.note && <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{t.note}</p>}
                          <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1"><Clock size={12} /> {friendlyDate(t.due)} · {hhmm(t.due)}</span>
                            {patient && <span>{patient.name}</span>}
                          </div>
                        </Card>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400 flex items-center gap-1 px-1">
        <Eye size={13} /> סטטוס המשימות מנוהל ע״י המזכירות
      </p>
    </div>
  )
}
