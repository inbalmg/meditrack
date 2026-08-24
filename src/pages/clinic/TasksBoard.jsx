import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ListChecks, Plus, Zap, User, Users, ArrowLeftRight, Check, Clock, Pencil, Trash2, Archive, AlertTriangle } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { Card, Badge, Button, Avatar, Empty } from '../../components/ui.jsx'
import { URGENCY_OPTIONS, URGENCY_TONE, CATEGORY_OPTIONS } from '../../lib/triage.js'
import UnresolvedAppointments from '../../components/UnresolvedAppointments.jsx'
import TaskArchiveModal from '../../components/TaskArchiveModal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { friendlyDate, hhmm, toClinicInput, clinicInputToDate } from '../../lib/format.js'
import { isAfter, startOfDay, subDays } from 'date-fns'
import { clsx } from '../../components/clsx.js'

const COLUMNS = [
  { key: 'פתוח', tone: 'slate', accent: 'bg-slate-400' },
  { key: 'בטיפול', tone: 'amber', accent: 'bg-amber-500' },
  { key: 'הושלם', tone: 'green', accent: 'bg-emerald-500' },
]

const NEXT = { פתוח: 'בטיפול', בטיפול: 'הושלם' }

// A task with no specific assignee (assignee_id null) belongs to the office as a whole —
// e.g. the default target when a portal inquiry is converted to a task. Shown as this
// labeled chip and offered as the first option in the assignee picker.
const GENERAL_ASSIGNEE_LABEL = 'ללא שיוך (צוות המשרד / כללי)'

// Recency windows for the "הושלם" column. The board mirror only holds completed tasks
// from the last 15 days (older ones live in the Task Archive drawer), so these windows
// all sit inside that bound. Default is "השבוע"; "15 ימים אחרונים" is the full window.
const DONE_RANGES = [
  { key: 'today', label: 'היום', days: 0 },
  { key: 'week', label: 'השבוע', days: 7 },
  { key: 'last15', label: '15 ימים אחרונים', days: 15 },
]

// When a completed task was finished. Falls back to due/createdAt for legacy rows
// with no completedAt stamp, so the filter still behaves reasonably without backfill.
const doneAnchor = (t) => t.completedAt ?? t.due ?? t.createdAt

function withinRange(t, range) {
  const anchor = doneAnchor(t)
  if (!anchor) return true
  const days = DONE_RANGES.find((r) => r.key === range)?.days ?? 15
  const cutoff = days === 0 ? startOfDay(new Date()) : subDays(new Date(), days)
  return isAfter(anchor, cutoff)
}

export default function TasksBoard() {
  const { tasks, patientById, assignees, assigneeById, setTaskStatus, addTask, updateTask, deleteTask } = useData()
  // Form target: null (closed) · 'new' (create) · a task object (edit).
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  // Recency window for the completed column (default: recent week).
  const [doneRange, setDoneRange] = useState('week')
  // Task Archive side-drawer (the full completed backlog, loaded on demand).
  const [archiveOpen, setArchiveOpen] = useState(false)

  // Deep-link target from the Dashboard "תורים שלא סומנו" KPI: scroll the review
  // queue into view and briefly ring it so the redirect lands where it should.
  const location = useLocation()
  const reviewRef = useRef(null)
  const [highlighted, setHighlighted] = useState(false)
  useEffect(() => {
    if (location.state?.focus !== 'unresolved') return
    reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHighlighted(true)
    const t = setTimeout(() => setHighlighted(false), 2000)
    return () => clearTimeout(t)
  }, [location.state])

  return (
    <div className="space-y-5 animate-fade">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">לוח משימות</h1>
          <p className="text-slate-500 mt-0.5">יצירה, שיוך לאחראי ומעקב · משימות אוטומטיות מסומנות בתגית</p>
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

      <UnresolvedAppointments ref={reviewRef} highlighted={highlighted} />

      {editing && (
        <TaskForm
          key={editing === 'new' ? 'new' : editing.id}
          assignees={assignees}
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSubmit={(data) => {
            if (editing === 'new') addTask(data)
            else updateTask(editing.id, data)
            setEditing(null)
          }}
        />
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const isDone = col.key === 'הושלם'
          const all = tasks.filter((t) => t.status === col.key)
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
                      hint={isDone && all.length > 0 ? 'הרחיבו את הטווח או פתחו את הארכיון' : undefined}
                    />
                  </div>
                ) : (
                  items.map((t) => {
                    const assignee = t.assigneeId ? assigneeById[t.assigneeId] : null
                    return (
                      <Card key={t.id} className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-slate-800 leading-snug min-w-0">{t.title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {t.urgency && t.urgency !== 'רגיל' && (
                              <Badge tone={URGENCY_TONE[t.urgency]}>
                                {t.urgency === 'דחוף' && <AlertTriangle size={12} />} {t.urgency}
                              </Badge>
                            )}
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
                          {t.category && <Badge tone="teal">{t.category}</Badge>}
                          <span className="flex items-center gap-1"><Clock size={12} /> {friendlyDate(t.due)} · {hhmm(t.due)}</span>
                          {assignee ? (
                            <span className="flex items-center gap-1">
                              <Avatar initials={assignee.initials} color={assignee.color} size={18} />
                              {assignee.name}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1"><Users size={12} /> {GENERAL_ASSIGNEE_LABEL}</span>
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

      {archiveOpen && <TaskArchiveModal onClose={() => setArchiveOpen(false)} />}

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

// Create or edit a task. `initial` = a task to edit (null → create). The assignee
// picker groups treatment providers and office staff (secretary/manager).
function TaskForm({ assignees, initial, onSubmit, onCancel }) {
  const isEdit = !!initial
  const initialDue = initial?.due instanceof Date ? initial.due : new Date()
  const [title, setTitle] = useState(initial?.title ?? '')
  // Default new tasks to the general/office pool (''); edits keep the task's assignee.
  const [assigneeId, setAssigneeId] = useState(initial?.assigneeId ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [urgency, setUrgency] = useState(initial?.urgency ?? 'רגיל')
  const [due, setDue] = useState(toClinicInput(initialDue))

  // Due date must not fall in the past. Floor the picker at the start of today; for an
  // edit whose due already slipped into the past keep that value selectable so the task
  // stays fully editable (the user can still push it forward to today/future).
  const startToday = startOfDay(new Date())
  const dueFloor = isEdit && initialDue < startToday ? startOfDay(initialDue) : startToday
  const minDue = toClinicInput(dueFloor)
  const duePast = !due || clinicInputToDate(due) < dueFloor

  const therapists = assignees.filter((a) => a.kind === 'therapist')
  const office = assignees.filter((a) => a.kind !== 'therapist')

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
          <span className="text-[11px] font-medium text-slate-500">אחראי/ת</span>
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={clsx(inputCls, 'bg-white')}>
            <option value="">{GENERAL_ASSIGNEE_LABEL}</option>
            <optgroup label="מטפלים">
              {therapists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </optgroup>
            {office.length > 0 && (
              <optgroup label="מזכירות והנהלה">
                {office.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </optgroup>
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">תאריך יעד</span>
          <input
            type="datetime-local"
            value={due}
            min={minDue}
            onChange={(e) => setDue(e.target.value)}
            className={clsx(inputCls, 'w-full sm:w-56 text-right')}
          />
          {duePast && (
            <span className="text-[11px] text-red-500">יש לבחור את היום הנוכחי או תאריך עתידי</span>
          )}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">קטגוריה</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={clsx(inputCls, 'bg-white')}>
            <option value="">— ללא —</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-slate-500">דחיפות</span>
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className={clsx(inputCls, 'bg-white')}>
            {URGENCY_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
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
          disabled={!title.trim() || duePast}
          onClick={() => onSubmit({ title: title.trim(), assigneeId, note: note.trim(), category: category || null, urgency: urgency || null, due: due ? clinicInputToDate(due) : new Date() })}
        >
          {isEdit ? <><Check size={16} /> שמירה</> : <><Plus size={16} /> הוספה</>}
        </Button>
        <Button variant="ghost" onClick={onCancel}>ביטול</Button>
      </div>
    </Card>
  )
}
