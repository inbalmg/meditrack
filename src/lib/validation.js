// Shared form validators reused across the patient portal and the clinic dialogs,
// so the same rules apply wherever contact details are collected.

// Israeli mobile number, forgiving of separators (accepts "050-1234567").
export function phoneValid(phone) {
  const digits = (phone || '').replace(/\D/g, '')
  return digits.length >= 9 && digits.startsWith('0')
}

// A plausible 4-digit year of birth: between 1900 and the current year (nobody is
// born in the future). Patients enter this once; age is derived from it.
export function birthYearValid(year) {
  const y = Number(String(year ?? '').trim())
  return Number.isInteger(y) && y >= 1900 && y <= new Date().getFullYear()
}
