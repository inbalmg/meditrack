// עוטף דק מעל Supabase Auth. ריכוז כל פעולות ההזדהות במקום אחד, כדי ש-session.jsx
// ו-Login.jsx יחליפו את הכניסה הידנית ב-Auth אמיתי (שלב 6, החלפת ה-store).
//
// מודל ההזדהות (ראו CLAUDE.md / הבלופרינט):
//   • צוות (מזכירה/מטפל/מנהל) = אימייל+סיסמה (או Magic Link).
//   • מטופל = OTP לטלפון (הטלפון כבר ערוץ התזכורות).
// התפקיד וה-clinic_id מגיעים מ-app_metadata של ה-JWT (נקבע בשרת, לא ניתן לשינוי
// מהלקוח) — ה-RLS אוכף לפיהם. אין להסיק תפקיד מבחירת המשתמש.

import { supabase } from './supabase.js'

// --- כניסת צוות: אימייל + סיסמה ---
export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// --- כניסת מטופל: שליחת קוד OTP לטלפון ---
export async function sendPhoneOtp(phone) {
  const { data, error } = await supabase.auth.signInWithOtp({ phone })
  if (error) throw error
  return data
}

// --- כניסת מטופל: אימות הקוד שהתקבל ---
export async function verifyPhoneOtp(phone, token) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
  if (error) throw error
  return data
}

// --- Magic Link (אופציונלי לצוות) ---
export async function sendMagicLink(email) {
  const { data, error } = await supabase.auth.signInWithOtp({ email })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// הסשן הנוכחי (או null). נקרא בעליית האפליקציה כדי לשחזר כניסה קיימת.
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}

// מאזין לשינויי הזדהות (כניסה/יציאה/רענון טוקן). מחזיר פונקציית ביטול-מנוי.
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

// --- קריאת ה-claims שה-RLS מסתמך עליהם, מתוך app_metadata של המשתמש המחובר ---
// אלה נקבעים בשרת ומגיעים חתומים ב-JWT; הלקוח לא יכול לשנותם.
export function claimsFromSession(session) {
  const meta = session?.user?.app_metadata ?? {}
  return {
    userId: session?.user?.id ?? null,
    role: meta.role ?? null,        // 'secretary' | 'manager' | 'therapist' | 'patient'
    clinicId: meta.clinic_id ?? null,
    fullName: session?.user?.user_metadata?.full_name ?? null,
  }
}
