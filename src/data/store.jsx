import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { addHours } from 'date-fns'
import { supabase } from '../lib/supabase.js'
import { useSession } from '../session.jsx'
import { classifyRequest } from '../lib/aiClassifier.js'
import { ageFromBirthYear } from '../lib/format.js'
import { AUTO_TASK_DUE_HOURS } from './seed.js'

// DataProvider — the SAME useData() contract as before, now backed by Supabase.
// State is a local mirror hydrated from the DB on login (RLS-scoped to the signed-in
// user). Every action updates the mirror synchronously (so the sync UI contract and
// return values are unchanged) and persists to the DB in the background. New rows use
// a client-generated UUID so the local id equals the DB id. Refresh no longer resets
// the session (Supabase persists it).

const DataContext = createContext(null)

const uuid = () => crypto.randomUUID()

// Fire-and-forget persistence: surface failures in the console without blocking the UI.
function persist(promiseLike, label) {
  Promise.resolve(promiseLike).then(({ error } = {}) => {
    if (error) console.error(`[persist] ${label}:`, error.message)
  }).catch((e) => console.error(`[persist] ${label}:`, e?.message ?? e))
}

const DEFAULT_SETTINGS = {
  remindersEnabled: true, reminderHours: 24, autoNoShow: true, noShowMinutes: 15, followUpOnNoShow: true,
}

// --- DB row → app-shape mappers (reproduce the exact objects components expect) ---
const mapTherapist = (r) => ({ id: r.id, name: r.name, specialty: r.specialty, color: r.color, initials: r.initials })
// `age` is derived from `birth_year` so it never goes stale; legacy rows without a
// birth year fall back to their stored `age`.
const mapPatient = (r) => {
  const birthYear = r.birth_year ?? null
  return { id: r.id, name: r.name, phone: r.phone, birthYear, age: ageFromBirthYear(birthYear) ?? r.age ?? null, gender: r.gender }
}
const mapStaff = (r) => ({ id: r.id, name: r.name, roleId: r.role })
const mapAppt = (r) => ({
  id: r.id, patientId: r.patient_id, therapistId: r.therapist_id, treatmentId: r.treatment_id,
  start: new Date(r.start), durationMin: r.duration_min, visitType: r.visit_type,
  status: r.status, reason: r.reason, source: r.source, clinicalNote: r.clinical_note ?? null,
})
const mapTask = (r) => ({
  id: r.id, title: r.title, patientId: r.patient_id, assigneeId: r.assignee_id,
  createdBy: r.created_by ?? null,
  createdAt: new Date(r.created_at), sourceAt: r.source_at ? new Date(r.source_at) : undefined,
  due: r.due ? new Date(r.due) : new Date(), status: r.status, source: r.source, note: r.note,
  completedAt: r.completed_at ? new Date(r.completed_at) : undefined,
})

export function DataProvider({ children }) {
  const { status, role, clinicId, userId } = useSession()

  const [requests, setRequests] = useState([])
  const [appointments, setAppointments] = useState([])
  const [tasks, setTasks] = useState([])
  const [patients, setPatients] = useState([])
  const [therapists, setTherapists] = useState([])
  const [treatments, setTreatments] = useState([])
  const [staff, setStaff] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [currentPatientId, setCurrentPatient] = useState(null)
  const [ready, setReady] = useState(false)

  // --- Hydrate from Supabase once authenticated (RLS scopes rows to the user). ---
  useEffect(() => {
    if (status !== 'authed') {
      // Logged out / restoring: drop the mirror so a role switch re-hydrates cleanly
      // and no previous user's data lingers in memory.
      setReady(false)
      setRequests([]); setAppointments([]); setTasks([]); setPatients([])
      setTherapists([]); setTreatments([]); setStaff([]); setCurrentPatient(null)
      return
    }
    let active = true
    ;(async () => {
      setReady(false)
      const [th, tr, tp, pt, ap, rq, tk, st, cl] = await Promise.all([
        supabase.from('therapists').select('*'),
        supabase.from('treatments').select('*').eq('active', true),
        supabase.from('treatment_providers').select('treatment_id,therapist_id'),
        supabase.from('patients').select('*'),
        supabase.from('appointments').select('*'),
        supabase.from('requests').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('staff').select('*'),
        supabase.from('clinics').select('settings').maybeSingle(),
      ])
      if (!active) return

      const providersByTreatment = new Map()
      for (const p of tp.data ?? []) {
        const list = providersByTreatment.get(p.treatment_id) ?? []
        list.push(p.therapist_id)
        providersByTreatment.set(p.treatment_id, list)
      }
      const mappedTreatments = (tr.data ?? []).map((r) => ({
        id: r.id, name: r.name, durationMin: r.duration_min,
        therapistIds: providersByTreatment.get(r.id) ?? [],
      }))
      const firstProvider = (treatmentId) =>
        mappedTreatments.find((t) => t.id === treatmentId)?.therapistIds?.[0] ?? null
      // UUID-correct AI: reuse the local classifier for urgency/tags, remap ids to the DB.
      const aiFor = (input) => {
        const base = classifyRequest(input)
        const t = mappedTreatments.find((x) => x.name === base.visitType)
        const treatmentId = t?.id ?? null
        return { ...base, treatmentId, routedTo: input.preferredTherapistId || firstProvider(treatmentId) }
      }

      setTherapists((th.data ?? []).map(mapTherapist))
      setTreatments(mappedTreatments)
      setPatients((pt.data ?? []).map(mapPatient))
      setAppointments((ap.data ?? []).map(mapAppt))
      setTasks((tk.data ?? []).map(mapTask))
      setStaff((st.data ?? []).map(mapStaff))
      setSettings(cl.data?.settings ?? DEFAULT_SETTINGS)
      setRequests((rq.data ?? []).map((r) => ({
        id: r.id, patientId: r.patient_id, createdAt: new Date(r.created_at),
        description: r.description, preferredTherapistId: r.preferred_therapist_id,
        visitTypeHint: r.visit_type_hint, preferredTime: r.preferred_time,
        source: r.source, status: r.status,
        ai: r.ai ?? aiFor({ description: r.description, preferredTherapistId: r.preferred_therapist_id, visitTypeHint: r.visit_type_hint }),
      })))
      // A patient sees only their own patient row (RLS) — that's their currentPatientId.
      setCurrentPatient(role?.isPatient ? ((pt.data ?? [])[0]?.id ?? null) : null)
      setReady(true)
    })()
    return () => { active = false }
  }, [status, role?.id])

  // --- Lookups (unchanged) ---
  const patientById = useMemo(() => Object.fromEntries(patients.map((p) => [p.id, p])), [patients])
  const therapistById = useMemo(() => Object.fromEntries(therapists.map((t) => [t.id, t])), [therapists])
  const treatmentById = useMemo(() => Object.fromEntries(treatments.map((t) => [t.id, t])), [treatments])

  // People a task can be assigned to: treatment providers + office staff
  // (secretary/manager). Staff rows carry no avatar, so derive initials + a neutral
  // color, and tag each with `kind` so the picker can group them.
  const assignees = useMemo(() => {
    const OFFICE_ROLES = ['secretary', 'manager']
    const OFFICE_COLOR = '#64748b' // slate — distinct from the therapist palette
    const initialsOf = (name) => (name || '').trim().split(/\s+/).map((w) => w[0] || '').slice(0, 2).join('')
    return [
      ...therapists.map((t) => ({ id: t.id, name: t.name, initials: t.initials, color: t.color, kind: 'therapist' })),
      ...staff
        .filter((s) => OFFICE_ROLES.includes(s.roleId))
        .map((s) => ({ id: s.id, name: s.name, initials: initialsOf(s.name), color: OFFICE_COLOR, kind: s.roleId })),
    ]
  }, [therapists, staff])
  const assigneeById = useMemo(() => Object.fromEntries(assignees.map((a) => [a.id, a])), [assignees])
  const visitDurations = useMemo(() => Object.fromEntries(treatments.map((t) => [t.name, t.durationMin])), [treatments])
  const firstProviderFor = (treatmentId) => treatmentById[treatmentId]?.therapistIds?.[0] ?? null
  function treatmentsForTherapist(therapistId) {
    return treatments.filter((t) => t.therapistIds.includes(therapistId))
  }
  function aiFor(input) {
    const base = classifyRequest(input)
    const t = treatments.find((x) => x.name === base.visitType)
    const treatmentId = t?.id ?? null
    return { ...base, treatmentId, routedTo: input.preferredTherapistId || firstProviderFor(treatmentId) }
  }

  // "Not sure?" recommendation — ask the server (Claude when configured) so the
  // urgent safety-net gate and the treatment suggestion use the real classifier,
  // not just local keywords. Falls back to the local classifier if offline/failing.
  async function classifyAsync(input) {
    try {
      const { data, error } = await supabase.functions.invoke('classify-request', { body: input })
      if (error || !data || data.error) throw error ?? new Error('classify failed')
      return data
    } catch {
      return aiFor(input)
    }
  }

  // --- Settings ---
  function updateSettings(patch) {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      if (clinicId) persist(supabase.from('clinics').update({ settings: next }).eq('id', clinicId), 'updateSettings')
      return next
    })
  }

  function updateTherapist(id, patch) {
    setTherapists((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    persist(supabase.from('therapists').update(patch).eq('id', id), 'updateTherapist')
  }

  // --- Treatments (Settings) ---
  function addTreatment({ name, durationMin, therapistIds }) {
    const tr = { id: uuid(), name, durationMin, therapistIds: therapistIds ?? [] }
    setTreatments((prev) => [...prev, tr])
    persist(supabase.from('treatments').insert({ id: tr.id, clinic_id: clinicId, name, duration_min: durationMin }), 'addTreatment')
    if (tr.therapistIds.length) {
      persist(supabase.from('treatment_providers').insert(
        tr.therapistIds.map((tid) => ({ treatment_id: tr.id, therapist_id: tid, clinic_id: clinicId })),
      ), 'addTreatment.providers')
    }
    return tr
  }
  function updateTreatment(id, patch) {
    setTreatments((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    const row = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.durationMin !== undefined) row.duration_min = patch.durationMin
    if (Object.keys(row).length) persist(supabase.from('treatments').update(row).eq('id', id), 'updateTreatment')
    if (patch.therapistIds !== undefined) {
      // Reconcile the M:N join: replace the provider set for this treatment.
      persist((async () => {
        await supabase.from('treatment_providers').delete().eq('treatment_id', id)
        if (patch.therapistIds.length) {
          return supabase.from('treatment_providers').insert(
            patch.therapistIds.map((tid) => ({ treatment_id: id, therapist_id: tid, clinic_id: clinicId })),
          )
        }
        return {}
      })(), 'updateTreatment.providers')
    }
  }
  function removeTreatment(id) {
    setTreatments((prev) => prev.filter((t) => t.id !== id))
    persist(supabase.from('treatments').delete().eq('id', id), 'removeTreatment')
  }

  // --- Staff (Settings) ---
  function addStaff({ name, roleId }) {
    const member = { id: uuid(), name, roleId }
    setStaff((prev) => [...prev, member])
    persist(supabase.from('staff').insert({ id: member.id, clinic_id: clinicId, name, role: roleId }), 'addStaff')
    return member
  }
  function updateStaff(id, patch) {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    const row = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.roleId !== undefined) row.role = patch.roleId
    persist(supabase.from('staff').update(row).eq('id', id), 'updateStaff')
  }
  function removeStaff(id) {
    setStaff((prev) => prev.filter((s) => s.id !== id))
    persist(supabase.from('staff').delete().eq('id', id), 'removeStaff')
  }

  // --- Patients ---
  function addPatient({ name, phone, birthYear = null, gender = null }) {
    // Store the birth year (the stable fact); age is derived from it. The legacy
    // `age` column is kept populated with the derived value for backward compat.
    const age = ageFromBirthYear(birthYear)
    const patient = { id: uuid(), name, phone, birthYear, age, gender }
    setPatients((prev) => [...prev, patient])
    persist(supabase.from('patients').insert({ id: patient.id, clinic_id: clinicId, name, phone, birth_year: birthYear, age, gender }), 'addPatient')
    return patient
  }
  function updatePatient(id, patch) {
    setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    persist(supabase.from('patients').update(patch).eq('id', id), 'updatePatient')
  }

  // --- PRIMARY path: patient self-books (confirmed, no approval) ---
  function bookAppointment({ patientId, therapistId, treatmentId, start, reason }) {
    const tr = treatmentById[treatmentId]
    if (!tr) return null
    const appt = {
      id: uuid(), patientId, therapistId, treatmentId, start,
      durationMin: tr.durationMin, visitType: tr.name, status: 'קבוע',
      reason: reason || tr.name, source: 'הזמנה עצמית',
    }
    setAppointments((prev) => [...prev, appt])
    persist(supabase.from('appointments').insert({
      id: appt.id, clinic_id: clinicId, patient_id: patientId, therapist_id: therapistId,
      treatment_id: treatmentId, start: start.toISOString(), duration_min: tr.durationMin,
      visit_type: tr.name, status: 'קבוע', reason: appt.reason, source: 'הזמנה עצמית',
    }), 'bookAppointment')
    return appt
  }

  function cancelAppointment(apptId) {
    setAppointments((prev) => prev.filter((a) => a.id !== apptId))
    persist(supabase.from('appointments').delete().eq('id', apptId), 'cancelAppointment')
  }

  // --- SECONDARY path: "not sure?" request → AI classify → clinic pipeline ---
  function submitRequest({ patientId, description, preferredTherapistId, visitTypeHint, preferredTime, source }) {
    const id = uuid()
    const input = { description, preferredTherapistId: preferredTherapistId || null, visitTypeHint: visitTypeHint || null }
    const req = {
      id, patientId, createdAt: new Date(), description,
      preferredTherapistId: input.preferredTherapistId, visitTypeHint: input.visitTypeHint,
      preferredTime: preferredTime || 'גמיש', source: source || 'פורטל', status: 'ממתין',
      ai: aiFor(input),
    }
    setRequests((prev) => [req, ...prev])
    persist(supabase.from('requests').insert({
      id, clinic_id: clinicId, patient_id: patientId, description,
      preferred_therapist_id: input.preferredTherapistId, visit_type_hint: input.visitTypeHint,
      preferred_time: req.preferredTime, source: req.source, status: 'ממתין', ai: req.ai,
    }), 'submitRequest')
    // Refine classification server-side (Claude when configured); update if it returns.
    supabase.functions.invoke('classify-request', { body: input }).then(({ data }) => {
      if (!data || data.error) return
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ai: data } : r)))
      persist(supabase.from('requests').update({ ai: data }).eq('id', id), 'submitRequest.ai')
    }).catch(() => {})
    return req
  }

  function approveRequest(requestId, slot) {
    const req = requests.find((r) => r.id === requestId)
    if (!req) return
    const apptId = uuid()
    const start = slot?.start ?? addHours(new Date(), 24)
    const treatmentId = slot?.treatmentId ?? req.ai.treatmentId ?? null
    const tr = treatmentId ? treatmentById[treatmentId] : null
    const therapistId = slot?.therapistId ?? req.ai.routedTo
    const appt = {
      id: apptId, patientId: req.patientId, therapistId, treatmentId, start,
      durationMin: slot?.durationMin ?? tr?.durationMin ?? 30,
      visitType: tr?.name ?? req.ai.visitType, status: 'קבוע', reason: req.description,
    }
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'אושר' } : r)))
    setAppointments((prev) => [...prev, appt])
    persist(supabase.from('appointments').insert({
      id: apptId, clinic_id: clinicId, patient_id: req.patientId, therapist_id: therapistId,
      treatment_id: treatmentId, start: start.toISOString(), duration_min: appt.durationMin,
      visit_type: appt.visitType, status: 'קבוע', reason: req.description,
    }), 'approveRequest.appt')
    persist(supabase.from('requests').update({ status: 'אושר', appointment_id: apptId }).eq('id', requestId), 'approveRequest.req')
    if (slot?.notify) {
      supabase.functions.invoke('send-reminder', { body: { appointmentId: apptId } }).catch(() => {})
    }
    return appt
  }

  function rejectRequest(requestId) {
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'נדחה' } : r)))
    persist(supabase.from('requests').update({ status: 'נדחה' }).eq('id', requestId), 'rejectRequest')
  }

  // --- Status + tasks ---
  // Build the auto follow-up task that a no-show spawns (shared by the single and
  // bulk resolution paths so the task shape stays defined in one place).
  function makeNoShowFollowUp(appt) {
    return {
      id: uuid(), title: `פולו-אפ אי-הגעה — ${patientById[appt.patientId]?.name ?? ''}`,
      patientId: appt.patientId, assigneeId: appt.therapistId, createdAt: new Date(),
      sourceAt: appt.start, due: addHours(new Date(), AUTO_TASK_DUE_HOURS),
      status: 'פתוח', source: 'אוטומציה', note: 'נוצר אוטומטית לאחר אי-הגעה. ליצור קשר ולתאם מחדש.',
    }
  }
  const followUpRow = (task) => ({
    id: task.id, clinic_id: clinicId, title: task.title, patient_id: task.patientId,
    assignee_id: task.assigneeId, source_at: task.sourceAt.toISOString(), due: task.due.toISOString(),
    status: 'פתוח', source: 'אוטומציה', note: task.note,
  })

  function setAppointmentStatus(apptId, newStatus) {
    setAppointments((prev) => prev.map((a) => (a.id === apptId ? { ...a, status: newStatus } : a)))
    // Therapists lack a direct UPDATE grant on appointments (RLS); they persist their
    // own arrived/completed changes through a narrow RPC (migration 15). Staff update
    // the row directly (RLS-scoped by clinic).
    if (role?.id === 'therapist') {
      persist(supabase.rpc('set_appointment_status', { p_appt: apptId, p_status: newStatus }), 'setAppointmentStatus')
    } else {
      persist(supabase.from('appointments').update({ status: newStatus }).eq('id', apptId), 'setAppointmentStatus')
    }
    if (newStatus === 'לא הגיע' && settings.followUpOnNoShow) {
      const appt = appointments.find((a) => a.id === apptId)
      if (appt) {
        const task = makeNoShowFollowUp(appt)
        setTasks((prev) => [task, ...prev])
        persist(supabase.from('tasks').insert(followUpRow(task)), 'noShowFollowUp')
      }
    }
  }

  // Batch-resolve a backlog of unresolved past appointments as no-shows: one
  // state update + one persist round, each spawning its follow-up task (same
  // automation as a single no-show). Skips any id that isn't still 'קבוע'.
  function bulkMarkNoShow(ids) {
    const set = new Set(ids)
    const affected = appointments.filter((a) => set.has(a.id) && a.status === 'קבוע')
    if (!affected.length) return
    const affectedIds = affected.map((a) => a.id)
    setAppointments((prev) => prev.map((a) => (set.has(a.id) && a.status === 'קבוע' ? { ...a, status: 'לא הגיע' } : a)))
    persist(supabase.from('appointments').update({ status: 'לא הגיע' }).in('id', affectedIds), 'bulkMarkNoShow')
    if (settings.followUpOnNoShow) {
      const newTasks = affected.map(makeNoShowFollowUp)
      setTasks((prev) => [...newTasks, ...prev])
      persist(supabase.from('tasks').insert(newTasks.map(followUpRow)), 'bulkNoShowFollowUp')
    }
  }

  // A therapist authors the clinical note (visit summary) on a visit they conducted.
  // Persisted via a narrow SECURITY DEFINER RPC that writes ONLY clinical_note for the
  // caller's own appointment (see migration 14) — no broad UPDATE grant on appointments.
  function saveClinicalNote(apptId, note) {
    const value = note?.trim() ? note.trim() : null
    setAppointments((prev) => prev.map((a) => (a.id === apptId ? { ...a, clinicalNote: value } : a)))
    persist(supabase.rpc('set_clinical_note', { p_appt: apptId, p_note: value }), 'saveClinicalNote')
  }

  function setTaskStatus(taskId, newStatus) {
    // Stamp completedAt when a task enters "הושלם"; clear it if it ever leaves,
    // so the Task Board recency filter can bucket completed work by completion time.
    const completedAt = newStatus === 'הושלם' ? new Date() : undefined
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, completedAt } : t)))
    persist(
      supabase.from('tasks').update({ status: newStatus, completed_at: completedAt ? completedAt.toISOString() : null }).eq('id', taskId),
      'setTaskStatus',
    )
  }

  function addTask({ title, patientId, assigneeId, due, note }) {
    const task = {
      id: uuid(), title, patientId: patientId || null, assigneeId: assigneeId || null,
      createdBy: userId ?? null,
      createdAt: new Date(), due: due || new Date(), status: 'פתוח', source: 'ידני', note: note || '',
    }
    setTasks((prev) => [task, ...prev])
    persist(supabase.from('tasks').insert({
      id: task.id, clinic_id: clinicId, title, patient_id: task.patientId, assignee_id: task.assigneeId,
      created_by: task.createdBy, due: task.due.toISOString(), status: 'פתוח', source: 'ידני', note: task.note,
    }), 'addTask')
  }

  // Edit an existing task (title / assignee / due / note). Only the given keys are
  // touched; maps camelCase patch keys to the DB columns.
  function updateTask(id, patch) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    const row = {}
    if (patch.title !== undefined) row.title = patch.title
    if (patch.assigneeId !== undefined) row.assignee_id = patch.assigneeId
    if (patch.note !== undefined) row.note = patch.note
    if (patch.due !== undefined) row.due = patch.due instanceof Date ? patch.due.toISOString() : patch.due
    persist(supabase.from('tasks').update(row).eq('id', id), 'updateTask')
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    persist(supabase.from('tasks').delete().eq('id', id), 'deleteTask')
  }

  const value = {
    therapists, treatments, patients, currentPatientId, requests, appointments, tasks, staff, settings,
    setCurrentPatient, visitDurations, patientById, therapistById, treatmentById, treatmentsForTherapist, aiFor, classifyAsync,
    assignees, assigneeById,
    updateSettings, updateTherapist, addTreatment, updateTreatment, removeTreatment,
    addStaff, updateStaff, removeStaff, addPatient, updatePatient,
    bookAppointment, cancelAppointment, submitRequest, approveRequest, rejectRequest,
    setAppointmentStatus, bulkMarkNoShow, saveClinicalNote, setTaskStatus, addTask, updateTask, deleteTask,
  }

  const gated = status === 'loading' || (status === 'authed' && !ready)

  return (
    <DataContext.Provider value={value}>
      {gated ? <LoadingScreen /> : children}
    </DataContext.Provider>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <span className="h-8 w-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
        <span className="text-sm">טוען נתונים…</span>
      </div>
    </div>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
