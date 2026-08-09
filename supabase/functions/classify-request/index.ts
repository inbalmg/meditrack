// MediTrack — Edge Function: classify-request
// Server-side port of src/lib/aiClassifier.js. Same input/output schema, so the
// UI is unchanged when the client swaps its local classifyRequest() for a fetch
// to this function (roadmap step 6).
//
//   input : { description, preferredTherapistId?, visitTypeHint? }
//   output: { urgency, urgencyScore, urgentFlag, matched, lowConfidence, confidence,
//             treatmentId, visitType, routedTo, tags, rationale }
//
// Treatment/provider IDs are resolved from the DB (real UUIDs) using the CALLER's
// JWT, so RLS scopes them to the caller's clinic. If GEMINI_API_KEY is set the
// classification is done by Gemini (Flash); otherwise a deterministic keyword
// classifier (faithful to aiClassifier.js) runs. The Gemini path is the only thing
// that needs the secret — it never reaches the browser.

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

const LOW_CONF_RATIONALE =
  'לא הצלחנו לזהות טיפול מתאים מהתיאור. אפשר להוסיף פרטים ולנסות שוב, או לשלוח פנייה למרפאה ונחזור אליך.'

function buildResult(
  { description = '', preferredTherapistId = null, visitTypeHint = null }:
    { description?: string; preferredTherapistId?: string | null; visitTypeHint?: string | null },
  treatments: Treatment[],
  firstProviderFor: (treatmentId: string) => string | null,
  chosenName: string,
  urgency: string,
  opts: { matched?: boolean; confidence?: number; tags?: string[] } = {},
) {
  const byName = Object.fromEntries(treatments.map((t) => [t.name, t]))
  const treatment = byName[chosenName] ?? byName[DEFAULT_TREATMENT] ?? treatments[0]

  const text = (description || '').trim()
  const soonHits = countHits(text, SOON_TERMS)
  const urgentFlag = urgency === 'דחוף'

  // `matched` = the treatment came from a real signal (patient hint / keyword / the
  // model), not the pure default fallback. Non-urgent + unmatched = low confidence:
  // the UI asks for more detail instead of presenting a guessed default. Mirrors
  // aiClassifier.js so the local and server classifiers agree.
  const matched = opts.matched ?? true
  const lowConfidence = !urgentFlag && !matched

  let urgencyScore = 0.2
  if (urgency === 'דחוף') urgencyScore = Math.min(0.98, 0.75 + countHits(text, URGENT_TERMS) * 0.08)
  else if (urgency === 'בהקדם') urgencyScore = Math.min(0.7, 0.4 + soonHits * 0.1)
  const confidence = opts.confidence ?? (matched ? 0.8 : 0.35)

  const routedTo = preferredTherapistId || firstProviderFor(treatment.id)

  // Prefer model-supplied tags; else derive from keywords (deterministic parity).
  const tags: string[] = (opts.tags ?? []).filter(Boolean)
  if (tags.length === 0) {
    if (urgency === 'דחוף') tags.push('דחוף — לבדיקת המרפאה')
    if (soonHits > 0 && urgency !== 'דחוף') tags.push('רגיש לזמן')
    if (countHits(text, ['גב', 'ברך', 'פציעה', 'ספורט'])) tags.push('אורתופדי')
    if (countHits(text, ['מתח', 'הרפיה', 'לחץ'])) tags.push('הרפיה')
    if (tags.length === 0) tags.push('שגרתי')
  }

  const rationale = urgentFlag
    ? 'זוהו ביטויים שעשויים להעיד על מצב שדורש בדיקה — הופנה למרפאה לתיאום, במקום הזמנה עצמית.'
    : lowConfidence
      ? LOW_CONF_RATIONALE
      : `לפי התיאור, הטיפול המתאים ביותר הוא "${treatment.name}". ניתן לאשר ולהציע מועד.`

  return {
    urgency, urgencyScore, urgentFlag, matched, lowConfidence, confidence,
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
  return buildResult(input, treatments, firstProviderFor, chosen ?? DEFAULT_TREATMENT, urgency, { matched: chosen != null })
}

// --- Gemini classifier ---
// Same input/output schema; runs only when GEMINI_API_KEY is set. Calls the Gemini
// Flash model via the REST API with structured JSON output (responseSchema), so the
// parsed object maps 1:1 onto buildResult — identical shape to the deterministic path.
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite'

const CLASSIFY_SYSTEM =
  'אתה ממיין פניות למרפאת טיפולים (פיזיותרפיה ורפואה משלימה). בחר את הטיפול המתאים ' +
  'ביותר מתוך הרשימה, וקבע דחיפות: "דחוף" אם התיאור מרמז על מצב שמצריך בדיקה אנושית, ' +
  '"בהקדם" אם רגיש לזמן, אחרת "רגיל". בחירת המטופל (visitTypeHint) גוברת אם ניתנה. ' +
  'החזר confidence בין 0 ל-1 לרמת הביטחון בהתאמת הטיפול, וקבע needsMoreInfo=true אם התיאור ' +
  'כללי או קצר מדי מכדי לזהות טיפול מתאים בביטחון. הוסף tags קצרים בעברית שיסייעו לצוות ' +
  '(למשל "אורתופדי", "רגיש לזמן"); החזר מערך ריק אם אין.'

async function classifyWithGemini(input, treatments, firstProviderFor, apiKey: string) {
  const names = treatments.map((t) => t.name)

  const generationConfig: Record<string, unknown> = {
    temperature: 0,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        treatmentName: { type: 'STRING', enum: names },
        urgency: { type: 'STRING', enum: ['רגיל', 'בהקדם', 'דחוף'] },
        confidence: { type: 'NUMBER' },
        needsMoreInfo: { type: 'BOOLEAN' },
        tags: { type: 'ARRAY', items: { type: 'STRING' } },
        rationale: { type: 'STRING' },
      },
      required: ['treatmentName', 'urgency', 'confidence', 'needsMoreInfo', 'tags', 'rationale'],
      propertyOrdering: ['treatmentName', 'urgency', 'confidence', 'needsMoreInfo', 'tags', 'rationale'],
    },
  }
  // Gemini models "think" by default and thinking spends the output budget; keep it
  // minimal for this small structured task so the budget goes to the JSON. Gemini 2.5
  // uses thinkingBudget (0 disables); Gemini 3.x uses thinkingLevel.
  if (GEMINI_MODEL.includes('2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 }
  else if (GEMINI_MODEL.startsWith('gemini-3')) generationConfig.thinkingConfig = { thinkingLevel: 'low' }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CLASSIFY_SYSTEM }] },
        contents: [{
          role: 'user',
          parts: [{
            text: JSON.stringify({
              description: input.description,
              visitTypeHint: input.visitTypeHint,
              availableTreatments: names,
            }),
          }],
        }],
        generationConfig,
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  // With responseMimeType=application/json the model's JSON arrives as text part(s).
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '').join('')
  const parsed = JSON.parse(text || '{}')

  const urgency = ['רגיל', 'בהקדם', 'דחוף'].includes(parsed.urgency) ? parsed.urgency : 'רגיל'
  const known = names.includes(parsed.treatmentName)
  const chosen = known ? parsed.treatmentName : DEFAULT_TREATMENT
  // The model owns treatment/urgency/confidence/tags; buildResult still fills the
  // deterministic parts (routing, score bounds) and derives lowConfidence.
  const matched = known && parsed.needsMoreInfo !== true
  const confidence = typeof parsed.confidence === 'number'
    ? Math.max(0, Math.min(1, parsed.confidence)) : undefined
  const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((t: unknown) => typeof t === 'string') : []
  const result = buildResult(input, treatments, firstProviderFor, chosen, urgency, { matched, confidence, tags })
  // Keep the model's wording for a normal recommendation; urgent + low-confidence
  // use the standard safety-net / "add detail" copy from buildResult.
  if (parsed.rationale && !result.urgentFlag && !result.lowConfidence) result.rationale = parsed.rationale
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

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    let result
    let engine = 'deterministic'
    if (apiKey) {
      try {
        result = await classifyWithGemini(input, treatments, firstProviderFor, apiKey)
        engine = GEMINI_MODEL
      } catch (e) {
        // Don't swallow silently — a failing Gemini path must be observable in logs,
        // otherwise it looks identical to "no key" and degrades quality unnoticed.
        console.error('[classify-request] Gemini path failed, using deterministic fallback:', e?.message ?? e)
        result = classifyDeterministic(input, treatments, firstProviderFor)
      }
    } else {
      console.warn('[classify-request] GEMINI_API_KEY not set — using deterministic keyword classifier')
      result = classifyDeterministic(input, treatments, firstProviderFor)
    }

    // Minimal success log: engine + non-sensitive classification result only
    // (no patient data, request text, or secrets).
    console.log('[classify-request] classified via', engine, '->', { visitType: result.visitType, urgency: result.urgency })

    return new Response(JSON.stringify(result), { headers: JSON_HEADERS })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 400, headers: JSON_HEADERS })
  }
})
