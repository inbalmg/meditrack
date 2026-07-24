// AI classification for the "not sure?" intake path of a TREATMENT clinic.
//
// The patient who doesn't know which treatment they need writes a free-text
// description; this maps it to a suggested treatment + provider, and raises an
// urgency safety-net flag (a "routine" that actually sounds urgent → route to the
// clinic instead of silent self-booking).
//
// In production this call would hit an LLM (e.g. Claude) with the same
// input/output shape, so the UI is identical and the network call drops in later.
//
// Output: { urgency, urgencyScore, treatmentId, visitType, routedTo, tags,
//           rationale, urgentFlag }

import { treatments } from '../data/seed.js'

const byId = Object.fromEntries(treatments.map((t) => [t.id, t]))
const firstProvider = (treatmentId) => byId[treatmentId]?.therapistIds?.[0] ?? 't1'

// Symptoms that should NOT be self-booked as routine — flag for the clinic.
const URGENT_TERMS = [
  'דחוף', 'חירום', 'כאב חזק', 'כאבים חזקים', 'חום גבוה', 'קוצר נשימה',
  'דימום', 'התעלפות', 'לא נרגע', 'מחמיר', 'פתאומי', 'נשימה', 'חבלה', 'נפילה',
]
const SOON_TERMS = [
  'כאב', 'כואב', 'דלקת', 'נפיחות', 'מגביל', 'לא עובר', 'כמה ימים',
  'מחמיר', 'מקרין', 'תפוס', 'מודאג', 'מודאגת',
]

// Map free-text → a suggested treatment (id). First match wins; falls back below.
const TREATMENT_RULES = [
  { id: 'tr1', match: ['גב', 'ברך', 'כתף', 'פציעה', 'ספורט', 'אימון', 'שיקום', 'הרמת', 'נקע', 'שריר'] }, // פיזיו — הערכה ראשונית
  { id: 'tr2', match: ['המשך', 'סדרה', 'טיפול נוסף', 'פיזיותרפיה', 'תרגילים'] }, // פיזיו — טיפול המשך
  { id: 'tr3', match: ['דיקור', 'מחט', 'כאב ראש', 'מיגרנה', 'עישון', 'שינה'] }, // דיקור סיני
  { id: 'tr4', match: ['רפואה סינית', 'צמחים', 'עיכול', 'אנרגיה', 'הורמונלי'] }, // ייעוץ רפואה סינית
  { id: 'tr5', match: ['עיסוי', 'מתח', 'צוואר', 'גב עליון', 'נוקשות', 'עומס'] }, // עיסוי רפואי
  { id: 'tr6', match: ['רפלקסולוגיה', 'הרפיה', 'לחץ', 'רגליים', 'כללי', 'רוגע'] }, // רפלקסולוגיה
]

function countHits(text, terms) {
  const t = text || ''
  return terms.reduce((n, term) => (t.includes(term) ? n + 1 : n), 0)
}

export function classifyRequest({ description = '', preferredTherapistId = null, visitTypeHint = null } = {}) {
  const text = description.trim()

  // --- Urgency (safety-net flag) ---
  const urgentHits = countHits(text, URGENT_TERMS)
  const soonHits = countHits(text, SOON_TERMS)
  let urgency = 'רגיל'
  let urgencyScore = 0.2
  if (urgentHits > 0) {
    urgency = 'דחוף'
    urgencyScore = Math.min(0.98, 0.75 + urgentHits * 0.08)
  } else if (soonHits > 0) {
    urgency = 'בהקדם'
    urgencyScore = Math.min(0.7, 0.4 + soonHits * 0.1)
  }
  const urgentFlag = urgency === 'דחוף'

  // --- Suggested treatment: patient's own choice wins; AI only fills a gap ---
  let treatmentId = null
  if (visitTypeHint) {
    const t = treatments.find((tr) => tr.name === visitTypeHint)
    if (t) treatmentId = t.id
  }
  if (!treatmentId) {
    for (const rule of TREATMENT_RULES) {
      if (countHits(text, rule.match) > 0) {
        treatmentId = rule.id
        break
      }
    }
  }
  if (!treatmentId) treatmentId = 'tr1' // sensible default: physio assessment
  const treatment = byId[treatmentId]

  // --- Routing: patient's preferred provider wins; else the treatment's provider ---
  let routedTo = preferredTherapistId || null
  if (!routedTo) routedTo = firstProvider(treatmentId)

  // --- Tags (surfaced on cards) ---
  const tags = []
  if (urgency === 'דחוף') tags.push('דחוף — לבדיקת המרפאה')
  if (soonHits > 0 && urgency !== 'דחוף') tags.push('רגיש לזמן')
  if (countHits(text, ['גב', 'ברך', 'פציעה', 'ספורט'])) tags.push('אורתופדי')
  if (countHits(text, ['מתח', 'הרפיה', 'לחץ'])) tags.push('הרפיה')
  if (tags.length === 0) tags.push('שגרתי')

  const rationale = urgentFlag
    ? 'זוהו ביטויים שעשויים להעיד על מצב שדורש בדיקה — הופנה למרפאה לתיאום, במקום הזמנה עצמית.'
    : `לפי התיאור, הטיפול המתאים ביותר הוא "${treatment.name}". ניתן לאשר ולהציע מועד.`

  return {
    urgency,
    urgencyScore,
    urgentFlag,
    treatmentId,
    visitType: treatment.name, // denormalized (backward compat)
    routedTo,
    tags,
    rationale,
  }
}

export const URGENCY_STYLES = {
  'דחוף': { badge: 'bg-red-100 text-red-700 ring-red-200', dot: 'bg-red-500' },
  'בהקדם': { badge: 'bg-amber-100 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  'רגיל': { badge: 'bg-teal-100 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
}
