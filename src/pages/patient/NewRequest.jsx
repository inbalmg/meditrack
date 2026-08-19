import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { addDays, isSameDay, set } from 'date-fns'
import {
  Check, Clock, CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, HelpCircle, ArrowRight, Phone, User, Bell, CalendarClock, Mail, ShieldCheck, HeartHandshake, X, Send, CheckCircle2,
} from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { Card, Button, Badge, RequiredMark } from '../../components/ui.jsx'
import { clsx } from '../../components/clsx.js'
import {
  dayName, shortDate, hhmm,
  firstBookingDay, weekStartOf, maxBookingWeekStart, weekWorkingDays,
  genderLabel,
} from '../../lib/format.js'
import { phoneValid, normalizePhone, birthYearValid, isValidGender, GENDERS, emailValid, normalizeEmail } from '../../lib/validation.js'
import { WORK_START_HOUR, WORK_END_HOUR } from '../../data/seed.js'

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

export default function NewRequest() {
  const {
    bookableTherapists, treatmentsForTherapist, activeTherapists, appointments, currentPatientId,
    therapistById, treatmentById, patientById,
    bookAppointment, submitInquiry, addPatient, updatePatient, setCurrentPatient,
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
  // A patient with no record yet must first complete the onboarding form (personal
  // details + consent) — collected up-front, ONCE, before they reach the booking
  // screen. Once the record is saved, `me` resolves and the gate closes.
  const isNewPatient = !me

  // Contact fields — shared by both screens:
  //   • Onboarding (new patient): start empty, collected + saved via addPatient.
  //   • Booking (registered patient): PRE-FILLED from the saved record and editable;
  //     any change is persisted with updatePatient on confirm.
  // The phone is where appointment reminders (WhatsApp/SMS) are sent.
  const [name, setName] = useState('')
  const [phone, setPhone] = useState(me?.phone ?? '')
  // Year of birth — collected once at onboarding (age is derived from it).
  const [birthYear, setBirthYear] = useState('')
  // Gender — required at onboarding (male/female).
  const [gender, setGender] = useState('')
  // Email — OPTIONAL secondary notification channel.
  const [email, setEmail] = useState(me?.email ?? '')
  // Consent: privacy/terms is a MANDATORY gate (must be accepted to register);
  // notifications (SMS/email) is an OPTIONAL preference, persisted as notify_opt_in.
  // BOTH are collected STRICTLY at onboarding — never shown on the booking form.
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [notifyOptIn, setNotifyOptIn] = useState(true)

  const detailsValid =
    name.trim().length > 0 &&
    phoneValid(phone) &&
    birthYearValid(birthYear) &&
    isValidGender(gender) &&
    (!email.trim() || emailValid(email))
  const onboardingValid = detailsValid && agreeTerms

  // Booking-form contact validity — phone required, email optional-but-valid.
  const contactValid = phoneValid(phone) && (!email.trim() || emailValid(email))

  // Persist edited phone/email back to the patient record. Compares on the normalized
  // form so re-typing the same value with/without dashes (phone) or casing (email)
  // isn't treated as an edit. No-op when nothing changed.
  function persistContactEdits() {
    if (!me) return
    const patch = {}
    if (normalizePhone(phone) !== normalizePhone(me.phone)) patch.phone = phone
    if (normalizeEmail(email) !== normalizeEmail(me.email)) patch.email = email
    if (Object.keys(patch).length) updatePatient(currentPatientId, patch)
  }

  // Create the patient record from the onboarding form, then become the connected
  // patient so the booking screen (and the RLS-scoped inserts that follow) resolve.
  function completeOnboarding() {
    if (!onboardingValid) return
    // addPatient normalizes phone + email; pass the raw values through.
    const p = addPatient({ name: name.trim(), phone, birthYear: Number(birthYear), gender, email, notifyOptIn })
    setCurrentPatient(p.id)
  }

  // "Not sure which treatment?" opens a lightweight inquiry modal that hands the
  // question to the secretary (no AI). `inquirySent` shows a success banner afterward.
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [inquirySent, setInquirySent] = useState(false)
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
    if (!slot || !currentPatientId || !contactValid) return
    // Persist any edit the patient made to their phone/email before booking.
    persistContactEdits()
    const appt = bookAppointment({
      patientId: currentPatientId,
      therapistId,
      treatmentId,
      start: set(date, { hours: slot.hour, minutes: slot.minute, seconds: 0, milliseconds: 0 }),
    })
    // Reschedule = move: drop the original only after the new one is booked.
    if (rescheduleId) cancelAppointment(rescheduleId)
    setBooked(appt)
  }

  // Clear the form to start a fresh request without leaving the page. Needed because
  // the success screen lives on the same route (/patient/new): clicking the "בקשת תור"
  // nav tab while already here doesn't remount, so the confirmation would otherwise
  // stick until the user navigated away and back. The patient is already registered by
  // now, so only the booking selection is reset — personal details stay on file.
  function resetForm() {
    setBooked(null)
    setTherapistId('')
    setTreatmentId('')
    setSlot(null)
    setWeekStart(thisWeekStart)
    setDate(firstDay)
  }

  // ---------- Booked confirmation ----------
  if (booked) {
    const t = therapistById[booked.therapistId]
    return (
      <div className="animate-fade space-y-4 max-w-xl mx-auto">
        <Card className="p-6 text-center">
          <span className="grid place-items-center h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto mb-4"><Check size={32} /></span>
          <h2 className="text-xl font-bold text-slate-800">התור נקבע!</h2>
          <p className="text-slate-500 mt-1 text-sm">שריינו לך מקום ביומן. נשלח תזכורת בוואטסאפ/SMS ל־{me?.phone ?? normalizePhone(phone)}.</p>
        </Card>
        <Card className="p-5">
          <dl className="space-y-2.5 text-sm">
            <Row label="טיפול"><span className="font-medium text-slate-700">{booked.visitType}</span></Row>
            <Row label="מטפל/ת"><span className="font-medium text-slate-700">{t.name} · {t.specialty}</span></Row>
            <Row label="מועד"><span className="font-medium text-slate-700">יום {dayName(booked.start)} {shortDate(booked.start)} · {hhmm(booked.start)}</span></Row>
            <Row label="משך"><span className="font-medium text-slate-700">{booked.durationMin} דק׳</span></Row>
          </dl>
        </Card>
        <div className="flex flex-col gap-2">
          <Button size="lg" className="w-full" onClick={() => navigate('/patient')}>
            <CalendarCheck size={18} /> לתורים שלי
          </Button>
          <Button variant="soft" size="lg" className="w-full" onClick={resetForm}>
            <CalendarClock size={18} /> קביעת תור נוסף
          </Button>
        </div>
      </div>
    )
  }

  // ---------- Onboarding: a new patient completes their details first ----------
  // A patient with no record yet fills the personal-details + consent form BEFORE
  // reaching the booking screen. On submit their `patients` row is created and they
  // become the connected patient, which closes this gate.
  if (isNewPatient) {
    return (
      <Onboarding
        name={name} setName={setName} phone={phone} setPhone={setPhone}
        birthYear={birthYear} setBirthYear={setBirthYear}
        gender={gender} setGender={setGender}
        email={email} setEmail={setEmail}
        agreeTerms={agreeTerms} setAgreeTerms={setAgreeTerms}
        notifyOptIn={notifyOptIn} setNotifyOptIn={setNotifyOptIn}
        canSubmit={onboardingValid}
        onSubmit={completeOnboarding}
      />
    )
  }

  // Subjects for the inquiry dropdown: the unique specialties of the clinic's active
  // therapists (from the DB) + two catch-alls. Not the service/treatment list.
  const inquirySubjects = [
    ...new Set(activeTherapists.map((t) => (t.specialty || '').trim()).filter(Boolean)),
    'אדמיניסטרציה', 'אחר',
  ]

  function sendInquiry(subject, description) {
    submitInquiry({ patientId: currentPatientId, subject, description })
    setInquiryOpen(false)
    setInquirySent(true)
  }

  // ---------- Primary: self-booking ----------
  const firstName = (me?.name ?? '').trim().split(/\s+/)[0]
  return (
    <div className="animate-fade space-y-5 max-w-xl mx-auto">
      <div>
        <p className="text-teal-600 text-sm font-medium">שלום {firstName} 👋</p>
        <h1 className="text-xl font-bold text-slate-800 mt-0.5">{rescheduling ? 'שינוי מועד' : 'קביעת תור'}</h1>
        <p className="text-slate-500 text-sm mt-0.5">בחרו מטפל/ת, טיפול ומועד — התור נשמר מיד</p>
      </div>

      {rescheduling && (
        <div className="flex items-start gap-2.5 rounded-xl ring-1 ring-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <CalendarClock size={16} className="mt-0.5 shrink-0" />
          <span>שינוי מועד לתור <span className="font-medium">{rescheduling.visitType}</span> — התור הקודם יבוטל אוטומטית לאחר קביעת המועד החדש.</span>
        </div>
      )}

      {/* Inquiry sent — success banner */}
      {inquirySent && (
        <div className="flex items-start gap-3 rounded-xl ring-1 ring-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <p className="flex-1 leading-relaxed">הפנייה נשלחה בהצלחה! הצוות שלנו יצור עמך קשר בהקדם.</p>
          <button onClick={() => setInquirySent(false)} aria-label="סגירה" className="text-emerald-600 hover:text-emerald-800 p-0.5 -m-0.5 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Not-sure entry — opens a human inquiry to the clinic team (no AI) */}
      <button
        onClick={() => setInquiryOpen(true)}
        className="group w-full flex items-center gap-3 rounded-xl ring-1 ring-teal-200 bg-teal-50/60 px-3 py-2.5 text-right cursor-pointer shadow-sm transition hover:bg-teal-50 hover:ring-teal-300 hover:shadow-md"
      >
        <span className="grid place-items-center h-9 w-9 rounded-lg bg-teal-100 text-teal-600 shrink-0"><HelpCircle size={18} /></span>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-800">לא בטוח/ה איזה טיפול מתאים?</p>
          <p className="text-xs text-slate-500">שלחו פנייה קצרה והצוות שלנו יחזור אליכם להתאמה אישית</p>
        </div>
        <span className="grid place-items-center h-7 w-7 rounded-full bg-teal-100 text-teal-600 shrink-0 transition-transform group-hover:translate-x-0.5">
          <ArrowRight size={16} />
        </span>
      </button>

      {inquiryOpen && (
        <InquiryDialog
          subjects={inquirySubjects}
          onClose={() => setInquiryOpen(false)}
          onSubmit={sendInquiry}
        />
      )}

      {/* Step 1 — provider */}
      <Step n={1} label="בחירת מטפל/ת" done={!!therapistId}>
        <div className="space-y-2">
          {bookableTherapists.map((t) => (
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

      {/* Step 4 — contact details, PRE-FILLED from the saved record and editable.
          Only phone + email (name/birth-year/gender + consent stay onboarding-only);
          any edit is persisted to the patients row on confirm. */}
      {therapistId && treatmentId && (
        <Step n={4} label="פרטים ליצירת קשר" done={contactValid}>
          <ContactFields isNew={false} name={name} setName={setName} phone={phone} setPhone={setPhone} birthYear={birthYear} setBirthYear={setBirthYear} gender={gender} setGender={setGender} email={email} setEmail={setEmail} />
        </Step>
      )}

      {/* Confirm */}
      <Button size="lg" className="w-full" disabled={!slot || !contactValid} onClick={confirm}>
        <Check size={18} /> {slot ? `אישור — יום ${dayName(date)} ${hhmm(set(date, { hours: slot.hour, minutes: slot.minute }))}` : 'בחרו מועד'}
      </Button>
    </div>
  )
}

// First-step onboarding for a NEW patient: personal details (reusing ContactFields)
// + a mandatory privacy/terms consent and an optional notifications opt-in. On submit
// the caller creates the patients row and the booking screen takes over.
function Onboarding({
  name, setName, phone, setPhone, birthYear, setBirthYear, gender, setGender,
  email, setEmail, agreeTerms, setAgreeTerms, notifyOptIn, setNotifyOptIn,
  canSubmit, onSubmit,
}) {
  return (
    <div className="animate-fade space-y-5 max-w-xl mx-auto">
      <div>
        <span className="grid place-items-center h-12 w-12 rounded-2xl bg-teal-100 text-teal-600 mb-3"><HeartHandshake size={24} /></span>
        <h1 className="text-xl font-bold text-slate-800">ברוכים הבאים למרפאה 👋</h1>
        <p className="text-slate-500 text-sm mt-1">רק כמה פרטים לפתיחת התיק — פעם אחת — ואז נעבור לקביעת התור.</p>
      </div>

      <Card className="p-5 space-y-4">
        <ContactFields isNew name={name} setName={setName} phone={phone} setPhone={setPhone} birthYear={birthYear} setBirthYear={setBirthYear} gender={gender} setGender={setGender} email={email} setEmail={setEmail} />

        <div className="pt-1 space-y-2.5 border-t border-slate-100">
          <div className="pt-3" />
          <CheckRow checked={agreeTerms} onChange={setAgreeTerms}>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-teal-600 shrink-0" />
              <span>קראתי ואני מאשר/ת את <span className="font-medium text-teal-700">מדיניות הפרטיות ותנאי השימוש</span> <RequiredMark /></span>
            </span>
          </CheckRow>
          <CheckRow checked={notifyOptIn} onChange={setNotifyOptIn}>
            <span className="flex items-center gap-1.5">
              <Bell size={14} className="text-teal-600 shrink-0" />
              <span>אשמח לקבל תזכורות והתראות על התורים ב-SMS ובאימייל <span className="text-slate-400">(רשות)</span></span>
            </span>
          </CheckRow>
        </div>
      </Card>

      <Button size="lg" className="w-full" disabled={!canSubmit} onClick={onSubmit}>
        המשך לקביעת תור <ArrowRight size={18} />
      </Button>
    </div>
  )
}

// A labeled checkbox row — the whole row is clickable.
function CheckRow({ checked, onChange, children }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer text-sm text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 accent-teal-600 focus:ring-teal-500"
      />
      <span className="leading-relaxed">{children}</span>
    </label>
  )
}

function ContactFields({ isNew, name, setName, phone, setPhone, birthYear, setBirthYear, gender, setGender, email, setEmail }) {
  const birthYearInvalid = (birthYear ?? '').trim().length > 0 && !birthYearValid(birthYear)
  const phoneInvalid = phone.trim().length > 0 && !phoneValid(phone)
  const emailInvalid = (email ?? '').trim().length > 0 && !emailValid(email)
  // Surface the gender requirement once the user has begun filling the form.
  const genderMissing = isNew && !isValidGender(gender) && (name.trim() !== '' || (birthYear ?? '') !== '' || phone.trim() !== '')
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
      {isNew && (
        <div>
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
            <CalendarDays size={14} className="text-teal-600" /> שנת לידה <RequiredMark />
          </label>
          <input
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            required
            aria-required="true"
            aria-invalid={birthYearInvalid}
            inputMode="numeric"
            maxLength={4}
            placeholder="1990"
            className={clsx(
              'w-full rounded-xl ring-1 px-3 py-2.5 text-sm tabular-nums outline-none focus:ring-2',
              birthYearInvalid ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
            )}
          />
          {birthYearInvalid && <p className="text-[11px] text-red-500 mt-1.5">שנת לידה לא תקינה</p>}
        </div>
      )}
      {isNew && (
        <div>
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
            <User size={14} className="text-teal-600" /> מין <RequiredMark />
          </label>
          <div className="flex gap-2">
            {GENDERS.map((g) => (
              <button
                type="button"
                key={g}
                onClick={() => setGender(g)}
                aria-pressed={gender === g}
                className={clsx(
                  'flex-1 rounded-xl ring-1 px-3 py-2.5 text-sm font-medium transition',
                  gender === g ? 'bg-teal-600 text-white ring-teal-600' : 'bg-white text-slate-600 ring-slate-300 hover:ring-teal-300',
                )}
              >
                {genderLabel(g)}
              </button>
            ))}
          </div>
          {genderMissing && <p className="text-[11px] text-red-500 mt-1.5">יש לבחור מין</p>}
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
          aria-invalid={phoneInvalid}
          inputMode="tel"
          placeholder="050-0000000"
          className={clsx(
            'w-full rounded-xl ring-1 px-3 py-2.5 text-sm tabular-nums outline-none focus:ring-2',
            phoneInvalid ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
          )}
        />
        {phoneInvalid ? (
          <p className="text-[11px] text-red-500 mt-1.5">מספר טלפון נייד לא תקין</p>
        ) : (
          <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
            <Bell size={12} /> נשלח לכאן תזכורת בוואטסאפ/SMS לפני התור
          </p>
        )}
      </div>
      {/* Email — OPTIONAL secondary channel (no RequiredMark). Blocks only when a
          value is present but malformed; empty is always valid. */}
      <div>
        <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
          <Mail size={14} className="text-teal-600" /> אימייל <span className="text-slate-400">(רשות)</span>
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={emailInvalid}
          inputMode="email"
          type="email"
          dir="ltr"
          placeholder="name@example.com"
          className={clsx(
            'w-full rounded-xl ring-1 px-3 py-2.5 text-sm text-right outline-none focus:ring-2',
            emailInvalid ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-teal-500',
          )}
        />
        {emailInvalid ? (
          <p className="text-[11px] text-red-500 mt-1.5">כתובת אימייל לא תקינה</p>
        ) : (
          <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
            <Mail size={12} /> לקבלת אישורים והתראות במייל
          </p>
        )}
      </div>
    </div>
  )
}

// "Not sure which treatment?" — a clean inquiry form handed straight to the secretary
// (no AI). The patient picks a subject (a clinic service, or אדמיניסטרציה / אחר) and may
// add a short free-text detail; on submit the parent persists it and shows a success banner.
// Portal to <body>: the page wrapper keeps a persistent transform (animate-fade), which
// would otherwise capture this fixed overlay and push the centered card off-screen.
function InquiryDialog({ subjects, onClose, onSubmit }) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const canSubmit = subject.trim().length > 0

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit(subject, description.trim())
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center items-start p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-md p-0 overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center h-10 w-10 rounded-xl bg-teal-100 text-teal-600 shrink-0"><HelpCircle size={20} /></span>
            <div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight">פנייה לצוות</h3>
              <p className="text-sm text-slate-400">נחזור אליכם להתאמה אישית</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="סגירה" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 overflow-y-auto scroll-thin space-y-4">
          {/* Subject — required */}
          <div>
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5 mb-1.5">
              נושא הפנייה <RequiredMark />
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              aria-required="true"
              className="w-full h-10 rounded-xl ring-1 ring-slate-300 px-3 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="" disabled>בחרו נושא…</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Free-text detail — optional */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              פירוט קצר <span className="text-[11px] text-slate-400">(רשות)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-xl ring-1 ring-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none leading-relaxed"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            <Send size={16} /> שליחת פנייה לצוות
          </Button>
        </div>
      </Card>
    </div>,
    document.body,
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
