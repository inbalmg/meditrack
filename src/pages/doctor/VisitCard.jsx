import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Sparkles, Phone, Pill, History, FileText, Eye, Stethoscope } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { Card, CardHeader, Badge, Avatar, Empty } from '../../components/ui.jsx'
import { classifyRequest } from '../../lib/aiClassifier.js'
import { hhmm, friendlyDate } from '../../lib/format.js'

// Read-only clinical view. Clinical documentation is out of MVP scope, so this
// screen only surfaces existing context: reason, AI tags, history and meds.
const HISTORY = {
  p1: [
    { date: 'לפני חודש', reason: 'כאבי גב תחתון', note: 'הומלץ על מנוחה ופיזיותרפיה' },
    { date: 'לפני 4 חודשים', reason: 'בדיקה שנתית', note: 'תקין' },
  ],
  p2: [
    { date: 'לפני שבועיים', reason: 'מעקב לחץ דם', note: 'ערכים יציבים' },
    { date: 'לפני 3 חודשים', reason: 'חידוש מרשם', note: '' },
  ],
  p6: [{ date: 'לפני חודש', reason: 'בדיקות דם', note: 'ממתין לתוצאות' }],
}
const MEDS = {
  p1: ['אופטלגין 500 מ״ג — לפי צורך'],
  p2: ['נורמיטן 50 מ״ג — פעם ביום', 'אקמול 500 מ״ג — לפי צורך'],
  p6: ['אומפרדקס 20 מ״ג — פעם ביום'],
}

export default function VisitCard() {
  const { apptId } = useParams()
  const navigate = useNavigate()
  const { appointments, patientById } = useData()
  const appt = appointments.find((a) => a.id === apptId)

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
  const history = HISTORY[patient.id] || []
  const meds = MEDS[patient.id] || []

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
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-800">{patient.name}</h1>
              <Badge tone="slate"><Eye size={12} /> צפייה בלבד</Badge>
            </div>
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

      <div className="grid md:grid-cols-2 gap-5">
        {/* History */}
        <Card>
          <CardHeader title="היסטוריית ביקורים" icon={History} />
          <div className="px-5 pb-5 space-y-3">
            {history.length === 0 ? (
              <Empty icon={History} title="אין היסטוריה" />
            ) : (
              history.map((h, i) => (
                <div key={i} className="relative pr-4 border-r-2 border-teal-100">
                  <span className="absolute right-[-5px] top-1.5 h-2 w-2 rounded-full bg-teal-500" />
                  <p className="text-sm font-medium text-slate-700">{h.reason}</p>
                  <p className="text-xs text-slate-400">{h.date}{h.note && ` · ${h.note}`}</p>
                </div>
              ))
            )}
          </div>
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

      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <Stethoscope size={14} /> תיעוד קליני מחוץ ל-MVP · המסך מציג הקשר קיים לקריאה בלבד.
      </p>
    </div>
  )
}
