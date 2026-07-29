import { createContext, useContext, useMemo, useState } from 'react'
import { addDays, addHours, set } from 'date-fns'
import {
  therapists as seedTherapists,
  treatments as seedTreatments,
  patients as seedPatients,
  currentPatientId as seedCurrentPatientId,
  seedRequests,
  seedAppointments,
  seedTasks,
  seedStaff,
  AUTO_TASK_DUE_HOURS,
} from './seed.js'
import { classifyRequest } from '../lib/aiClassifier.js'
import { hhmm, dayName, shortDate } from '../lib/format.js'

const DataContext = createContext(null)

let idCounter = 1000
const nextId = (prefix) => `${prefix}${++idCounter}`

// Demo trigger for the patient confirmation message (WhatsApp/SMS). Messaging is
// the real cost center, so it's kept as a swappable stub — like the AI classifier:
// in production this calls the provider API; here it logs the outbound message.
function sendAppointmentConfirmation(appt, { patient, therapist }) {
  if (!patient?.phone) return null
  const when = `יום ${dayName(appt.start)} ${shortDate(appt.start)} בשעה ${hhmm(appt.start)}`
  const msg = `שלום ${patient.name}, תורך ל${appt.visitType} עם ${therapist?.name ?? ''} נקבע ל${when}. מרפאת MediTrack — לשינוי/ביטול השיבו להודעה זו.`
  console.info(`📲 [WhatsApp/SMS → ${patient.phone}] ${msg}`)
  return msg
}

// Attach the AI classification to every "not sure?" request once, up front.
function withClassification(req) {
  return {
    ...req,
    ai: classifyRequest({
      description: req.description,
      preferredTherapistId: req.preferredTherapistId,
      visitTypeHint: req.visitTypeHint,
    }),
  }
}

export function DataProvider({ children }) {
  const [requests, setRequests] = useState(() => seedRequests.map(withClassification))
  const [appointments, setAppointments] = useState(seedAppointments)
  const [tasks, setTasks] = useState(seedTasks)
  const [patients, setPatients] = useState(seedPatients)
  const [therapists, setTherapists] = useState(seedTherapists)
  const [treatments, setTreatments] = useState(seedTreatments)
  const [staff, setStaff] = useState(seedStaff)
  // The signed-in patient for the mobile portal. Set at login: an existing
  // patient id ('p1') or `null` for a first-time (new) patient with no record yet.
  const [currentPatientId, setCurrentPatient] = useState(seedCurrentPatientId)

  // Operational settings, editable from the Settings screen.
  const [settings, setSettings] = useState({
    remindersEnabled: true,
    reminderHours: 24,
    autoNoShow: true,
    noShowMinutes: 15,
    followUpOnNoShow: true,
  })

  // --- Lookups ---
  const patientById = useMemo(
    () => Object.fromEntries(patients.map((p) => [p.id, p])),
    [patients],
  )
  const therapistById = useMemo(
    () => Object.fromEntries(therapists.map((t) => [t.id, t])),
    [therapists],
  )
  const treatmentById = useMemo(
    () => Object.fromEntries(treatments.map((t) => [t.id, t])),
    [treatments],
  )
  // Treatment length per treatment NAME — kept for the scheduling slot grid and
  // any display-only screen that still reads `visitDurations[appt.visitType]`.
  const visitDurations = useMemo(
    () => Object.fromEntries(treatments.map((t) => [t.name, t.durationMin])),
    [treatments],
  )
  // Which treatments a given provider offers (drives the patient booking flow).
  function treatmentsForTherapist(therapistId) {
    return treatments.filter((t) => t.therapistIds.includes(therapistId))
  }

  // --- Settings actions ---

  function updateSettings(patch) {
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  function updateTherapist(id, patch) {
    setTherapists((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  // Treatment management (Settings): name, duration, provider assignment.
  function addTreatment({ name, durationMin, therapistIds }) {
    const tr = { id: nextId('tr'), name, durationMin, therapistIds: therapistIds ?? [] }
    setTreatments((prev) => [...prev, tr])
    return tr
  }
  function updateTreatment(id, patch) {
    setTreatments((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }
  function removeTreatment(id) {
    setTreatments((prev) => prev.filter((t) => t.id !== id))
  }

  function addStaff({ name, roleId }) {
    const member = { id: nextId('u'), name, roleId }
    setStaff((prev) => [...prev, member])
    return member
  }
  function updateStaff(id, patch) {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }
  function removeStaff(id) {
    setStaff((prev) => prev.filter((s) => s.id !== id))
  }

  // --- Actions ---

  // Register a new patient (e.g. a first-time caller). Returns the created patient.
  function addPatient({ name, phone, age = null, gender = null }) {
    const patient = { id: nextId('p'), name, phone, age, gender }
    setPatients((prev) => [...prev, patient])
    return patient
  }

  // Update a patient record (e.g. the phone the patient enters/confirms while
  // booking, so appointment reminders go to the right number).
  function updatePatient(id, patch) {
    setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  // PRIMARY path — the patient self-books: provider → treatment → slot. Creates a
  // confirmed appointment directly (no secretary approval); the reserved length
  // comes from the treatment definition.
  function bookAppointment({ patientId, therapistId, treatmentId, start, reason }) {
    const tr = treatmentById[treatmentId]
    if (!tr) return null
    const appt = {
      id: nextId('a'),
      patientId,
      therapistId,
      treatmentId,
      start,
      durationMin: tr.durationMin,
      visitType: tr.name,
      status: 'קבוע',
      reason: reason || tr.name,
      source: 'הזמנה עצמית',
    }
    setAppointments((prev) => [...prev, appt])
    return appt
  }

  // Patient cancels one of their own upcoming appointments (frees the slot).
  function cancelAppointment(apptId) {
    setAppointments((prev) => prev.filter((a) => a.id !== apptId))
  }

  // SECONDARY path — "not sure?" free-text request → AI classifies → lands in the
  // clinic pipeline for a person to confirm/route.
  function submitRequest({ patientId, description, preferredTherapistId, visitTypeHint, preferredTime, source }) {
    const base = {
      id: nextId('r'),
      patientId,
      createdAt: new Date(),
      description,
      preferredTherapistId: preferredTherapistId || null,
      visitTypeHint: visitTypeHint || null,
      preferredTime: preferredTime || 'גמיש',
      source: source || 'פורטל',
      status: 'ממתין',
    }
    const req = withClassification(base)
    setRequests((prev) => [req, ...prev])
    return req
  }

  // Secretary/therapist confirms an AI-path request → creates a scheduled appointment.
  function approveRequest(requestId, slot) {
    const req = requests.find((r) => r.id === requestId)
    if (!req) return
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'אושר' } : r)),
    )
    const start = slot?.start ?? set(addDays(new Date(), 1), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 })
    const treatmentId = slot?.treatmentId ?? req.ai.treatmentId ?? null
    const tr = treatmentId ? treatmentById[treatmentId] : null
    const appt = {
      id: nextId('a'),
      patientId: req.patientId,
      therapistId: slot?.therapistId ?? req.ai.routedTo,
      treatmentId,
      start,
      durationMin: slot?.durationMin ?? tr?.durationMin ?? 30,
      visitType: tr?.name ?? req.ai.visitType,
      status: 'קבוע',
      reason: req.description,
    }
    setAppointments((prev) => [...prev, appt])
    // Optionally notify the patient (WhatsApp/SMS) with the scheduled details.
    if (slot?.notify) {
      sendAppointmentConfirmation(appt, {
        patient: patientById[req.patientId],
        therapist: therapistById[appt.therapistId],
      })
    }
    return appt
  }

  function rejectRequest(requestId) {
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'נדחה' } : r)),
    )
  }

  // Provider/secretary marks arrival / check-out from the calendar.
  function setAppointmentStatus(apptId, status) {
    setAppointments((prev) =>
      prev.map((a) => (a.id === apptId ? { ...a, status } : a)),
    )
    // Automation: a no-show spawns a follow-up task (can be turned off in Settings).
    if (status === 'לא הגיע' && settings.followUpOnNoShow) {
      const appt = appointments.find((a) => a.id === apptId)
      if (appt) {
        setTasks((prev) => [
          {
            id: nextId('k'),
            title: `פולו-אפ אי-הגעה — ${patientById[appt.patientId]?.name ?? ''}`,
            patientId: appt.patientId,
            assigneeId: appt.therapistId,
            createdAt: new Date(),
            // מקור המשימה — שעת התור שלא הגיע, כדי שהיעד לא ינותק מרגע ההתרחשות.
            sourceAt: appt.start,
            // חלון טיפול קדימה — שלא תיוולד מיד "באיחור" ברגע האי-הגעה.
            due: addHours(new Date(), AUTO_TASK_DUE_HOURS),
            status: 'פתוח',
            source: 'אוטומציה',
            note: 'נוצר אוטומטית לאחר אי-הגעה. ליצור קשר ולתאם מחדש.',
          },
          ...prev,
        ])
      }
    }
  }

  function setTaskStatus(taskId, status) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)))
  }

  function addTask({ title, patientId, assigneeId, due, note }) {
    setTasks((prev) => [
      {
        id: nextId('k'),
        title,
        patientId: patientId || null,
        assigneeId: assigneeId || null,
        createdAt: new Date(),
        due: due || new Date(),
        status: 'פתוח',
        source: 'ידני',
        note: note || '',
      },
      ...prev,
    ])
  }

  const value = {
    therapists,
    treatments,
    patients,
    currentPatientId,
    requests,
    appointments,
    tasks,
    staff,
    settings,
    setCurrentPatient,
    visitDurations,
    patientById,
    therapistById,
    treatmentById,
    treatmentsForTherapist,
    updateSettings,
    updateTherapist,
    addTreatment,
    updateTreatment,
    removeTreatment,
    addStaff,
    updateStaff,
    removeStaff,
    addPatient,
    updatePatient,
    bookAppointment,
    cancelAppointment,
    submitRequest,
    approveRequest,
    rejectRequest,
    setAppointmentStatus,
    setTaskStatus,
    addTask,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
