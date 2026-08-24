import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ListPlus, Check, AlertTriangle } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { Card, Button } from './ui.jsx'
import { clsx } from './clsx.js'
import PatientPicker from './PatientPicker.jsx'
import { CATEGORY_OPTIONS } from '../lib/triage.js'

// "פתיחת בקשה": the secretary opens a request-to-treat straight into her queue (NOT a task).
// She enters only patient + category + detail (+ urgency if needed); the request lands in
// "בקשות הדורשות טיפול" (kind='inquiry', status 'ממתין') via openStaffRequest, to be resolved
// there like any other inquiry (mark handled / convert to task).
export default function EscalationDialog({ onClose }) {
  const { addPatient, openStaffRequest } = useData()

  const [patientSel, setPatientSel] = useState({ mode: 'existing', patientId: null, newPatient: null, ready: false })
  const [category, setCategory] = useState('אדמיניסטרציה')
  const [urgent, setUrgent] = useState(false) // default: רגיל
  const [description, setDescription] = useState('')

  const canSubmit = patientSel.ready && !!category && description.trim().length > 0

  function submit() {
    if (!canSubmit) return
    let pid = patientSel.patientId
    if (patientSel.mode === 'new') pid = addPatient(patientSel.newPatient).id
    openStaffRequest({ patientId: pid, category, urgency: urgent ? 'דחוף' : 'רגיל', description: description.trim() })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center items-start p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-lg p-0 overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 bg-ink-900 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-white/10 text-teal-300"><ListPlus size={17} /></span>
            <h3 className="font-semibold text-white text-lg">פתיחת בקשה לטיפול</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 overflow-y-auto scroll-thin space-y-4">
          {/* Patient */}
          <Field label="מטופל">
            <PatientPicker onChange={setPatientSel} />
          </Field>

          {/* Category */}
          <Field label="קטגוריה">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
              ))}
            </div>
          </Field>

          {/* Urgency — a single toggle (default off = רגיל). */}
          <Field label="דחיפות">
            <button type="button" onClick={() => setUrgent((v) => !v)} aria-pressed={urgent}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium ring-1 transition',
                urgent ? 'bg-red-600 text-white ring-red-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-red-300',
              )}>
              <AlertTriangle size={15} /> דחוף
            </button>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {urgent ? 'הבקשה תסומן כדחופה' : 'בקשה רגילה — לחצו לסימון כדחוף'}
            </p>
          </Field>

          {/* Detail */}
          <Field label="פירוט הפנייה">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} autoFocus
              placeholder="מה נדרש? פרטי הפנייה שעל הצוות לטפל בהם…"
              className="w-full rounded-xl ring-1 ring-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none leading-relaxed" />
          </Field>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
          <Button disabled={!canSubmit} onClick={submit}><Check size={16} /> פתיחת הבקשה</Button>
        </div>
      </Card>
    </div>,
    document.body,
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <label className="font-medium text-slate-700 text-sm">{label}</label>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition',
        active ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-teal-300',
      )}>
      {children}
    </button>
  )
}
