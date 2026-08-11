import { useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ChevronRight, ChevronDown, Sparkles, Phone, Pill, History, FileText, Stethoscope, CalendarClock, Check, Lock } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { Card, CardHeader, Badge, Avatar, Button, Empty } from '../../components/ui.jsx'
import AppointmentActions from '../../components/AppointmentActions.jsx'
import { classifyRequest } from '../../lib/aiClassifier.js'
import { hhmm, friendlyDate, dayName } from '../../lib/format.js'
import { clsx } from '../../components/clsx.js'

// Patient profile for the therapist: the current visit's reason + AI tags, an editable
// clinical summary, the patient's full cross-provider visit history (collapsible), and meds.
const MEDS = {
  p1: ['אופטלגין 500 מ״ג — לפי צורך'],
  p2: ['נורמיטן 50 מ״ג — פעם ביום', 'אקמול 500 מ״ג — לפי צורך'],
  p6: ['אומפרדקס 20 מ״ג — פעם ביום'],
}

const STATUS_TONE = { קבוע: 'blue', הגיע: 'teal', הסתיים: 'green', 'לא הגיע': 'red' }

// A past 'קבוע' slot that was never checked in reads as "not marked"; a future one is
// simply "scheduled". Everything else uses its own status label + tone.
function statusDisplay(appt) {
  const isFuture = appt.start > new Date()
  if (appt.status === 'קבוע') {
    return isFuture ? { label: 'מתוכנן', tone: 'blue' } : { label: 'לא סומן', tone: 'amber' }
  }
  return { label: appt.status, tone: STATUS_TONE[appt.status] ?? 'slate' }
}

const historyDate = (d) => `יום ${dayName(d)} · ${format(d, 'dd/MM/yyyy')}`

export default function VisitCard() {
  const { apptId } = useParams()
  const navigate = useNavigate()
  const { appointments, patientById, therapistById, saveClinicalNote } = useData()
  const appt = appointments.find((a) => a.id === apptId)

  // All visits for this patient, newest first (upcoming at the top, then past). RLS
  // lets a treating therapist read the patient's full cross-provider history.
  const visits = useMemo(() => {
    if (!appt) return []
    return appointments
      .filter((a) => a.patientId === appt.patientId)
      .sort((a, b) => b.start - a.start)
  }, [appointments, appt])

  // The whole history section is collapsed by default (single chevron toggle).
  const [historyOpen, setHistoryOpen] = useState(false)

  // Per-visit accordion (inside the section): the current visit starts expanded.
  const [expanded, setExpanded] = useState(() => new Set(apptId ? [apptId] : []))
  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  if (!appt) {
    return (
      <Card className="p-8">
        <Empty icon={FileText} title="התור לא נמצא" />
        <div className="text-center">
          <Link to="/doctor" className="text-teal-600 hover:text-teal-700">חזרה להיום שלי</Link>
        </div>
      </Card>
    )
  }

  const patient = patientById[appt.patientId]
  const ai = classifyRequest({ description: appt.reason })
  const meds = MEDS[patient.id] || []
  const now = new Date()
  const upcomingCount = visits.filter((v) => v.start > now).length
  const pastCount = visits.length - upcomingCount

  return (
    <div className="space-y-5 animate-fade max-w-4xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronRight size={16} /> חזרה
      </button>

      {/* Patient header */}
      <Card className="p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar initials={patient.name.slice(0, 2)} color="#0d9488" size={56} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-800">{patient.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {patient.age} · {patient.gender === 'ז' ? 'זכר' : 'נקבה'} · <Phone size={12} className="inline" /> {patient.phone}
            </p>
          </div>
          <div className="text-left">
            <p className="text-sm text-slate-400">{friendlyDate(appt.start)}</p>
            <p className="text-2xl font-bold text-slate-800 tabular-nums">{hhmm(appt.start)}</p>
            <Badge tone="blue">{appt.visitType}</Badge>
          </div>
        </div>
        {/* Visit status + therapist check-in / completion controls. */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2.5 flex-wrap">
          <span className="text-sm font-medium text-slate-500">סטטוס הביקור:</span>
          <AppointmentActions appt={appt} />
        </div>
      </Card>

      {/* Reason + AI */}
      <Card className="p-5">
        <div className="flex items-center gap-2 text-slate-700 font-semibold mb-2">
          <FileText size={18} className="text-teal-600" /> סיבת הפנייה
        </div>
        <p className="text-slate-700 leading-relaxed">"{appt.reason}"</p>
        <div className="mt-4 rounded-xl bg-teal-50/70 ring-1 ring-teal-100 p-3">
          <div className="flex items-center gap-1.5 text-teal-700 text-sm font-semibold mb-2">
            <Sparkles size={15} /> תגיות וסיווג AI
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={ai.urgency === 'דחוף' ? 'red' : ai.urgency === 'בהקדם' ? 'amber' : 'teal'}>{ai.urgency}</Badge>
            {ai.tags.map((t) => <Badge key={t} tone="slate">{t}</Badge>)}
          </div>
          <p className="text-xs text-slate-500 mt-2">{ai.rationale}</p>
        </div>
      </Card>

      {/* Visit summary — editable ONLY while the visit is in progress (status "הגיע").
          Disabled for future/scheduled/completed visits (a summary is authored on arrival). */}
      <Card className="p-5">
        <div className="flex items-center gap-2 text-slate-700 font-semibold mb-3">
          <FileText size={18} className="text-teal-600" /> סיכום ביקור
        </div>
        <NoteEditor
          appt={appt}
          onSave={(note) => saveClinicalNote(appt.id, note)}
          disabled={!(appt.status === 'הגיע' || appt.status === 'הסתיים') || appt.start > new Date()}
          disabledReason={
            appt.start > new Date()
              ? 'לא ניתן לכתוב סיכום לביקור עתידי.'
              : 'כתיבת סיכום זמינה רק לביקור בסטטוס "הגיע" או "הסתיים".'
          }
        />
      </Card>

      {/* Visit history — the whole section is one collapsible block (chevron toggle,
          collapsed by default). Inside, each visit is its own accordion row. */}
      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          aria-expanded={historyOpen}
          className="w-full flex items-center justify-between gap-3 px-5 pt-4 pb-3 text-right hover:bg-slate-50/70 transition"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-teal-50 text-teal-600 shrink-0">
              <History size={17} />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-800 truncate">היסטוריית ביקורים</h3>
              {visits.length > 0 && (
                <p className="text-xs text-slate-500 truncate">
                  {`${visits.length} ביקורים · ${pastCount} בעבר · ${upcomingCount} עתידיים`}
                </p>
              )}
            </div>
          </div>
          <ChevronDown size={20} className={clsx('text-slate-400 transition-transform shrink-0', historyOpen ? '' : '-rotate-90')} />
        </button>

        {historyOpen && (
          <div className="px-5 pb-5 space-y-2.5">
            {visits.length === 0 ? (
              <Empty icon={History} title="אין ביקורים" />
            ) : (
              visits.map((v) => (
                <VisitRow
                  key={v.id}
                  v={v}
                  isCurrent={v.id === appt.id}
                  provider={therapistById[v.therapistId]}
                  open={expanded.has(v.id)}
                  onToggle={() => toggle(v.id)}
                />
              ))
            )}
          </div>
        )}
      </Card>

      {/* Meds */}
      <Card>
        <CardHeader title="תרופות" icon={Pill} />
        <div className="px-5 pb-5 space-y-2">
          {meds.length === 0 ? (
            <Empty icon={Pill} title="אין תרופות רשומות" />
          ) : (
            meds.map((m, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl ring-1 ring-slate-100 px-3 py-2.5">
                <span className="grid place-items-center h-8 w-8 rounded-lg bg-purple-50 text-purple-600 shrink-0"><Pill size={16} /></span>
                <span className="text-sm text-slate-700">{m}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}

// One collapsible visit in the history. Header (always visible): treatment, date,
// provider, status. Body (expanded): reason + the visit's clinical note (read-only —
// the current visit's note is authored in the "סיכום ביקור" card above).
function VisitRow({ v, isCurrent, provider, open, onToggle }) {
  const st = statusDisplay(v)
  return (
    <div className={clsx('rounded-xl ring-1 transition', isCurrent ? 'ring-teal-300 bg-teal-50/50' : 'ring-slate-100')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-right flex items-start justify-between gap-3 p-4 rounded-xl hover:bg-slate-50/70"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ChevronDown size={16} className={clsx('text-slate-400 transition-transform shrink-0', open ? '' : '-rotate-90')} />
            <span className="font-medium text-slate-800">{v.visitType}</span>
            {isCurrent && <Badge tone="teal"><CalendarClock size={12} /> התור הנוכחי</Badge>}
          </div>
          <div className="mt-1 pr-6 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-slate-500">
            <span className="flex items-center gap-1 tabular-nums">
              <CalendarClock size={12} /> {historyDate(v.start)} · {hhmm(v.start)}
            </span>
            <span className="flex items-center gap-1">
              <Stethoscope size={12} /> {provider?.name ?? '—'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {v.clinicalNote && !open && <FileText size={14} className="text-teal-600" title="קיים סיכום קליני" />}
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {v.reason && (
            <p className="text-xs text-slate-500 pr-6">
              <span className="text-slate-400">סיבה: </span>"{v.reason}"
            </p>
          )}
          {v.clinicalNote ? (
            <div className="mr-6 rounded-lg bg-slate-50 ring-1 ring-slate-100 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1">
                <FileText size={13} className="text-teal-600" /> סיכום קליני
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{v.clinicalNote}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic pr-6">אין סיכום קליני מתועד לביקור זה.</p>
          )}
        </div>
      )}
    </div>
  )
}

// Editable clinical note bound to one appointment. Saves via the store (RPC-backed);
// the Save button is disabled until the text differs from what's persisted. When
// `disabled` (visit not in progress), the textarea is read-only and `disabledReason`
// explains why instead of showing the Save control.
function NoteEditor({ appt, onSave, disabled = false, disabledReason }) {
  const original = appt.clinicalNote ?? ''
  const [value, setValue] = useState(original)
  const [justSaved, setJustSaved] = useState(false)
  const dirty = value !== original

  function save() {
    onSave(value)
    setJustSaved(true)
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => { setValue(e.target.value); setJustSaved(false) }}
        rows={4}
        placeholder={disabled ? 'אין סיכום מתועד לביקור זה.' : 'כתבו סיכום קליני לביקור — ממצאים, המלצות והמשך טיפול…'}
        className={clsx(
          'w-full rounded-xl ring-1 px-3 py-2.5 text-sm leading-relaxed outline-none resize-y',
          disabled
            ? 'ring-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed resize-none'
            : 'ring-slate-300 focus:ring-2 focus:ring-teal-500',
        )}
      />
      {disabled ? (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <Lock size={13} /> {disabledReason}
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={!dirty}>
            <Check size={15} /> שמירת סיכום
          </Button>
          {!dirty && justSaved && (
            <span className="text-xs text-emerald-600 flex items-center gap-1"><Check size={13} /> נשמר</span>
          )}
        </div>
      )}
    </div>
  )
}
