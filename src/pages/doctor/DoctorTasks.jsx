import { useMemo, useState } from 'react'
import { ListChecks, Zap, User, Clock, Plus, Check, ArrowLeftRight, Pencil, Trash2, Archive } from 'lucide-react'
import { isAfter, startOfDay, subDays } from 'date-fns'
import { useData } from '../../data/store.jsx'
import { useSession } from '../../session.jsx'
import { Card, Badge, Button, Empty } from '../../components/ui.jsx'
import TaskArchiveModal from '../../components/TaskArchiveModal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { friendlyDate, hhmm } from '../../lib/format.js'
import { clsx } from '../../components/clsx.js'

const COLUMNS = [
  { key: 'פתוח', accent: 'bg-slate-400' },
  { key: 'בטיפול', accent: 'bg-amber-500' },
  { key: 'הושלם', accent: 'bg-emerald-500' },
]

const NEXT = { פתוח: 'בטיפול', בטיפול: 'הושלם' }

// Recency windows for the "הושלם" column, so completed tasks don't pile up. Default is
// "השבוע" (matches the clinic board). The practitioner board has no all-time view.
const DONE_RANGES = [
  { key: 'today', label: 'היום', days: 0 },
  { key: 'week', label: 'השבוע', days: 7 },
]

// When a completed task was finished. Falls back to due/createdAt for legacy rows
// with no completedAt stamp, so the filter still behaves reasonably without backfill.
const doneAnchor = (t) => t.completedAt ?? t.due ?? t.createdAt

function withinRange(t, range) {
  const anchor = doneAnchor(t)
  if (!anchor) return true
  const days = DONE_RANGES.find((r) => r.key === range)?.days ?? 7
  const cutoff = days === 0 ? startOfDay(new Date()) : subDays(new Date(), days)
  return isAfter(anchor, cutoff)
}

// Date <-> <input type="datetime-local"> value (local time, minute precision).
const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function DoctorTasks() {
  const { tasks, patientById, addTask, updateTask, setTaskStatus, deleteTask } = useData()
  const { role, userId } = useSession()
  const myId = role.therapistId
  // Form target: null (closed) · 'new' (create) · a task object (edit).
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  // Recency window for the completed column (default: recent week).
  const [doneRange, setDoneRange] = useState('week')
  // Task Archive modal (my full completed backlog, loaded on demand, RLS-scoped to me).
  const [archiveOpen, setArchiveOpen] = useState(false)

  // Practitioner scope — MY tasks only: assigned to my therapist id OR created by me.
  // This mirrors the therapist RLS policy (migration 12: assignee_id = app.therapist_id()
  // OR created_by = auth.uid()) so every column, active and completed, is strictly bound
  // to the logged-in practitioner.
  const myTasks = useMemo(
    () => tasks.filter((t) => t.assigneeId === myId || t.createdBy === userId),
    [tasks, myId, userId],
  )

  return (
    <div className="space-y-5 animate-fade">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">לוח משימות</h1>
          <p className="text-slate-500 mt-0.5">המשימות שלי · יצירה ועדכון סטטוס</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setArchiveOpen(true)}>
            <Archive size={17} /> ארכיון
          </Button>
          <Button onClick={() => setEditing((e) => (e === 'new' ? null : 'new'))}>
            <Plus size={17} /> משימה חדשה
          </Button>
        </div>
      </div>

      {editing && (
        <TaskForm
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSubmit={(data) => {
            if (editing === 'new') addTask({ ...data, assigneeId: myId })
            else updateTask(editing.id, data)
            setEditing(null)
          }}
        />
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const isDone = col.key === 'הושלם'
          const all = myTasks.filter((t) => t.status === col.key)
          // The completed column is windowed by recency; other columns show everything.
          const items = isDone ? all.filter((t) => withinRange(t, doneRange)) : all
          const hidden = all.length - items.length
          return (
            <div key={col.key} className="flex flex-col">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={clsx('h-2.5 w-2.5 rounded-full', col.accent)} />
                <h2 className="font-semibold text-slate-700">{col.key}</h2>
                <span className="text-sm text-slate-400">
                  · {items.length}{isDone && hidden > 0 ? ` מתוך ${all.length}` : ''}
                </span>
              </div>
              {isDone && (
                <div className="flex items-center gap-1.5 mb-3 px-1">
                  {DONE_RANGES.map((r) => {
                    const active = doneRange === r.key
                    return (
                      <button
                        key={r.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setDoneRange(r.key)}
                        className={clsx(
                          'rounded-full px-2.5 h-7 text-xs font-medium transition ring-1',
                          active
                            ? 'bg-teal-600 text-white ring-teal-500'
                            : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50',
                        )}
                      >
                        {r.label}
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="space-y-3 flex-1 min-h-24">
                {items.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 py-8">
                    <Empty
                      icon={ListChecks}
                      title={isDone && all.length > 0 ? 'אין משימות שהושלמו בטווח' : 'אין משימות'}
                      hint={isDone && all.length > 0 && doneRange === 'today' ? 'הרחיבו את הטווח ל״השבוע״' : undefined}
                    />
                  </div>
                ) : (
                  items.map((t) => {
                    const patient = t.patientId ? patientById[t.patientId] : null
                    return (
                      <Card key={t.id} className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-slate-800 leading-snug min-w-0">{t.title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {t.source === 'אוטומציה' ? (
                              <Badge tone="purple"><Zap size={12} /> אוטומציה</Badge>
                            ) : (
                              <Badge tone="slate"><User size={12} /> ידני</Badge>
                            )}
                            <button
                              type="button"
                              title="עריכת משימה"
                              onClick={() => setEditing(t)}
                              className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              title="מחיקת משימה"
                              onClick={() => setConfirmDelete(t)}
                              className="p-1 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        {t.note && <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{t.note}</p>}
                        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1"><Clock size={12} /> {friendlyDate(t.due)} · {hhmm(t.due)}</span>
                          {patient && <span>{patient.name}</span>}
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

      {archiveOpen && <TaskArchiveModal personal onClose={() => setArchiveOpen(false)} />}

      {confirmDelete && (
        <ConfirmDialog
          title="למחוק את המשימה?"
          message={`"${confirmDelete.title}" תימחק לצמיתות. לא ניתן לשחזר.`}
          confirmLabel="מחיקה"
          onConfirm={() => { deleteTask(confirmDelete.id); setConfirmDelete(null) }}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

// Create or edit one of the therapist's own tasks. No assignee picker — a therapist
// can only own their tasks, so new tasks are assigned to them by the parent.
function TaskForm({ initial, onSubmit, onCancel }) {
  const isEdit = !!initial
  const [title, setTitle] = useState(initial?.title ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [due, setDue] = useState(toLocalInput(initial?.due instanceof Date ? initial.due : new Date()))

  const inputCls = 'h-10 rounded-xl ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500'

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-slate-800 mb-3">{isEdit ? 'עריכת משימה' : 'משימה חדשה'}</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="כותרת המשימה"
          className={clsx(inputCls, 'sm:col-span-2')}
        />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">תאריך יעד</span>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="הערה (רשות)"
          className={clsx(inputCls, 'sm:col-span-2')}
        />
      </div>
      <div className="flex gap-2 mt-4">
        <Button
          disabled={!title.trim()}
          onClick={() => onSubmit({ title: title.trim(), note: note.trim(), due: due ? new Date(due) : new Date() })}
        >
          {isEdit ? <><Check size={16} /> שמירה</> : <><Plus size={16} /> הוספה</>}
        </Button>
        <Button variant="ghost" onClick={onCancel}>ביטול</Button>
      </div>
    </Card>
  )
}
