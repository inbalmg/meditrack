import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { addHours, subDays } from 'date-fns'
import { supabase } from '../lib/supabase.js'
import { useSession } from '../session.jsx'
import { classifyRequest } from '../lib/aiClassifier.js'
import { ageFromBirthYear } from '../lib/format.js'
import { normalizeName, validateStaffName, isValidStaffRole, validateTherapistName, validateSpecialty, phoneValid, normalizePhone, birthYearValid, isValidGender, normalizeEmail, emailValid } from '../lib/validation.js'
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
  remindersEnabled: true, autoNoShow: true, noShowMinutes: 15, followUpOnNoShow: true,
}

// The task board mirror holds every open/in-progress task, but only the last
// N days of COMPLETED ones — older completed work lives behind the on-demand,
// server-paginated Task Archive drawer so the board query stays bounded.
export const MAIN_BOARD_DONE_DAYS = 15
// Archive drawer: server-side page size (SQL limit) for the "Load More" pager.
export const ARCHIVE_PAGE_SIZE = 20

// --- DB row → app-shape mappers (reproduce the exact objects components expect) ---
const mapTherapist = (r) => ({ id: r.id, name: r.name, specialty: r.specialty, color: r.color, initials: r.initials, active: r.active !== false })
// `age` is a derived UI value (currentYear − birth_year), never stored — the DB keeps
// only birth_year (NOT NULL). See migration 18 (the redundant `age` column was dropped).
const mapPatient = (r) => {
  const birthYear = r.birth_year ?? null
  return { id: r.id, name: r.name, phone: r.phone, birthYear, age: ageFromBirthYear(birthYear), gender: r.gender, email: r.email ?? null, notifyOptIn: r.notify_opt_in ?? true }
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
  // Set when the secretary/manager approves a phone/AI request — drives the shared
  // booking-success modal (same confirmation a patient gets on self-booking). Held at
  // store level because approving removes the request, unmounting the row that triggered it.
  const [bookingConfirmation, setBookingConfirmation] = useState(null)
  const [ready, setReady] = useState(false)

  // A brand-new patient creates their own patients row on first self-booking; the
  // appointment/request insert that immediately follows has an RLS check that resolves
  // the caller's patient_id FROM THE DB (app.patient_id()), so it must not race ahead of
  // the patient insert. This holds the in-flight self-registration write; afterPatientWrite
  // chains the dependent insert after it commits. Resolved (no wait) for existing patients.
  const pendingPatientWrite = useRef(Promise.resolve())
  function afterPatientWrite(build) {
    const prior = pendingPatientWrite.current
    pendingPatientWrite.current = Promise.resolve()
    return prior.then(build)
  }

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
      // Board window: every non-completed task + only completed tasks finished within
      // the last MAIN_BOARD_DONE_DAYS. The older completed backlog is fetched lazily by
      // the archive drawer (fetchArchivedTasks) — it never enters this mirror.
      const doneCutoff = subDays(new Date(), MAIN_BOARD_DONE_DAYS).toISOString()
      const [th, tr, tp, pt, ap, rq, tk, st, cl] = await Promise.all([
        supabase.from('therapists').select('*'),
        supabase.from('treatments').select('*').eq('active', true),
        supabase.from('treatment_providers').select('treatment_id,therapist_id'),
        supabase.from('patients').select('*'),
        supabase.from('appointments').select('*'),
        supabase.from('requests').select('*'),
        supabase.from('tasks').select('*').or(`status.neq.הושלם,completed_at.gte.${doneCutoff}`),
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
      setRequests((rq.data ?? []).map((r) => {
        const kind = r.kind ?? 'booking'
        return {
          id: r.id, patientId: r.patient_id, createdAt: new Date(r.created_at),
          updatedAt: new Date(r.updated_at ?? r.created_at),
          description: r.description, preferredTherapistId: r.preferred_therapist_id,
          visitTypeHint: r.visit_type_hint, preferredTime: r.preferred_time,
          source: r.source, status: r.status, rejectionReason: r.rejection_reason ?? null,
          kind, subject: r.subject ?? null, staffNote: r.staff_note ?? null,
          convertedTaskId: r.converted_task_id ?? null,
          // Human inquiries carry no AI payload; only booking requests get classified.
          ai: kind === 'inquiry' ? null : (r.ai ?? aiFor({ description: r.description, preferredTherapistId: r.preferred_therapist_id, visitTypeHint: r.visit_type_hint })),
        }
      }))
      // A patient sees only their own patient row (RLS) — that's their currentPatientId.
      setCurrentPatient(role?.isPatient ? ((pt.data ?? [])[0]?.id ?? null) : null)
      setReady(true)
    })()
    return () => { active = false }
  }, [status, role?.id])

  // --- Lookups (unchanged) ---
  const patientById = useMemo(() => Object.fromEntries(patients.map((p) => [p.id, p])), [patients])
  // therapistById is over ALL therapists (incl. archived) so historical appointments
  // still render name/color. activeTherapists is the list for booking / calendar /
  // provider pickers — archived (active === false) providers are hidden there.
  const therapistById = useMemo(() => Object.fromEntries(therapists.map((t) => [t.id, t])), [therapists])
  const activeTherapists = useMemo(() => therapists.filter((t) => t.active !== false), [therapists])
  const treatmentById = useMemo(() => Object.fromEntries(treatments.map((t) => [t.id, t])), [treatments])
  // Bookable providers for the PATIENT self-booking flow: active, with a specialty
  // AND at least one treatment they provide. A therapist missing either can't be
  // booked end-to-end (no treatment ⇒ dead-end at the treatment step), so they're
  // hidden from the patient picker. Made bookable in Settings by giving them a
  // specialty + assigning a treatment. Clinic-side pickers keep using activeTherapists.
  const bookableTherapists = useMemo(() => {
    const providerIds = new Set(treatments.flatMap((t) => t.therapistIds))
    return activeTherapists.filter((t) => (t.specialty || '').trim() !== '' && providerIds.has(t.id))
  }, [activeTherapists, treatments])

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
  // Route to the first ACTIVE provider of the treatment (skip archived ones).
  const firstProviderFor = (treatmentId) =>
    (treatmentById[treatmentId]?.therapistIds ?? []).find((id) => therapistById[id]?.active !== false) ?? null
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
    // Enforce required fields at the write layer: keep the optimistic edit visible,
    // but don't persist an invalid name/specialty to the DB (the row reverts to the
    // last saved value on reload). Patches without those keys (color/active) pass through.
    if (patch.name !== undefined &&
        validateTherapistName(patch.name, therapists.filter((t) => t.id !== id).map((t) => t.name))) return
    if (patch.specialty !== undefined && validateSpecialty(patch.specialty)) return
    persist(supabase.from('therapists').update(patch).eq('id', id), 'updateTherapist')
  }

  // Create a clinical provider (therapist). This is the ONLY way a bookable therapist
  // is added — the staff roster is office-only. The new provider shows in therapist
  // views immediately; assigning them a treatment (treatment_providers, via Settings)
  // makes them bookable by patients.
  function addTherapist({ name, specialty, color }) {
    const clean = normalizeName(name)
    const cleanSpecialty = (specialty || '').trim()
    if (validateTherapistName(clean, therapists.map((t) => t.name)) || validateSpecialty(cleanSpecialty)) {
      throw new Error('addTherapist: invalid name or specialty')
    }
    const initials = clean.split(' ').slice(0, 2).map((w) => w[0] || '').join('')
    const t = { id: uuid(), name: clean, specialty: cleanSpecialty, color: color || null, initials }
    setTherapists((prev) => [...prev, t])
    persist(supabase.from('therapists').insert({
      id: t.id, clinic_id: clinicId, name: t.name, specialty: t.specialty || null, color: t.color, initials,
    }), 'addTherapist')
    return t
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
  // Defensive backstop under the Settings UI: normalize the name and reject invalid
  // name/role so junk never reaches the optimistic mirror or the DB. The enforcing
  // layer is still the DB (staff_name_len CHECK + role CHECK, RLS) — see validation.js.
  function addStaff({ name, roleId }) {
    const clean = normalizeName(name)
    if (validateStaffName(clean) || !isValidStaffRole(roleId)) {
      throw new Error('addStaff: invalid name or role')
    }
    const member = { id: uuid(), name: clean, roleId }
    setStaff((prev) => [...prev, member])
    persist(supabase.from('staff').insert({ id: member.id, clinic_id: clinicId, name: clean, role: roleId }), 'addStaff')
    return member
  }
  function updateStaff(id, patch) {
    const next = { ...patch }
    if (next.name !== undefined) {
      next.name = normalizeName(next.name)
      if (validateStaffName(next.name)) throw new Error('updateStaff: invalid name')
    }
    if (next.roleId !== undefined && !isValidStaffRole(next.roleId)) {
      throw new Error('updateStaff: invalid role')
    }
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, ...next } : s)))
    const row = {}
    if (next.name !== undefined) row.name = next.name
    if (next.roleId !== undefined) row.role = next.roleId
    persist(supabase.from('staff').update(row).eq('id', id), 'updateStaff')
  }
  function removeStaff(id) {
    setStaff((prev) => prev.filter((s) => s.id !== id))
    persist(supabase.from('staff').delete().eq('id', id), 'removeStaff')
  }

  // --- Patients ---
  function addPatient({ name, phone, birthYear = null, gender = null, email = null, notifyOptIn = true }) {
    // Required fields (mirrors the DB: phone/birth_year/gender are NOT NULL, gender is
    // CHECK-constrained). Backstop under the intake forms — reject invalid input.
    const cleanName = (name || '').trim()
    // Persist the normalized phone (05XXXXXXXX) so every row shares one format.
    const cleanPhone = normalizePhone(phone)
    // email is OPTIONAL (secondary channel); reject only a present-but-malformed value.
    const cleanEmail = normalizeEmail(email)
    if (!cleanName || !phoneValid(cleanPhone) || !birthYearValid(birthYear) || !isValidGender(gender) || !emailValid(cleanEmail)) {
      throw new Error('addPatient: invalid patient fields (name/phone/birthYear/gender/email)')
    }
    // age is derived for the UI only; the DB stores birth_year (the stable fact).
    const age = ageFromBirthYear(birthYear)
    const notify = notifyOptIn !== false
    const patient = { id: uuid(), name: cleanName, phone: cleanPhone, birthYear, age, gender, email: cleanEmail || null, notifyOptIn: notify }
    setPatients((prev) => [...prev, patient])
    // A patient self-registering links the row to their auth user (profile_id = auth.uid())
    // so RLS (patients_insert_self + app.patient_id()) accepts it and resolves their id for
    // the follow-up booking. Staff-created phone-book patients have no login → profile_id null.
    const selfRegister = !!role?.isPatient
    const profileId = selfRegister ? (userId ?? null) : null
    // Resolve the builder exactly once, then reuse the promise (persist + the ordering gate).
    const write = Promise.resolve(
      supabase.from('patients').insert({ id: patient.id, clinic_id: clinicId, name: cleanName, phone: cleanPhone, birth_year: birthYear, gender, email: cleanEmail || null, notify_opt_in: notify, profile_id: profileId }),
    )
    persist(write, 'addPatient')
    if (selfRegister) pendingPatientWrite.current = write.catch(() => {})
    return patient
  }
  function updatePatient(id, patch) {
    // Keep stored contact fields in their canonical shape whatever the caller passed:
    // phone → 05XXXXXXXX; email → trimmed + lowercased (or null when cleared).
    let clean = patch
    if ('phone' in clean) clean = { ...clean, phone: normalizePhone(clean.phone) }
    if ('email' in clean) clean = { ...clean, email: normalizeEmail(clean.email) || null }
    setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...clean } : p)))
    persist(supabase.from('patients').update(clean).eq('id', id), 'updatePatient')
  }

  // --- DEV ONLY: reset the connected patient back to the "new patient" state ---
  // Completing onboarding permanently links the demo login (newpatient@meditrack.test)
  // to a patients row, so the onboarding flow can't be re-tested on refresh. This
  // unlinks the caller's own row (profile_id → null) so app.patient_id() no longer
  // resolves it — RLS-safe (patients_update_self passes because app.patient_id() is a
  // STABLE function evaluated on the statement-start snapshot, when the row is still
  // linked). Its own future appointments are dropped too (patient may delete own). The
  // row itself stays as an unlinked phone-book record (patients have no delete policy).
  // Guarded by import.meta.env.DEV — a no-op in production builds.
  async function devResetOnboarding() {
    if (!import.meta.env.DEV) return
    const id = currentPatientId
    if (!id) return
    await supabase.from('appointments').delete().eq('patient_id', id)
    await supabase.from('patients').update({ profile_id: null }).eq('id', id)
    setAppointments((prev) => prev.filter((a) => a.patientId !== id))
    setPatients((prev) => prev.filter((p) => p.id !== id))
    setCurrentPatient(null)
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
    // Chain after a just-created patient row (new-patient self-book) so this insert's RLS
    // check (patient_id = app.patient_id()) sees the committed, linked patient.
    persist(afterPatientWrite(() => supabase.from('appointments').insert({
      id: appt.id, clinic_id: clinicId, patient_id: patientId, therapist_id: therapistId,
      treatment_id: treatmentId, start: start.toISOString(), duration_min: tr.durationMin,
      visit_type: tr.name, status: 'קבוע', reason: appt.reason, source: 'הזמנה עצמית',
    })), 'bookAppointment')
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
    const now = new Date()
    const req = {
      id, patientId, createdAt: now, updatedAt: now, description,
      preferredTherapistId: input.preferredTherapistId, visitTypeHint: input.visitTypeHint,
      preferredTime: preferredTime || 'גמיש', source: source || 'פורטל', status: 'ממתין',
      rejectionReason: null, ai: aiFor(input),
    }
    setRequests((prev) => [req, ...prev])
    // Same ordering as bookAppointment: a new patient's request insert (req_insert_patient:
    // patient_id = app.patient_id()) must wait for their patient row to commit first.
    persist(afterPatientWrite(() => supabase.from('requests').insert({
      id, clinic_id: clinicId, patient_id: patientId, description,
      preferred_therapist_id: input.preferredTherapistId, visit_type_hint: input.visitTypeHint,
      preferred_time: req.preferredTime, source: req.source, status: 'ממתין', ai: req.ai,
    })), 'submitRequest')
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
      source: req.source,
    }
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: 'אושר', updatedAt: new Date() } : r)))
    setAppointments((prev) => [...prev, appt])
    persist(supabase.from('appointments').insert({
      id: apptId, clinic_id: clinicId, patient_id: req.patientId, therapist_id: therapistId,
      treatment_id: treatmentId, start: start.toISOString(), duration_min: appt.durationMin,
      visit_type: appt.visitType, status: 'קבוע', reason: req.description, source: req.source,
    }), 'approveRequest.appt')
    persist(supabase.from('requests').update({ status: 'אושר', appointment_id: apptId }).eq('id', requestId), 'approveRequest.req')
    // Confirmation channels (secretary's choice in the ScheduleDialog). Phone = the
    // WhatsApp/SMS reminder; email = the same appointment confirmation over email —
    // both go through the send-reminder Edge Function (secrets stay server-side).
    const patient = patientById[req.patientId]
    const therapist = therapistById[therapistId]
    const sentEmail = !!(slot?.notifyEmail && patient?.email)
    if (slot?.notify) {
      supabase.functions.invoke('send-reminder', { body: { appointmentId: apptId } }).catch(() => {})
    }
    if (sentEmail) {
      supabase.functions.invoke('send-reminder', { body: { appointmentId: apptId, channel: 'email' } }).catch(() => {})
    }
    // Surface the same success confirmation a patient sees on self-booking.
    setBookingConfirmation({
      appointment: appt,
      patientName: patient?.name ?? '',
      phone: patient?.phone ?? null,
      email: patient?.email ?? null,
      therapistName: therapist?.name ?? '',
      specialty: therapist?.specialty ?? '',
      notifiedSms: !!slot?.notify,
      notifiedEmail: sentEmail,
    })
    return appt
  }

  function clearBookingConfirmation() {
    setBookingConfirmation(null)
  }

  // --- HUMAN INQUIRY path: "not sure which treatment?" → straight to the secretary ---
  // No AI: the patient picks a subject (an active service, or אדמיניסטרציה / אחר) + an
  // optional free-text detail. Persisted as a request with kind='inquiry' so it lands in
  // the same secretary queue, but with no ai payload and no scheduling — the secretary
  // resolves it via one of two terminal paths: close it directly (updateInquiry → 'סגור')
  // or convert it to a tracked task (convertInquiryToTask).
  function submitInquiry({ patientId, subject, description }) {
    const id = uuid()
    const now = new Date()
    const req = {
      id, patientId, createdAt: now, updatedAt: now,
      description: (description || '').trim(), preferredTherapistId: null, visitTypeHint: null,
      preferredTime: 'גמיש', source: 'פורטל', status: 'ממתין', rejectionReason: null,
      kind: 'inquiry', subject, staffNote: null, ai: null,
    }
    setRequests((prev) => [req, ...prev])
    // Same ordering gate as submitRequest: a just-self-registered patient's insert must
    // wait for their patients row to commit so req_insert_patient (patient_id = app.patient_id()) resolves.
    persist(afterPatientWrite(() => supabase.from('requests').insert({
      id, clinic_id: clinicId, patient_id: patientId, description: req.description,
      preferred_time: req.preferredTime, source: req.source, status: 'ממתין',
      kind: 'inquiry', subject,
    })), 'submitInquiry')
    return req
  }

  // Secretary works an inquiry: set its status (Path A close → 'סגור') and/or save an
  // internal note. Only the given keys are written; updated_at is bumped by the DB trigger.
  function updateInquiry(requestId, patch) {
    setRequests((prev) => prev.map((r) => (
      r.id === requestId ? { ...r, ...patch, updatedAt: new Date() } : r
    )))
    const row = {}
    if (patch.status !== undefined) row.status = patch.status
    if (patch.staffNote !== undefined) row.staff_note = patch.staffNote
    if (Object.keys(row).length) persist(supabase.from('requests').update(row).eq('id', requestId), 'updateInquiry')
  }

  // Save the staff-only internal note on ANY request (booking/phone/AI + inquiry). Backs the
  // auto-saving note field on the secretary board — `note` is already trimmed-or-null.
  function updateRequestNote(requestId, note) {
    setRequests((prev) => prev.map((r) => (
      r.id === requestId ? { ...r, staffNote: note } : r
    )))
    persist(supabase.from('requests').update({ staff_note: note }).eq('id', requestId), 'updateRequestNote')
  }

  // Path B — convert an inquiry into a tracked task. Creates a task (status 'בטיפול',
  // unassigned = the "general / office" default) copying the inquiry's context, then marks
  // the request 'הומר למשימה' so it drops off the active board. Mutually exclusive with the
  // direct-close path (no task is created there).
  function convertInquiryToTask(requestId) {
    const req = requests.find((r) => r.id === requestId)
    if (!req) return
    // Carry BOTH the patient's inquiry text and the secretary's internal note into the
    // task so no context is lost on conversion.
    const noteParts = []
    if (req.description?.trim()) noteParts.push(req.description.trim())
    if (req.staffNote?.trim()) noteParts.push(`הערה פנימית: ${req.staffNote.trim()}`)
    const task = {
      id: uuid(), title: `פנייה מהפורטל — ${req.subject ?? ''}`.trim(),
      patientId: req.patientId, assigneeId: null, createdBy: userId ?? null,
      createdAt: new Date(), due: new Date(), status: 'בטיפול', source: 'ידני',
      note: noteParts.join('\n\n'),
    }
    setTasks((prev) => [task, ...prev])
    persist(supabase.from('tasks').insert({
      id: task.id, clinic_id: clinicId, title: task.title, patient_id: task.patientId,
      assignee_id: null, created_by: task.createdBy, due: task.due.toISOString(),
      status: 'בטיפול', source: 'ידני', note: task.note,
    }), 'convertInquiryToTask.task')
    // Link the request to its task so the patient view can later flip 'הומר למשימה' →
    // 'סגור' ("טופל") when the task completes (reflectConvertedTask).
    setRequests((prev) => prev.map((r) => (
      r.id === requestId ? { ...r, status: 'הומר למשימה', convertedTaskId: task.id, updatedAt: new Date() } : r
    )))
    persist(supabase.from('requests').update({ status: 'הומר למשימה', converted_task_id: task.id }).eq('id', requestId), 'convertInquiryToTask.req')
    return task
  }

  // Staff rejects a request, optionally with a note shown to the patient on their
  // dashboard banner. updated_at is bumped by a DB trigger; mirror it locally so the
  // patient's 7-day banner window is accurate without a reload.
  function rejectRequest(requestId, reason = null) {
    const rejectionReason = (reason || '').trim() || null
    setRequests((prev) => prev.map((r) => (
      r.id === requestId ? { ...r, status: 'נדחה', rejectionReason, updatedAt: new Date() } : r
    )))
    persist(supabase.from('requests').update({ status: 'נדחה', rejection_reason: rejectionReason }).eq('id', requestId), 'rejectRequest')
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

  // Mirror a converted inquiry-task's lifecycle back onto its source request. Patients
  // can't read tasks (RLS), so the request status is their only signal: a completed task
  // flips the request to 'סגור' (patient sees "טופל"); any active task keeps it
  // 'הומר למשימה' (patient sees "בטיפול הצוות"). No-op for tasks with no linked request.
  function reflectConvertedTask(taskId, taskStatus) {
    const linked = requests.find((r) => r.convertedTaskId === taskId)
    if (!linked) return
    const reflect = taskStatus === 'הושלם' ? 'סגור' : 'הומר למשימה'
    if (linked.status === reflect) return
    setRequests((prev) => prev.map((r) => (r.id === linked.id ? { ...r, status: reflect, updatedAt: new Date() } : r)))
    persist(supabase.from('requests').update({ status: reflect }).eq('id', linked.id), 'reflectConvertedTask')
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
    reflectConvertedTask(taskId, newStatus)
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

  // --- Task Archive (on-demand, server-paginated) ---
  // Fetch a single page of COMPLETED tasks straight from the DB (never touches the
  // board mirror). Filters — free-text search, completion date range, assignee — and
  // the newest-first order are all applied server-side so the SQL LIMIT/RANGE paging
  // is authoritative. Returns { tasks, hasMore } for the "Load More" pager.
  // Only real task columns are sortable server-side (paging must stay authoritative);
  // patient / assignee are derived names and aren't sort keys.
  const ARCHIVE_SORT_COLUMNS = { completed_at: 'completed_at', title: 'title' }
  async function fetchArchivedTasks({ page = 0, pageSize = ARCHIVE_PAGE_SIZE, search = '', from = null, to = null, assigneeId = null, sortKey = 'completed_at', sortAsc = false } = {}) {
    const offset = page * pageSize
    let q = supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('status', 'הושלם')
    if (assigneeId) q = q.eq('assignee_id', assigneeId)
    if (from) q = q.gte('completed_at', from.toISOString())
    if (to) q = q.lte('completed_at', to.toISOString())
    const term = search.trim()
    if (term) {
      // Match the task title, its source "tag" (אוטומציה/ידני), or — resolving names
      // from the in-memory roster — the patient it belongs to. patient_id.in.(…) keeps
      // the name search server-side so paging stays correct.
      const like = `*${term}*`
      const patientIds = patients.filter((p) => p.name?.includes(term)).map((p) => p.id)
      const ors = [`title.ilike.${like}`, `source.ilike.${like}`, `note.ilike.${like}`]
      if (patientIds.length) ors.push(`patient_id.in.(${patientIds.join(',')})`)
      q = q.or(ors.join(','))
    }
    const orderBy = ARCHIVE_SORT_COLUMNS[sortKey] ?? 'completed_at'
    const { data, count, error } = await q
      .order(orderBy, { ascending: sortAsc, nullsFirst: false })
      .range(offset, offset + pageSize - 1)
    if (error) {
      console.error('[fetchArchivedTasks]', error.message)
      return { tasks: [], hasMore: false }
    }
    const mapped = (data ?? []).map(mapTask)
    const total = count ?? offset + mapped.length
    return { tasks: mapped, hasMore: offset + mapped.length < total }
  }

  // Restore an archived (completed) task back into active work. Optimistically flips it
  // to "בטיפול" and clears completed_at; merges it into the board mirror (it may have
  // aged out of the 15-day window, so add it if missing). Returns the restored task so
  // the archive drawer can drop it from its list immediately.
  function restoreTask(task) {
    const restored = { ...task, status: 'בטיפול', completedAt: undefined }
    setTasks((prev) => (prev.some((t) => t.id === task.id)
      ? prev.map((t) => (t.id === task.id ? restored : t))
      : [restored, ...prev]))
    persist(supabase.from('tasks').update({ status: 'בטיפול', completed_at: null }).eq('id', task.id), 'restoreTask')
    // Restoring a converted task to active work flips the patient view back to "בטיפול הצוות".
    reflectConvertedTask(task.id, 'בטיפול')
    return restored
  }

  const value = {
    therapists, activeTherapists, bookableTherapists, treatments, patients, currentPatientId, requests, appointments, tasks, staff, settings,
    setCurrentPatient, visitDurations, patientById, therapistById, treatmentById, treatmentsForTherapist, aiFor, classifyAsync,
    assignees, assigneeById,
    updateSettings, addTherapist, updateTherapist, addTreatment, updateTreatment, removeTreatment,
    addStaff, updateStaff, removeStaff, addPatient, updatePatient, devResetOnboarding,
    bookAppointment, cancelAppointment, submitRequest, submitInquiry, updateInquiry, updateRequestNote, convertInquiryToTask, approveRequest, rejectRequest,
    bookingConfirmation, clearBookingConfirmation,
    setAppointmentStatus, bulkMarkNoShow, saveClinicalNote, setTaskStatus, addTask, updateTask, deleteTask,
    fetchArchivedTasks, restoreTask,
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
