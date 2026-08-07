import { useState } from 'react'
import { X, Phone, Sparkles, Clock, UserPlus, UserRound, Check } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { Card, Button, RequiredMark } from './ui.jsx'
import { clsx } from './clsx.js'
import { phoneValid, birthYearValid } from '../lib/validation.js'
import { VISIT_TYPES } from '../data/seed.js'

const TIMES = ['בוקר', 'צהריים', 'אחר הצהריים', 'גמיש']

// Lets the secretary log a request received over the phone. New (first-time)
// callers can be registered inline. On submit the request lands at the top of
// the pending pipeline with its AI classification — same flow as a portal request.
export default function PhoneRequestDialog({ onClose }) {
  const { patients, therapists, submitRequest, addPatient } = useData()

  const [mode, setMode] = useState('existing') // 'existing' | 'new'
  const [patientId, setPatientId] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newBirthYear, setNewBirthYear] = useState('')
  const [visitType, setVisitType] = useState('')
  const [therapistId, setTherapistId] = useState('')
  const [description, setDescription] = useState('')
  const [preferredTime, setPreferredTime] = useState('גמיש')

  // New patient: name, a valid phone (the reminder channel), and a valid year of
  // birth are all required. Existing patient: a selection is enough.
  const newPhoneValid = phoneValid(newPhone)
  const newBirthYearValid = birthYearValid(newBirthYear)
  const patientReady = mode === 'existing'
    ? !!patientId
    : (!!newName.trim() && newPhoneValid && newBirthYearValid)
  const canSubmit = patientReady && description.trim().length > 0

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    let pid = patientId
    if (mode === 'new') {
      const p = addPatient({ name: newName.trim(), phone: newPhone.trim(), birthYear: Number(newBirthYear) })
      pid = p.id
    }
    submitRequest({
      patientId: pid,
      description: description.trim(),
      preferredTherapistId: therapistId || null,
      visitTypeHint: visitType || null,
      preferredTime,
      source: 'טלפון',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade" onClick={onClose}>
      <Card className="w-full max-w-lg p-0 overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 bg-ink-900 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-white/10 text-teal-300"><Phone size={17} /></span>
            <h3 className="font-semibold text-white text-lg">בקשת תור טלפונית</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 overflow-y-auto scroll-thin space-y-4">
          {/* Patient */}
          <Field label="מטופל">
            <div className="flex gap-2 mb-2.5">
              <Toggle active={mode === 'existing'} onClick={() => setMode('existing')} icon={UserRound}>מטופל קיים</Toggle>
              <Toggle active={mode === 'new'} onClick={() => setMode('new')} icon={UserPlus}>מטופל חדש</Toggle>
            </div>
            {mode === 'existing' ? (
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full h-10 rounded-xl ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="">בחרו מטופל…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>
                ))}
              </select>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">שם מלא <RequiredMark /></span>
                  <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} required aria-required="true" placeholder="שם פרטי ומשפחה"
                    className="w-full h-10 rounded-xl ring-1 ring-slate-300 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">טלפון <RequiredMark /></span>
                  <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} required aria-required="true"
                    aria-invalid={newPhone.trim().length > 0 && !newPhoneValid} placeholder="050-0000000" inputMode="tel"
                    className={clsx(
                      'w-full h-10 rounded-xl ring-1 px-3 text-sm tabular-nums outline-none focus:ring-2',
                      newPhone.trim().length > 0 && !newPhoneValid
                        ? 'ring-red-300 focus:ring-red-500'
                        : 'ring-slate-300 focus:ring-teal-500',
                    )} />
                  {newPhone.trim().length > 0 && !newPhoneValid && (
                    <span className="text-[11px] text-red-500">מספר טלפון נייד לא תקין</span>
                  )}
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">שנת לידה <RequiredMark /></span>
                  <input value={newBirthYear} onChange={(e) => setNewBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required aria-required="true" aria-invalid={newBirthYear.trim().length > 0 && !newBirthYearValid}
                    inputMode="numeric" maxLength={4} placeholder="1990"
                    className={clsx(
                      'w-full h-10 rounded-xl ring-1 px-3 text-sm tabular-nums outline-none focus:ring-2',
                      newBirthYear.trim().length > 0 && !newBirthYearValid
                        ? 'ring-red-300 focus:ring-red-500'
                        : 'ring-slate-300 focus:ring-teal-500',
                    )} />
                  {newBirthYear.trim().length > 0 && !newBirthYearValid && (
                    <span className="text-[11px] text-red-500">שנת לידה לא תקינה</span>
                  )}
                </label>
              </div>
            )}
          </Field>

          {/* Visit type */}
          <Field label="סוג ביקור" hint="רשות">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VISIT_TYPES.map((v) => (
                <Chip key={v} active={visitType === v} onClick={() => setVisitType(visitType === v ? '' : v)}>{v}</Chip>
              ))}
            </div>
          </Field>

          {/* Preferred therapist */}
          <Field label="מטפל מועדף" hint="רשות">
            <div className="flex flex-wrap gap-2">
              {therapists.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTherapistId(therapistId === t.id ? '' : t.id)}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm ring-1 transition',
                    therapistId === t.id ? 'ring-teal-500 bg-teal-50' : 'ring-slate-200 hover:ring-teal-300',
                  )}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="font-medium text-slate-700">{t.name}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* Description */}
          <Field label="סיבת הפנייה / תיאור" hint="קלט ל-AI · מה סיפר/ה המטופל.ת בטלפון">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder="לדוגמה: כאב גרון וחום כבר יומיים, לא משתפר…"
              className="w-full rounded-xl ring-1 ring-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Sparkles size={12} /> הטקסט ינותח לזיהוי דחיפות, סוג ביקור וניתוב למטפל
            </p>
          </Field>

          {/* Preferred time */}
          <Field label="זמן מועדף">
            <div className="flex flex-wrap gap-2">
              {TIMES.map((t) => (
                <Chip key={t} active={preferredTime === t} onClick={() => setPreferredTime(t)}>
                  <Clock size={13} /> {t}
                </Chip>
              ))}
            </div>
          </Field>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            <Check size={16} /> קליטת הבקשה
          </Button>
        </div>
      </Card>
    </div>
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
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition',
        active ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-teal-300',
      )}
    >
      {children}
    </button>
  )
}

function Toggle({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition',
        active ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-slate-600 ring-slate-200 hover:ring-teal-300',
      )}
    >
      <Icon size={15} /> {children}
    </button>
  )
}
