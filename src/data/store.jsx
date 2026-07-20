import { createContext, useContext, useMemo, useState } from 'react'
import { addDays, set } from 'date-fns'
import {
  therapists,
  patients as seedPatients,
  currentPatientId,
  seedRequests,
  seedAppointments,
  seedTasks,
} from './seed.js'
import { classifyRequest } from '../lib/aiClassifier.js'

const DataContext = createContext(null)

let idCounter = 1000
const nextId = (prefix) => `${prefix}${++idCounter}`

// Attach the AI classification to every request once, up front.
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

  // --- Lookups ---
  const patientById = useMemo(
    () => Object.fromEntries(patients.map((p) => [p.id, p])),
    [patients],
  )
  const therapistById = useMemo(
    () => Object.fromEntries(therapists.map((t) => [t.id, t])),
    [],
  )

  // --- Actions ---

  // Register a new patient (e.g. a first-time caller). Returns the created
  // patient so the caller can use its id immediately.
  function addPatient({ name, phone, age = null, gender = null }) {
    const patient = { id: nextId('p'), name, phone, age, gender }
    setPatients((prev) => [...prev, patient])
    return patient
  }

  // Patient submits a new request → AI classifies it → lands in the pipeline.
  function submitRequest({ patientId, description, preferredTherapistId, visitTypeHint, preferredTime }) {
    const base = {
      id: nextId('r'),
      patientId,
      createdAt: new Date(),
      description,
      preferredTherapistId: preferredTherapistId || null,
      visitTypeHint: visitTypeHint || null,
      preferredTime: preferredTime || 'גמיש',
      status: 'ממתין',
    }
    const req = withClassification(base)
    setRequests((prev) => [req, ...prev])
    return req
  }

  // Secretary/manager approves a request → creates a scheduled appointment.
  function approveRequest(requestId, slot) {
    const req = requests.find((r) => r.id === requestId)
    if (!req) return
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'אושר' } : r)),
    )
    // Default slot: tomorrow 09:00 with the AI-routed therapist.
    const start = slot?.start ?? set(addDays(new Date(), 1), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 })
    const appt = {
      id: nextId('a'),
      patientId: req.patientId,
      therapistId: slot?.therapistId ?? req.ai.routedTo,
      start,
      durationMin: slot?.durationMin ?? 20,
      visitType: req.ai.visitType,
      status: 'קבוע',
      reason: req.description,
    }
    setAppointments((prev) => [...prev, appt])
    return appt
  }

  function rejectRequest(requestId) {
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'נדחה' } : r)),
    )
  }

  // Secretary marks arrival / check-out from the calendar.
  function setAppointmentStatus(apptId, status) {
    setAppointments((prev) =>
      prev.map((a) => (a.id === apptId ? { ...a, status } : a)),
    )
    // Automation: a no-show spawns a follow-up task.
    if (status === 'לא הגיע') {
      const appt = appointments.find((a) => a.id === apptId)
      if (appt) {
        setTasks((prev) => [
          {
            id: nextId('k'),
            title: `פולו-אפ אי-הגעה — ${patientById[appt.patientId]?.name ?? ''}`,
            patientId: appt.patientId,
            assigneeId: appt.therapistId,
            due: new Date(),
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
    patients,
    currentPatientId,
    requests,
    appointments,
    tasks,
    patientById,
    therapistById,
    addPatient,
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
