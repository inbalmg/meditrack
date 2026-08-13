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

// specialty: optional; when present, up to 50 chars (on the trimmed value).
export function validateSpecialty(s) {
  if ((s || '').trim().length > SPECIALTY_MAX) return `ההתמחות ארוכה מדי (עד ${SPECIALTY_MAX} תווים)`
  return null
}

// --- Patients ---
// Selectable/valid gender values (intake forms + validation). Kept to male/female
// for now. NOTE: some legacy rows may still hold 'other' — genderLabel still renders
// those for display; they just can't be chosen for a new/edited patient.
export const GENDERS = ['male', 'female']
export function isValidGender(g) {
  return GENDERS.includes(g)
}
