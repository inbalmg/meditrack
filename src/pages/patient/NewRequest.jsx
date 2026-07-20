import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FilePlus2, Sparkles, Check, Clock, CalendarCheck } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { Card, Button, Badge } from '../../components/ui.jsx'
import { VISIT_TYPES } from '../../data/seed.js'
import { clsx } from '../../components/clsx.js'

const TIMES = ['בוקר', 'צהריים', 'אחר הצהריים', 'גמיש']

export default function NewRequest() {
  const { submitRequest, therapists, currentPatientId, therapistById } = useData()
  const navigate = useNavigate()

  const [visitType, setVisitType] = useState('')
  const [therapistId, setTherapistId] = useState('')
  const [description, setDescription] = useState('')
  const [preferredTime, setPreferredTime] = useState('גמיש')
  const [submitted, setSubmitted] = useState(null)

  function handleSubmit(e) {
    e.preventDefault()
    const req = submitRequest({
      patientId: currentPatientId,
      description: description.trim(),
      preferredTherapistId: therapistId || null,
      visitTypeHint: visitType || null,
      preferredTime,
    })
    setSubmitted(req)
  }

  if (submitted) {
    const routed = therapistById[submitted.ai.routedTo]
    return (
      <div className="animate-fade space-y-4">
        <Card className="p-6 text-center">
          <span className="grid place-items-center h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto mb-4">
            <Check size={32} />
          </span>
          <h2 className="text-xl font-bold text-slate-800">הבקשה נשלחה!</h2>
          <p className="text-slate-500 mt-1 text-sm leading-relaxed">
            הבקשה שלך התקבלה במרפאה. נחזור אליך עם אישור ופרטי התור בהקדם.
          </p>
        </Card>

        <Card className="p-5 bg-teal-50/60 ring-teal-100">
          <div className="flex items-center gap-1.5 text-teal-700 text-sm font-semibold mb-3">
            <Sparkles size={15} /> הבקשה נותחה אוטומטית
          </div>
          <dl className="space-y-2.5 text-sm">
            <Row label="רמת דחיפות">
              <Badge tone={submitted.ai.urgency === 'דחוף' ? 'red' : submitted.ai.urgency === 'בהקדם' ? 'amber' : 'teal'}>
                {submitted.ai.urgency}
              </Badge>
            </Row>
            <Row label="סוג ביקור"><span className="font-medium text-slate-700">{submitted.ai.visitType}</span></Row>
            <Row label="נותב אל"><span className="font-medium text-slate-700">{routed.name}</span></Row>
            <Row label="זמן מועדף"><span className="font-medium text-slate-700">{submitted.preferredTime}</span></Row>
          </dl>
          <p className="text-xs text-slate-500 mt-3">{submitted.ai.rationale}</p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => { setSubmitted(null); setDescription(''); setVisitType(''); setTherapistId('') }}>
            <FilePlus2 size={16} /> בקשה נוספת
          </Button>
          <Button onClick={() => navigate('/patient')}>
            <CalendarCheck size={16} /> לתורים שלי
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">בקשת תור חדש</h1>
        <p className="text-slate-500 text-sm mt-0.5">מלאו את הפרטים ונשלח בקשה למרפאה</p>
      </div>

      <Field label="סוג ביקור" hint="רשות">
        <div className="grid grid-cols-2 gap-2">
          {VISIT_TYPES.map((v) => (
            <Chip key={v} active={visitType === v} onClick={() => setVisitType(visitType === v ? '' : v)}>{v}</Chip>
          ))}
        </div>
      </Field>

      <Field label="מטפל מועדף" hint="רשות">
        <div className="space-y-2">
          {therapists.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTherapistId(therapistId === t.id ? '' : t.id)}
              className={clsx(
                'w-full flex items-center gap-3 rounded-xl ring-1 px-3 py-2.5 text-right transition',
                therapistId === t.id ? 'ring-teal-500 bg-teal-50' : 'ring-slate-200 bg-white',
              )}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{t.name}</p>
                <p className="text-xs text-slate-400">{t.specialty}</p>
              </div>
              {therapistId === t.id && <Check size={16} className="text-teal-600" />}
            </button>
          ))}
        </div>
      </Field>

      <Field label="תיאור חופשי" hint="קלט ל-AI · מה מטריד אותך?">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          placeholder="לדוגמה: כאב גרון וחום כבר יומיים, לא משתפר..."
          className="w-full rounded-xl ring-1 ring-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none leading-relaxed"
        />
        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
          <Sparkles size={12} /> הטקסט ינותח לזיהוי דחיפות וניתוב למטפל המתאים
        </p>
      </Field>

      <Field label="זמן מועדף">
        <div className="flex flex-wrap gap-2">
          {TIMES.map((t) => (
            <Chip key={t} active={preferredTime === t} onClick={() => setPreferredTime(t)}>
              <Clock size={13} /> {t}
            </Chip>
          ))}
        </div>
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={!description.trim()}>
        שליחת הבקשה
      </Button>
    </form>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd>{children}</dd>
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
