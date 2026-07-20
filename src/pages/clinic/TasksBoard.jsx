import { useState } from 'react'
import { ListChecks, Plus, Zap, User, ArrowLeftRight, Check, Clock } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { Card, Badge, Button, Avatar, Empty } from '../../components/ui.jsx'
import { friendlyDate, hhmm } from '../../lib/format.js'
import { clsx } from '../../components/clsx.js'

const COLUMNS = [
  { key: 'פתוח', tone: 'slate', accent: 'bg-slate-400' },
  { key: 'בטיפול', tone: 'amber', accent: 'bg-amber-500' },
  { key: 'הושלם', tone: 'green', accent: 'bg-emerald-500' },
]

const NEXT = { פתוח: 'בטיפול', בטיפול: 'הושלם' }

export default function TasksBoard() {
  const { tasks, patientById, therapistById, setTaskStatus, addTask, therapists } = useData()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-5 animate-fade">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">לוח משימות</h1>
          <p className="text-slate-500 mt-0.5">יצירה, שיוך לאחראי ומעקב · משימות אוטומטיות מסומנות בתגית</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus size={17} /> משימה חדשה
        </Button>
      </div>

      {showForm && (
        <NewTaskForm
          therapists={therapists}
          onCancel={() => setShowForm(false)}
          onCreate={(t) => {
            addTask(t)
            setShowForm(false)
          }}
        />
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.key)
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
                    const assignee = t.assigneeId ? therapistById[t.assigneeId] : null
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
                        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1"><Clock size={12} /> {friendlyDate(t.due)} · {hhmm(t.due)}</span>
                          {assignee && (
                            <span className="flex items-center gap-1">
                              <Avatar initials={assignee.initials} color={assignee.color} size={18} />
                              {assignee.name}
                            </span>
                          )}
                        </div>
                        {NEXT[t.status] && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <Button variant="soft" size="sm" className="w-full" onClick={() => setTaskStatus(t.id, NEXT[t.status])}>
                              {t.status === 'פתוח' ? <ArrowLeftRight size={14} /> : <Check size={14} />}
                              העבר ל״{NEXT[t.status]}״
                            </Button>
                          </div>
                        )}
                      </Card>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NewTaskForm({ therapists, onCreate, onCancel }) {
  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState(therapists[0].id)
  const [note, setNote] = useState('')

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-slate-800 mb-3">משימה חדשה</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="כותרת המשימה"
          className="h-10 rounded-xl ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 sm:col-span-2"
        />
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="h-10 rounded-xl ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white"
        >
          {therapists.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="הערה (רשות)"
          className="h-10 rounded-xl ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>
      <div className="flex gap-2 mt-4">
        <Button disabled={!title.trim()} onClick={() => onCreate({ title: title.trim(), assigneeId, note: note.trim() })}>
          <Plus size={16} /> הוספה
        </Button>
        <Button variant="ghost" onClick={onCancel}>ביטול</Button>
      </div>
    </Card>
  )
}
