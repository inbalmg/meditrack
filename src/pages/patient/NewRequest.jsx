import { useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { addDays, isSameDay, set } from 'date-fns'
import {
  Sparkles, Check, Clock, CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Route, HelpCircle, ArrowRight, Phone, User, Bell, CalendarClock,
} from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { Card, Button, Badge, RequiredMark } from '../../components/ui.jsx'
import { clsx } from '../../components/clsx.js'
import {
  dayName, shortDate, hhmm,
  firstBookingDay, weekStartOf, maxBookingWeekStart, weekWorkingDays,
} from '../../lib/format.js'
import { WORK_START_HOUR, WORK_END_HOUR } from '../../data/seed.js'
import { classifyRequest } from '../../lib/aiClassifier.js'

// 30-minute slot grid for a provider + date; a slot is available if it fits the
// treatment duration without overlapping an existing appointment.
function buildSlots(date, therapistId, durationMin, appointments) {
  const now = new Date()
  const dayEnd = set(date, { hours: WORK_END_HOUR, minutes: 0, seconds: 0, milliseconds: 0 }).getTime()
  const out = []
  for (let h = WORK_START_HOUR; h < WORK_END_HOUR; h++) {
    for (const m of [0, 30]) {
      const start = set(date, { hours: h, minutes: m, seconds: 0, milliseconds: 0 })
      const end = start.getTime() + durationMin * 60000
      if (end > dayEnd) continue
      const taken = appointments.some(
        (a) =>
          a.therapistId === therapistId &&
          isSameDay(a.start, date) &&
          start.getTime() < a.start.getTime() + a.durationMin * 60000 &&
          end > a.start.getTime(),
      )
      const past = start.getTime() < now.getTime()
      out.push({ hour: h, minute: m, start, available: !taken && !past })
    }
  }
  return out
}

// Israeli mobile number, forgiving of separators (accepts "050-1234567").
function phoneValid(phone) {
  const digits = (phone || '').replace(/\D/g, '')
  return digits.length >= 9 && digits.startsWith('0')
}

export default function NewRequest() {
  const {
    therapists, treatmentsForTherapist, appointments, currentPatientId,
    therapistById, treatmentById, patientById,
    bookAppointment, submitRequest, addPatient, updatePatient, setCurrentPatient,
    cancelAppointment,
  } = useData()
  const navigate = useNavigate()
  const location = useLocation()

  // Reschedule: MyAppointments passes the appointment id via router state. We
  // prefill its provider/treatment and cancel the original once the new slot is
  // booked — so "שינוי מועד" moves the appointment instead of adding a second one.
  const rescheduleId = location.state?.rescheduleId ?? null
  const rescheduling = useMemo(
    () => (rescheduleId ? appointments.find((a) => a.id === rescheduleId) : null),
    [rescheduleId, appointments],
  )

  const me = currentPatientId ? patientById[currentPatientId] : null
  const isNewPatient = !me

  // Contact details collected within the booking flow. Prefilled from the
  // patient's record when registered; empty (and required) for a new patient.
  // The phone is where appointment reminders (WhatsApp/SMS) are sent.
  const [name, setName] = useState(me?.name ?? '')
  const [phone, setPhone] = useState(me?.phone ?? '')
  const contactValid = phoneValid(phone) && (!isNewPatient || name.trim().length > 0)

  // Ensure a patient record exists (creating a new one / saving an edited phone)
  // and return its id, or null if the contact details are invalid.
  function commitContact() {
    if (!contactValid) return null
    if (isNewPatient) {
      const p = addPatient({ name: name.trim(), phone: phone.trim() })
      setCurrentPatient(p.id)
      return p.id
    }
    if (phone.trim() !== (me.phone ?? '')) updatePatient(currentPatientId, { phone: phone.trim() })
    return currentPatientId
  }

  const [mode, setMode] = useState('book') // 'book' | 'unsure'
  const [therapistId, setTherapistId] = useState(rescheduling?.therapistId ?? '')
  const [treatmentId, setTreatmentId] = useState(rescheduling?.treatmentId ?? '')
  // ניווט שבועי: מהיום ועד 6 חודשים קדימה (א׳–ה׳ בלבד).
  const firstDay = useMemo(() => firstBookingDay(), [])
  const thisWeekStart = useMemo(() => weekStartOf(firstDay), [firstDay])
  const maxWeekStart = useMemo(() => maxBookingWeekStart(), [])
  const [weekStart, setWeekStart] = useState(thisWeekStart)
  const workingDays = useMemo(() => weekWorkingDays(weekStart, firstDay), [weekStart, firstDay])
  const [date, setDate] = useState(firstDay)
  const [slot, setSlot] = useState(null)
  const [booked, setBooked] = useState(null)
  const canPrevWeek = weekStart > thisWeekStart
  const canNextWeek = weekStart < maxWeekStart

  function shiftWeek(dir) {
    const next = addDays(weekStart, dir * 7)
    if (next < thisWeekStart || next > maxWeekStart) return
    setWeekStart(next)
    setDate(weekWorkingDays(next, firstDay)[0] ?? date)
    setSlot(null)
  }

  const treatment = treatmentId ? treatmentById[treatmentId] : null
  const duration = treatment?.durationMin ?? 30
  const slots = useMemo(
    () => (therapistId && treatment ? buildSlots(date, therapistId, duration, appointments) : []),
    [therapistId, treatment, date, duration, appointments],
  )

  function pickTherapist(id) {
    setTherapistId(id); setTreatmentId(''); setSlot(null)
  }
  function pickTreatment(id) {
    setTreatmentId(id); setSlot(null)
  }
  function confirm() {
    if (!slot || !contactValid) return
    const patientId = commitContact()
    if (!patientId) return
    const appt = bookAppointment({
      patientId,
      therapistId,
      treatmentId,
      start: set(date, { hours: slot.hour, minutes: slot.minute, seconds: 0, milliseconds: 0 }),
    })
    // Reschedule = move: drop the original only after the new one is booked.
    if (rescheduleId) cancelAppointment(rescheduleId)
    setBooked(appt)
  }

  // ---------- Booked confirmation ----------
  if (booked) {
    const t = therapistById[booked.therapistId]
    return (
      <div className="animate-fade space-y-4 max-w-xl mx-auto">
        <Card className="p-6 text-center">
          <span className="grid place-items-center h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto mb-4"><Check size={32} /></span>
          <h2 className="text-xl font-bold text-slate-800">התור נקבע!</h2>
          <p className="text-slate-500 mt-1 text-sm">שריינו לך מקום ביומן. נשלח תזכורת בוואטסאפ/SMS ל־{phone}.</p>
        </Card>
        <Card className="p-5">
          <dl className="space-y-2.5 text-sm">
            <Row label="טיפול"><span className="font-medium text-slate-700">{booked.visitType}</span></Row>
            <Row label="מטפל/ת"><span className="font-medium text-slate-700">{t.name} · {t.specialty}</span></Row>
            <Row label="מועד"><span className="font-medium text-slate-700">יום {dayName(booked.start)} {shortDate(booked.start)} · {hhmm(booked.start)}</span></Row>
            <Row label="משך"><span className="font-medium text-slate-700">{booked.durationMin} דק׳</span></Row>
          </dl>
        </Card>
        <Button size="lg" className="w-full" onClick={() => navigate('/patient')}>
          <CalendarCheck size={18} /> לתורים שלי
        </Button>
      </div>
    )
  }

  // ---------- "Not sure?" AI path ----------
  if (mode === 'unsure') {
    return <UnsurePath
      isNew={isNewPatient}
      name={name} setName={setName} phone={phone} setPhone={setPhone}
      contactValid={contactValid}
      onBack={() => setMode('book')}
      onProceed={(tId, trId) => { setMode('book'); setTherapistId(tId); setTreatmentId(trId); setSlot(null) }}
      onReferred={(desc, tId) => {
        const patientId = commitContact()
        if (!patientId) return
        submitRequest({ patientId, description: desc, preferredTherapistId: null, visitTypeHint: null, preferredTime: 'גמיש', source: 'הפניה דחופה' })
        navigate('/patient')
      }}
    />
  }

  // ---------- Primary: self-booking ----------
  return (
    <div className="animate-fade space-y-5 max-w-xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{rescheduling ? 'שינוי מועד' : 'קביעת תור'}</h1>
        <p className="text-slate-500 text-sm mt-0.5">בחרו מטפל/ת, טיפול ומועד — התור נשמר מיד</p>
      </div>

      {rescheduling && (
        <div className="flex items-start gap-2.5 rounded-xl ring-1 ring-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <CalendarClock size={16} className="mt-0.5 shrink-0" />
          <span>שינוי מועד לתור <span className="font-medium">{rescheduling.visitType}</span> — התור הקודם יבוטל אוטומטית לאחר קביעת המועד החדש.</span>
        </div>
      )}

      {/* Not-sure entry */}
      <button
        onClick={() => setMode('unsure')}
        className="w-full flex items-center gap-3 rounded-xl ring-1 ring-teal-200 bg-teal-50/60 px-3 py-2.5 text-right"
      >
        <span className="grid place-items-center h-9 w-9 rounded-lg bg-teal-100 text-teal-600 shrink-0"><HelpCircle size={18} /></span>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-800">לא בטוח/ה איזה טיפול מתאים?</p>
          <p className="text-xs text-slate-500">תארו מה מטריד — ה-AI ימליץ על טיפול ומטפל</p>
        </div>
        <ArrowRight size={16} className="text-teal-600" />
      </button>

      {/* Step 1 — provider */}
      <Step n={1} label="בחירת מטפל/ת" done={!!therapistId}>
        <div className="space-y-2">
          {therapists.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTherapist(t.id)}
              className={clsx(
                'w-full flex items-center gap-3 rounded-xl ring-1 px-3 py-2.5 text-right transition',
                therapistId === t.id ? 'ring-teal-500 bg-teal-50' : 'ring-slate-200 bg-white',
              )}
            >
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{t.name}</p>
                <p className="text-xs text-slate-400">{t.specialty}</p>
              </div>
              {therapistId === t.id && <Check size={16} className="text-teal-600" />}
            </button>
          ))}
        </div>
      </Step>

      {/* Step 2 — treatment (filtered to provider) */}
      {therapistId && (
        <Step n={2} label="בחירת טיפול" done={!!treatmentId}>
          <div className="space-y-2">
            {treatmentsForTherapist(therapistId).map((tr) => (
              <button
                key={tr.id}
                onClick={() => pickTreatment(tr.id)}
                className={clsx(
                  'w-full flex items-center justify-between gap-3 rounded-xl ring-1 px-3 py-2.5 text-right transition',
                  treatmentId === tr.id ? 'ring-teal-500 bg-teal-50' : 'ring-slate-200 bg-white',
                )}
              >
                <span className="text-sm font-medium text-slate-800">{tr.name}</span>
                <Badge tone="slate"><Clock size={12} /> {tr.durationMin} דק׳</Badge>
              </button>
            ))}
          </div>
        </Step>
      )}

      {/* Step 3 — date + time */}
      {therapistId && treatmentId && (
        <Step n={3} label="בחירת מועד" done={!!slot}>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5"><CalendarDays size={14} className="text-teal-600" /> תאריך</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => shiftWeek(-1)}
                  disabled={!canPrevWeek}
                  title="שבוע קודם"
                  className="grid place-items-center h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent transition"
                >
                  <ChevronRight size={15} />
                </button>
                <span className="text-[11px] text-slate-400 tabular-nums w-20 text-center">{shortDate(workingDays[0] ?? weekStart)}–{shortDate(addDays(weekStart, 4))}</span>
                <button
                  type="button"
                  onClick={() => shiftWeek(1)}
                  disabled={!canNextWeek}
                  title="שבוע הבא"
                  className="grid place-items-center h-7 w-7 rounded-lg text-slate-500 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent transition"
                >
                  <ChevronLeft size={15} />
                </button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto scroll-thin pb-1">
              {workingDays.map((d) => {
                const active = isSameDay(d, date)
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => { setDate(d); setSlot(null) }}
                    className={clsx('shrink-0 w-16 rounded-xl px-2 py-2 text-center ring-1 transition',
                      active ? 'ring-teal-500 bg-teal-600 text-white' : 'ring-slate-200 text-slate-700')}
                  >
                    <p className="text-[11px]">{isSameDay(d, new Date()) ? 'היום' : `יום ${dayName(d)}`}</p>
                    <p className="text-sm font-bold tabular-nums">{shortDate(d)}</p>
                  </button>
                )
              })}
            </div>
          </div>
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-2"><Clock size={14} className="text-teal-600" /> שעה <span className="text-slate-400">· משבצת של {duration} דק׳ · אפור = תפוס</span></label>
          <div className="grid grid-cols-4 gap-2">
            {slots.map((s) => {
              const isSel = slot && slot.hour === s.hour && slot.minute === s.minute
              return (
                <button
                  key={`${s.hour}:${s.minute}`}
                  disabled={!s.available}
                  onClick={() => setSlot({ hour: s.hour, minute: s.minute })}
                  className={clsx('rounded-lg py-1.5 text-sm font-medium tabular-nums ring-1 transition',
                    isSel && 'bg-teal-600 text-white ring-teal-600',
                    !isSel && s.available && 'bg-white text-slate-600 ring-slate-200 hover:ring-teal-300',
                    !s.available && 'bg-slate-100 text-slate-300 ring-slate-100 line-through cursor-not-allowed')}
                >
                  {hhmm(s.start)}
                </button>
              )
            })}
          </div>
        </Step>
      )}

      {/* Contact details — where reminders are sent; prefilled for a registered
          patient, empty + required for a new one. Shown alongside the date/time
          step so the numbering stays contiguous (1→2→3→4). */}
      {therapistId && treatmentId && (
        <Step n={4} label="פרטים ליצירת קשר" done={contactValid}>
          <ContactFields isNew={isNewPatient} name={name} setName={setName} phone={phone} setPhone={setPhone} />
        </Step>
      )}

      {/* Confirm */}
      <Button size="lg" className="w-full" disabled={!slot || !contactValid} onClick={confirm}>
        <Check size={18} /> {slot ? `אישור — יום ${dayName(date)} ${hhmm(set(date, { hours: slot.hour, minutes: slot.minute }))}` : 'בחרו מועד'}
      </Button>
    </div>
  )
}

function ContactFields({ isNew, name, setName, phone, setPhone }) {
  return (
    <div className="space-y-3">
      {isNew && (
        <div>
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
            <User size={14} className="text-teal-600" /> שם מלא <RequiredMark />
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            aria-required="true"
            placeholder="שם פרטי ומשפחה"
            className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
          <Phone size={14} className="text-teal-600" /> מספר טלפון נייד <RequiredMark />
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          aria-required="true"
          inputMode="tel"
          placeholder="050-0000000"
          className="w-full rounded-xl ring-1 ring-slate-300 px-3 py-2.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-teal-500"
        />
        <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
          <Bell size={12} /> נשלח לכאן תזכורת בוואטסאפ/SMS לפני התור
        </p>
      </div>
    </div>
  )
}

function UnsurePath({ isNew, name, setName, phone, setPhone, contactValid, onBack, onProceed, onReferred }) {
  const { therapistById, treatmentById } = useData()
  const [description, setDescription] = useState('')
  const [result, setResult] = useState(null)

  function analyze(e) {
    e.preventDefault()
    setResult(classifyRequest({ description: description.trim() }))
  }

  return (
    <form onSubmit={analyze} className="animate-fade space-y-4 max-w-xl mx-auto">
      <button type="button" onClick={onBack} className="text-sm text-teal-600 flex items-center gap-1"><ChevronLeft size={16} /> חזרה לבחירה ידנית</button>
      <div>
        <h1 className="text-xl font-bold text-slate-800">לא בטוח/ה מה מתאים?</h1>
        <p className="text-slate-500 text-sm mt-0.5">תארו מה מטריד ותקבלו המלצה חכמה</p>
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">מה מטריד אותך? <span className="text-[11px] text-slate-400">קלט ל-AI</span></label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          placeholder="לדוגמה: כאב גב תחתון אחרי אימון, מקרין לרגל…"
          className="mt-2 w-full rounded-xl ring-1 ring-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none leading-relaxed"
        />
        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1"><Sparkles size={12} /> ה-AI ימליץ על טיפול ומטפל, ויזהה מקרים שעדיף להפנות למרפאה</p>
      </div>
      {!result && (
        <Button type="submit" size="lg" className="w-full" disabled={!description.trim()}><Sparkles size={16} /> קבלת המלצה</Button>
      )}

      {result && (
        <Card className="p-5 bg-teal-50/60 ring-teal-100">
          <div className="flex items-center gap-1.5 text-teal-700 text-sm font-semibold mb-3"><Sparkles size={15} /> ההמלצה שלנו</div>
          {result.urgentFlag ? (
            <>
              <p className="text-sm text-slate-700 leading-relaxed">{result.rationale}</p>
              <Badge tone="red" className="mt-2"><Phone size={12} /> הופנה למרפאה</Badge>
              <div className="mt-4">
                <ContactFields isNew={isNew} name={name} setName={setName} phone={phone} setPhone={setPhone} />
              </div>
              <Button className="w-full mt-4" disabled={!contactValid} onClick={() => onReferred(description.trim(), result.routedTo)}>
                שליחת הפנייה למרפאה
              </Button>
            </>
          ) : (
            <>
              <dl className="space-y-2 text-sm">
                <Row label="טיפול מומלץ"><span className="font-medium text-slate-700">{treatmentById[result.treatmentId]?.name}</span></Row>
                <Row label="מטפל/ת"><span className="font-medium text-slate-700 flex items-center gap-1"><Route size={13} /> {therapistById[result.routedTo]?.name}</span></Row>
              </dl>
              <p className="text-xs text-slate-500 mt-2">{result.rationale}</p>
              <Button className="w-full mt-4" onClick={() => onProceed(result.routedTo, result.treatmentId)}>
                המשך להזמנה <ArrowRight size={16} />
              </Button>
            </>
          )}
        </Card>
      )}
    </form>
  )
}

function Step({ n, label, done, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={clsx('grid place-items-center h-6 w-6 rounded-full text-xs font-bold',
          done ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500')}>{done ? '✓' : n}</span>
        <h3 className="font-semibold text-slate-700 text-sm">{label}</h3>
      </div>
      {children}
    </div>
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
