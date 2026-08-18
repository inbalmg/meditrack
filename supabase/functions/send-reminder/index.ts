// MediTrack — Edge Function: send-reminder / send-confirmation
// Composes the Hebrew appointment confirmation and delivers it over the requested
// channel: WhatsApp/SMS via Twilio (default) or email via Resend. Each provider runs in
// STUB mode when its secrets aren't configured, returning the composed text instead of
// sending (messaging is the cost center) — same behavior as the original console stub.
//
//   input : { appointmentId, channel? }  OR  { patientName, phone, email, visitType, therapistName, start, channel? }
//           channel: 'sms' (default) | 'email'
//   output: { sent, mode, channel, to, message, subject? }
//
// The provider credentials (TWILIO_* / RESEND_API_KEY) live only in Edge Function secrets
// — never in the browser. Restricted to staff (secretary/manager) via the JWT role claim.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

// Role claim from a bearer JWT (used to recognise the service_role automation call).
function jwtRole(authHeader: string): string | null {
  try {
    const token = (authHeader || '').replace(/^Bearer\s+/i, '')
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role ?? null
  } catch { return null }
}

function formatWhen(startIso: string) {
  const d = new Date(startIso)
  const day = HE_DAYS[d.getDay()]
  const date = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  return `יום ${day} ${date} בשעה ${time}`
}

function composeMessage({ patientName, visitType, therapistName, start }) {
  const when = formatWhen(start)
  return `שלום ${patientName}, תורך ל${visitType} עם ${therapistName ?? ''} נקבע ל${when}. ` +
    `מרפאת MediTrack — לשינוי/ביטול השיבו להודעה זו.`
}

// Email confirmation — the same appointment details, formatted for email (subject + body).
function composeEmail({ patientName, visitType, therapistName, start }) {
  const when = formatWhen(start)
  const subject = `אישור תור — ${visitType} · מרפאת MediTrack`
  const body = `שלום ${patientName},\n\n` +
    `תורך ל${visitType} עם ${therapistName ?? ''} נקבע ל${when}.\n\n` +
    `לשינוי או ביטול ניתן להשיב למייל זה או ליצור קשר עם המרפאה.\n\n` +
    `בברכה,\nמרפאת MediTrack`
  return { subject, body }
}

// Sends via Twilio if configured; else returns null (stub mode).
async function sendViaTwilio(to: string, body: string): Promise<boolean | null> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_FROM') // e.g. 'whatsapp:+1...' or an SMS sender
  if (!sid || !token || !from) return null // stub mode

  const form = new URLSearchParams({ To: to, From: from, Body: body })
  const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${sid}:${token}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  if (!resp.ok) throw new Error(`twilio ${resp.status}: ${await resp.text()}`)
  return true
}

// Sends via Resend if configured; else returns null (stub mode) — same pattern as SMS,
// keeping the email provider key (RESEND_API_KEY) server-side only.
async function sendViaEmail(to: string, subject: string, body: string): Promise<boolean | null> {
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('FROM_EMAIL') // e.g. 'MediTrack <clinic@meditrack.co.il>'
  if (!key || !from) return null // stub mode

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text: body }),
  })
  if (!resp.ok) throw new Error(`resend ${resp.status}: ${await resp.text()}`)
  return true
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: JSON_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    // Authorize staff (from a user JWT) OR the automation (a service_role JWT — the
    // pg_cron reminder sweep has no user session).
    const { data: { user } } = await supabase.auth.getUser()
    const role = user?.app_metadata?.role
    const isService = !user && jwtRole(authHeader) === 'service_role'
    if (role !== 'secretary' && role !== 'manager' && !isService) {
      return new Response(JSON.stringify({ error: 'forbidden — staff only' }), { status: 403, headers: JSON_HEADERS })
    }

    const input = await req.json()
    let fields = input
    // Channel: 'sms' (default — WhatsApp/SMS via Twilio) or 'email' (via Resend).
    const channel = input.channel === 'email' ? 'email' : 'sms'

    // If only an appointmentId is given, hydrate the fields from the DB (RLS: staff read clinic-wide).
    if (input.appointmentId) {
      const { data: appt, error } = await supabase
        .from('appointments')
        .select('start, visit_type, patients(name, phone, email), therapists(name)')
        .eq('id', input.appointmentId)
        .single()
      if (error || !appt) {
        return new Response(JSON.stringify({ error: 'appointment not found' }), { status: 404, headers: JSON_HEADERS })
      }
      fields = {
        patientName: appt.patients?.name,
        phone: appt.patients?.phone,
        email: appt.patients?.email,
        visitType: appt.visit_type,
        therapistName: appt.therapists?.name,
        start: appt.start,
      }
    }

    if (channel === 'email') {
      if (!fields.email) {
        return new Response(JSON.stringify({ error: 'no email on record' }), { status: 400, headers: JSON_HEADERS })
      }
      const { subject, body } = composeEmail(fields)
      const sent = await sendViaEmail(fields.email, subject, body)
      return new Response(JSON.stringify({
        sent: sent === true,
        mode: sent === null ? 'stub' : 'resend',
        channel: 'email',
        to: fields.email,
        subject,
        message: body,
      }), { headers: JSON_HEADERS })
    }

    if (!fields.phone) {
      return new Response(JSON.stringify({ error: 'no phone on record' }), { status: 400, headers: JSON_HEADERS })
    }

    const message = composeMessage(fields)
    const sent = await sendViaTwilio(fields.phone, message)

    return new Response(JSON.stringify({
      sent: sent === true,
      mode: sent === null ? 'stub' : 'twilio',
      channel: 'sms',
      to: fields.phone,
      message,
    }), { headers: JSON_HEADERS })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 400, headers: JSON_HEADERS })
  }
})
