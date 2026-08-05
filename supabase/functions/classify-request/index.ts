// MediTrack — Edge Function: classify-request
// Server-side port of src/lib/aiClassifier.js. Same input/output schema, so the
// UI is unchanged when the client swaps its local classifyRequest() for a fetch
// to this function (roadmap step 6).
//
//   input : { description, preferredTherapistId?, visitTypeHint? }
//   output: { urgency, urgencyScore, urgentFlag, treatmentId, visitType,
//             routedTo, tags, rationale }
//
// Treatment/provider IDs are resolved from the DB (real UUIDs) using the CALLER's
// JWT, so RLS scopes them to the caller's clinic. If ANTHROPIC_API_KEY is set the
// classification is done by Claude; otherwise a deterministic keyword classifier
// (faithful to aiClassifier.js) runs. The Claude path is the only thing that needs
// the secret — it never reaches the browser.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }

// --- Classification vocab (mirrors aiClassifier.js) ---
const URGENT_TERMS = [
  'דחוף', 'חירום', 'כאב חזק', 'כאבים חזקים', 'חום גבוה', 'קוצר נשימה',
  'דימום', 'התעלפות', 'לא נרגע', 'מחמיר', 'פתאומי', 'נשימה', 'חבלה', 'נפילה',
]
const SOON_TERMS = [
  'כאב', 'כואב', 'דלקת', 'נפיחות', 'מגביל', 'לא עובר', 'כמה ימים',
  'מחמיר', 'מקרין', 'תפוס', 'מודאג', 'מודאגת',
]
// Keyword → treatment NAME (rules resolve to a treatment row fetched from the DB).
const TREATMENT_RULES = [
  { name: 'פיזיותרפיה — הערכה ראשונית', match: ['גב', 'ברך', 'כתף', 'פציעה', 'ספורט', 'אימון', 'שיקום', 'הרמת', 'נקע', 'שריר'] },
  { name: 'פיזיותרפיה — טיפול המשך', match: ['המשך', 'סדרה', 'טיפול נוסף', 'פיזיותרפיה', 'תרגילים'] },
  { name: 'דיקור סיני', match: ['דיקור', 'מחט', 'כאב ראש', 'מיגרנה', 'עישון', 'שינה'] },
  { name: 'ייעוץ רפואה סינית', match: ['רפואה סינית', 'צמחים', 'עיכול', 'אנרגיה', 'הורמונלי'] },
  { name: 'עיסוי רפואי', match: ['עיסוי', 'מתח', 'צוואר', 'גב עליון', 'נוקשות', 'עומס'] },
  { name: 'רפלקסולוגיה', match: ['רפלקסולוגיה', 'הרפיה', 'לחץ', 'רגליים', 'כללי', 'רוגע'] },
]
const DEFAULT_TREATMENT = 'פיזיותרפיה — הערכה ראשונית'

const countHits = (text: string, terms: string[]) =>
  terms.reduce((n, t) => (text.includes(t) ? n + 1 : n), 0)

type Treatment = { id: string; name: string }

function buildResult(
  { description = '', preferredTherapistId = null, visitTypeHint = null }:
    { description?: string; preferredTherapistId?: string | null; visitTypeHint?: string | null },
  treatments: Treatment[],
  firstProviderFor: (treatmentId: string) => string | null,
  chosenName: string,
  urgency: string,
) {
  const byName = Object.fromEntries(treatments.map((t) => [t.name, t]))
  const treatment = byName[chosenName] ?? byName[DEFAULT_TREATMENT] ?? treatments[0]

  const text = (description || '').trim()
  const soonHits = countHits(text, SOON_TERMS)
  const urgentFlag = urgency === 'דחוף'
  let urgencyScore = 0.2
  if (urgency === 'דחוף') urgencyScore = Math.min(0.98, 0.75 + countHits(text, URGENT_TERMS) * 0.08)
  else if (urgency === 'בהקדם') urgencyScore = Math.min(0.7, 0.4 + soonHits * 0.1)

  const routedTo = preferredTherapistId || firstProviderFor(treatment.id)

  const tags: string[] = []
  if (urgency === 'דחוף') tags.push('דחוף — לבדיקת המרפאה')
  if (soonHits > 0 && urgency !== 'דחוף') tags.push('רגיש לזמן')
  if (countHits(text, ['גב', 'ברך', 'פציעה', 'ספורט'])) tags.push('אורתופדי')
  if (countHits(text, ['מתח', 'הרפיה', 'לחץ'])) tags.push('הרפיה')
  if (tags.length === 0) tags.push('שגרתי')

  const rationale = urgentFlag
    ? 'זוהו ביטויים שעשויים להעיד על מצב שדורש בדיקה — הופנה למרפאה לתיאום, במקום הזמנה עצמית.'
    : `לפי התיאור, הטיפול המתאים ביותר הוא "${treatment.name}". ניתן לאשר ולהציע מועד.`

  return {
    urgency, urgencyScore, urgentFlag,
    treatmentId: treatment.id, visitType: treatment.name,
    routedTo, tags, rationale,
  }
}

// Deterministic keyword classifier (no external call).
function classifyDeterministic(input, treatments, firstProviderFor) {
  const text = (input.description || '').trim()
  const urgency = countHits(text, URGENT_TERMS) > 0 ? 'דחוף'
    : countHits(text, SOON_TERMS) > 0 ? 'בהקדם' : 'רגיל'

  let chosen = null
  if (input.visitTypeHint && treatments.some((t) => t.name === input.visitTypeHint)) {
    chosen = input.visitTypeHint // patient's own choice wins
  }
  if (!chosen) {
    for (const rule of TREATMENT_RULES) {
      if (countHits(text, rule.match) > 0 && treatments.some((t) => t.name === rule.name)) {
        chosen = rule.name
        break
      }
    }
  }
  return buildResult(input, treatments, firstProviderFor, chosen ?? DEFAULT_TREATMENT, urgency)
}

// Claude classifier — same schema; runs only when ANTHROPIC_API_KEY is set.
async function classifyWithClaude(input, treatments, firstProviderFor, apiKey: string) {
  const { default: Anthropic } = await import('npm:@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey })
  const names = treatments.map((t) => t.name)
  const msg = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 1024,
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            treatmentName: { type: 'string', enum: names },
            urgency: { type: 'string', enum: ['רגיל', 'בהקדם', 'דחוף'] },
            rationale: { type: 'string' },
          },
          required: ['treatmentName', 'urgency', 'rationale'],
          additionalProperties: false,
        },
      },
    },
    system:
      'אתה ממיין פניות למרפאת טיפולים (פיזיותרפיה ורפואה משלימה). בחר את הטיפול המתאים ' +
      'ביותר מתוך הרשימה, וקבע דחיפות: "דחוף" אם התיאור מרמז על מצב שמצריך בדיקה אנושית, ' +
      '"בהקדם" אם רגיש לזמן, אחרת "רגיל". בחירת המטופל (visitTypeHint) גוברת אם ניתנה.',
    messages: [{
      role: 'user',
      content: JSON.stringify({
        description: input.description,
        visitTypeHint: input.visitTypeHint,
        availableTreatments: names,
      }),
    }],
  })
  const block = msg.content.find((b) => b.type === 'text')
  const parsed = JSON.parse(block?.text ?? '{}')
  const urgency = ['רגיל', 'בהקדם', 'דחוף'].includes(parsed.urgency) ? parsed.urgency : 'רגיל'
  const chosen = names.includes(parsed.treatmentName) ? parsed.treatmentName : DEFAULT_TREATMENT
  const result = buildResult(input, treatments, firstProviderFor, chosen, urgency)
  if (parsed.rationale && !result.urgentFlag) result.rationale = parsed.rationale
  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: JSON_HEADERS })
  }

  try {
    const input = await req.json()

    // Read treatments + providers with the caller's JWT → RLS scopes to their clinic.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const [{ data: treatments, error: tErr }, { data: providers }] = await Promise.all([
      supabase.from('treatments').select('id,name').eq('active', true),
      supabase.from('treatment_providers').select('treatment_id,therapist_id'),
    ])
    if (tErr) throw tErr
    if (!treatments || treatments.length === 0) {
      return new Response(JSON.stringify({ error: 'no treatments visible for caller' }), { status: 403, headers: JSON_HEADERS })
    }

    const provByTreatment = new Map<string, string>()
    for (const p of providers ?? []) {
      if (!provByTreatment.has(p.treatment_id)) provByTreatment.set(p.treatment_id, p.therapist_id)
    }
    const firstProviderFor = (id: string) => provByTreatment.get(id) ?? null

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    let result
    if (apiKey) {
      try {
        result = await classifyWithClaude(input, treatments, firstProviderFor, apiKey)
      } catch (_e) {
        result = classifyDeterministic(input, treatments, firstProviderFor) // graceful fallback
      }
    } else {
      result = classifyDeterministic(input, treatments, firstProviderFor)
    }

    return new Response(JSON.stringify(result), { headers: JSON_HEADERS })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 400, headers: JSON_HEADERS })
  }
})
