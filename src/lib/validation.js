// Shared form validators reused across the patient portal and the clinic dialogs,
// so the same rules apply wherever contact details are collected.
// Frontend guards are UX only; the enforcing layer is the DB (CHECK/NOT NULL) + RLS.
// Keep these rules in sync with the matching DB constraints (see supabase/migrations).

// Canonical phone shape stored everywhere: digits only, no separators, leading 0
// (e.g. "0501234567"). normalizePhone() strips dashes/spaces/parens and folds an
// international prefix (+972 / 972 / 00972) down to the local 0, so however the user
// types it we persist one unified format. Callers should normalize before saving.
export function normalizePhone(phone) {
  let digits = (phone || '').replace(/\D/g, '')
  if (digits.startsWith('00972')) digits = '0' + digits.slice(5)
  else if (digits.startsWith('972')) digits = '0' + digits.slice(3)
  return digits
}

// Valid Israeli MOBILE number — the reminder channel (WhatsApp/SMS), so it must be a
// cellphone: 05X + 7 digits = "05XXXXXXXX" (10 digits). Validation runs on the
// NORMALIZED value, so "054-123 4567", "0541234567" and "+972541234567" all pass,
// and an invalid format is rejected whether or not the user used separators.
const IL_MOBILE_RE = /^05\d{8}$/
export function phoneValid(phone) {
  return IL_MOBILE_RE.test(normalizePhone(phone))
}

// A plausible 4-digit year of birth: between 1900 and the current year (nobody is
// born in the future). Patients enter this once; age is derived from it.
export function birthYearValid(year) {
  const y = Number(String(year ?? '').trim())
  return Number.isInteger(y) && y >= 1900 && y <= new Date().getFullYear()
}

// --- Names (staff, and reusable for other name fields) ---
export const NAME_MIN = 2
export const NAME_MAX = 80

// Trim + collapse internal whitespace so " דנה   כהן " → "דנה כהן".
export function normalizeName(s) {
  return (s || '').trim().replace(/\s+/g, ' ')
}

// Returns a Hebrew error string, or null when valid. Mirrors DB constraint
// staff_name_len: char_length(btrim(name)) between NAME_MIN and NAME_MAX.
export function validateStaffName(s) {
  const n = normalizeName(s)
  if (n.length < NAME_MIN) return `השם חייב להכיל לפחות ${NAME_MIN} תווים`
  if (n.length > NAME_MAX) return `השם ארוך מדי (עד ${NAME_MAX} תווים)`
  return null
}

// The 3 valid staff roles — mirrors the DB CHECK on staff.role.
export const STAFF_ROLES = ['secretary', 'manager', 'therapist']
export function isValidStaffRole(r) {
  return STAFF_ROLES.includes(r)
}

// --- Therapists (providers) ---
export const THERAPIST_NAME_MIN = 2
export const THERAPIST_NAME_MAX = 50
export const SPECIALTY_MIN = 2
export const SPECIALTY_MAX = 50

// name: required, 2–50 (on the trimmed/collapsed value), and unique among existing
// therapists (case/space-insensitive). `existing` = current therapist names.
export function validateTherapistName(s, existing = []) {
  const n = normalizeName(s)
  if (n.length < THERAPIST_NAME_MIN) return `השם חייב להכיל לפחות ${THERAPIST_NAME_MIN} תווים`
  if (n.length > THERAPIST_NAME_MAX) return `השם ארוך מדי (עד ${THERAPIST_NAME_MAX} תווים)`
  const key = n.toLowerCase()
  if (existing.some((e) => normalizeName(e).toLowerCase() === key)) return 'כבר קיים מטפל בשם זה'
  return null
}

// specialty: REQUIRED — 2–50 chars (on the trimmed value). A therapist's specialty
// is shown in the patient booking flow and is part of what makes them bookable, so
// it can't be left blank (see bookableTherapists in store.jsx).
export function validateSpecialty(s) {
  const n = (s || '').trim()
  if (n.length < SPECIALTY_MIN) return `יש להזין התמחות (לפחות ${SPECIALTY_MIN} תווים)`
  if (n.length > SPECIALTY_MAX) return `ההתמחות ארוכה מדי (עד ${SPECIALTY_MAX} תווים)`
  return null
}

// --- Patients ---
// Email — OPTIONAL secondary notification channel (phone stays the mandatory one).
// normalizeEmail folds to a single stored shape (trim + lowercase); persist the
// normalized value. emailValid returns true for BLANK (the field is optional) or a
// well-formed address — mirrors the DB CHECK patients_email_check (migration 20):
// null-or-format. So an empty email never blocks a form, but a malformed one does.
export function normalizeEmail(email) {
  return (email || '').trim().toLowerCase()
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export function emailValid(email) {
  const e = normalizeEmail(email)
  return e === '' || EMAIL_RE.test(e)
}

// --- Settings: bounded whole-number fields (minutes / hours) ---
// Shared validator for the numeric Settings inputs: a whole number, digits only,
// no leading zeros ("07"), within [min, max]. Returns { value, error } — value is
// the parsed integer when valid (else null), error is a Hebrew message (else '').
// Used by each Settings time field before persisting, so out-of-range or malformed
// keystrokes are flagged and never committed.
export function validateBoundedInt(raw, min, max) {
  const s = String(raw ?? '').trim()
  if (s === '') return { value: null, error: 'יש להזין מספר' }
  if (!/^\d+$/.test(s)) return { value: null, error: 'יש להזין מספר שלם (ספרות בלבד, ללא סימנים או נקודה)' }
  if (s.length > 1 && s[0] === '0') return { value: null, error: 'אין להתחיל באפס מוביל' }
  const n = Number(s)
  if (n < min || n > max) return { value: null, error: `יש להזין ערך בין ${min} ל-${max}` }
  return { value: n, error: '' }
}

// --- Settings: overdue-task grace window (hours) ---
// Thin wrapper over validateBoundedInt with the overdue range baked in.
export const OVERDUE_GRACE_MIN = 0
export const OVERDUE_GRACE_MAX = 72
export function validateOverdueGraceHours(raw) {
  return validateBoundedInt(raw, OVERDUE_GRACE_MIN, OVERDUE_GRACE_MAX)
}

// Selectable/valid gender values (intake forms + validation). Kept to male/female
// for now. NOTE: some legacy rows may still hold 'other' — genderLabel still renders
// those for display; they just can't be chosen for a new/edited patient.
export const GENDERS = ['male', 'female']
export function isValidGender(g) {
  return GENDERS.includes(g)
}
