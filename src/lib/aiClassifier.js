// AI classification of an incoming appointment request.
//
// In production this call would hit an LLM (e.g. Claude) with the patient's
// free-text description and return structured JSON. For this demo it runs a
// deterministic, rule-based classifier with the SAME input/output shape, so the
// UI is identical and the network call can be dropped in later without changes.
//
// Output: { urgency, urgencyScore, visitType, routedTo, tags, rationale }

const URGENT_TERMS = [
  'דחוף', 'חירום', 'כאב חזק', 'כאבים חזקים', 'חום גבוה', 'קוצר נשימה',
  'דימום', 'התעלפות', 'לא נרגע', 'מחמיר', 'פתאומי', 'נשימה', 'אלרגי',
]
const SOON_TERMS = [
  'כאב', 'כואב', 'זיהום', 'דלקת', 'פריחה', 'שיעול', 'חום', 'סחרחורת',
  'החמרה', 'לא עובר', 'כמה ימים', 'מודאג', 'מודאגת',
]

const VISIT_RULES = [
  { type: 'בדיקה דחופה', match: ['כאב חזק', 'חום גבוה', 'דחוף', 'דימום', 'קוצר נשימה'] },
  { type: 'מעקב / פולו-אפ', match: ['מעקב', 'תוצאות', 'בדיקות דם', 'המשך טיפול', 'פולו', 'חוזר'] },
  { type: 'חידוש מרשם', match: ['מרשם', 'תרופה', 'תרופות', 'חידוש'] },
  { type: 'ייעוץ', match: ['ייעוץ', 'שאלה', 'להתייעץ', 'חוות דעת'] },
  { type: 'בדיקה תקופתית', match: ['בדיקה שנתית', 'תקופתית', 'שגרתית', 'ביקורת', 'רוטינה'] },
]

// Keywords that hint which specialty/therapist should handle it.
const ROUTING_RULES = [
  { therapistId: 't2', match: ['ילד', 'תינוק', 'ילדה', 'בן שנתיים', 'פעוט'] }, // ד"ר לוי — ילדים
  { therapistId: 't3', match: ['עור', 'פריחה', 'שומה', 'אקנה', 'גרד'] }, // ד"ר כהן — עור
  { therapistId: 't1', match: [] }, // ד"ר אבני — רפואת משפחה (ברירת מחדל)
]

function countHits(text, terms) {
  const t = text || ''
  return terms.reduce((n, term) => (t.includes(term) ? n + 1 : n), 0)
}

export function classifyRequest({ description = '', preferredTherapistId = null, visitTypeHint = null } = {}) {
  const text = description.trim()

  // --- Urgency ---
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

  // --- Visit type: the patient's own choice wins; AI only fills a gap ---
  let visitType = visitTypeHint || null
  if (!visitType) {
    for (const rule of VISIT_RULES) {
      if (countHits(text, rule.match) > 0) {
        visitType = rule.type
        break
      }
    }
  }
  if (!visitType) visitType = urgency === 'דחוף' ? 'בדיקה דחופה' : 'ייעוץ'

  // --- Routing: patient's preferred therapist wins; AI only fills a gap ---
  let routedTo = preferredTherapistId || null
  if (!routedTo) {
    for (const rule of ROUTING_RULES) {
      if (rule.match.length && countHits(text, rule.match) > 0) {
        routedTo = rule.therapistId
        break
      }
    }
  }
  if (!routedTo) routedTo = 't1'

  // --- Tags (surfaced on cards) ---
  const tags = []
  if (urgency === 'דחוף') tags.push('דחוף')
  if (soonHits > 0 && urgency !== 'דחוף') tags.push('רגיש לזמן')
  if (countHits(text, ['ילד', 'תינוק', 'פעוט'])) tags.push('ילדים')
  if (countHits(text, ['מרשם', 'תרופה'])) tags.push('מרשם')
  if (tags.length === 0) tags.push('שגרתי')

  const rationale =
    urgency === 'דחוף'
      ? 'זוהו ביטויים המעידים על מצב דחוף — מומלץ תיאום מהיר.'
      : urgency === 'בהקדם'
        ? 'זוהו סימני אי-נוחות — עדיף לתאם בימים הקרובים.'
        : 'לא זוהו סימני דחיפות — ניתן לתאם לפי זמינות רגילה.'

  return { urgency, urgencyScore, visitType, routedTo, tags, rationale }
}

export const URGENCY_STYLES = {
  'דחוף': { badge: 'bg-red-100 text-red-700 ring-red-200', dot: 'bg-red-500' },
  'בהקדם': { badge: 'bg-amber-100 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  'רגיל': { badge: 'bg-teal-100 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
}
