#!/usr/bin/env node
// MediTrack — admin cleanup for TEST patient orphans (dev only).  Run: npm run reset:patient
//
// The in-app dev reset button (PatientLayout → devResetOnboarding) unlinks a test
// patient's row (profile_id → null) so the onboarding flow can be re-tested. Patients
// have no self-delete RLS policy, so those unlinked rows accumulate. This script —
// running with the SERVICE ROLE key (RLS bypass) — hard-deletes them. Deleting a
// patient cascades its appointments + requests and nulls its tasks (FKs in migration 02).
//
// SAFETY — never touches real data:
//   • Only rows with profile_id IS NULL are candidates (never a linked / live patient).
//   • Of those, ONLY rows matching a DESIGNATED TEST IDENTIFIER (the allowlist below or
//     a CLI arg) are deleted. A staff-created phone-book patient that matches nothing is
//     left untouched — there is NO unrestricted "delete every orphan".
//   • Refuses to run with an empty allowlist, and aborts if more than MAX_DELETE match.
//   • --dry-run prints the matches without deleting anything.
//
// The service role key is read STRICTLY from .env.local (gitignored). Never commit it.
//
// Usage:
//   npm run reset:patient                       # delete orphans matching the allowlist
//   npm run reset:patient -- --dry-run          # preview only
//   npm run reset:patient -- test@meditrack.test 0500000001 "ישראלה כהן"   # + ad-hoc targets

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ---- Designated TEST identifiers ----------------------------------------------
// A row is deleted only if it is an orphan (profile_id IS NULL) AND matches at least
// one of these. Keep them unmistakably test-only so live records are never hit.
const TEST_EMAILS = [
  // 'rotem.test@example.com',
]
const TEST_EMAIL_DOMAINS = [
  'meditrack.test', // the demo/test auth domain — never used by real patients
]
const TEST_PHONES = [
  // '0500000001',
]
const TEST_NAMES = [
  // 'ישראלה כהן',
]
const MAX_DELETE = 25 // runaway safeguard

// ---- env (.env.local is the ONLY source for the service key) ------------------
function parseEnv(file) {
  let text
  try { text = readFileSync(file, 'utf8') } catch { return {} }
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

const local = parseEnv(resolve(ROOT, '.env.local'))
const pub = parseEnv(resolve(ROOT, '.env'))

const SERVICE_KEY = local.SUPABASE_SERVICE_ROLE_KEY
const URL = local.SUPABASE_URL || local.VITE_SUPABASE_URL || pub.VITE_SUPABASE_URL

if (!SERVICE_KEY) {
  console.error('✗ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  console.error('  Add it (Supabase → Project Settings → API → service_role secret):')
  console.error('    SUPABASE_SERVICE_ROLE_KEY=eyJ...')
  console.error('  .env.local is gitignored — never commit the service key.')
  process.exit(1)
}
if (!URL) {
  console.error('✗ Missing Supabase URL (VITE_SUPABASE_URL in .env, or SUPABASE_URL in .env.local)')
  process.exit(1)
}

// ---- CLI: ad-hoc identifiers + flags ------------------------------------------
const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const cliIds = argv.filter((a) => !a.startsWith('--'))

const normPhone = (p) => {
  let d = String(p || '').replace(/\D/g, '')
  if (d.startsWith('00972')) d = '0' + d.slice(5)
  else if (d.startsWith('972')) d = '0' + d.slice(3)
  return d
}
const lc = (s) => String(s || '').trim().toLowerCase()
const isEmailArg = (a) => a.includes('@')
const isPhoneArg = (a) => /^05\d{8}$/.test(normPhone(a))

const emails = new Set([...TEST_EMAILS, ...cliIds.filter(isEmailArg)].map(lc))
const domains = new Set(TEST_EMAIL_DOMAINS.map(lc))
const phones = new Set([...TEST_PHONES, ...cliIds.filter(isPhoneArg)].map(normPhone))
const names = new Set([...TEST_NAMES, ...cliIds.filter((a) => !isEmailArg(a) && !isPhoneArg(a))].map((s) => String(s).trim()))

if (!(emails.size || domains.size || phones.size || names.size)) {
  console.error('✗ No designated test identifiers — refusing to run (would be unsafe).')
  console.error('  Add TEST_EMAILS / TEST_EMAIL_DOMAINS / TEST_PHONES / TEST_NAMES in the script,')
  console.error('  or pass one as an arg, e.g.:  npm run reset:patient -- test@meditrack.test')
  process.exit(1)
}

function isTarget(row) {
  const email = lc(row.email)
  const domain = email.split('@')[1] || ''
  return (
    (email && emails.has(email)) ||
    (domain && domains.has(domain)) ||
    (row.phone && phones.has(normPhone(row.phone))) ||
    (row.name && names.has(String(row.name).trim()))
  )
}

// ---- run ----------------------------------------------------------------------
const db = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } })

// Candidates are ONLY unlinked rows — a live/linked patient can never be selected.
const { data: orphans, error } = await db
  .from('patients')
  .select('id, name, phone, email, profile_id')
  .is('profile_id', null)
if (error) { console.error('✗ query failed:', error.message); process.exit(1) }

const targets = (orphans ?? []).filter(isTarget)

console.log(`Orphan rows (profile_id IS NULL): ${orphans?.length ?? 0}`)
console.log(`Matching designated test identifiers: ${targets.length}`)
for (const t of targets) console.log(`   • ${t.name} · ${t.phone} · ${t.email ?? '—'}  [${t.id}]`)

if (targets.length === 0) { console.log('Nothing to delete.'); process.exit(0) }
if (targets.length > MAX_DELETE) {
  console.error(`✗ ${targets.length} matches exceeds MAX_DELETE=${MAX_DELETE} — aborting as a safeguard.`)
  console.error('  Narrow the allowlist, or raise MAX_DELETE if this is expected.')
  process.exit(1)
}
if (dryRun) { console.log('\n--dry-run: no rows deleted.'); process.exit(0) }

// Delete the matched patients by id. FK cascade removes their appointments + requests
// and nulls their tasks (migration 02), so no manual child cleanup is needed.
const ids = targets.map((t) => t.id)
const { error: delErr } = await db.from('patients').delete().in('id', ids)
if (delErr) { console.error('✗ delete failed:', delErr.message); process.exit(1) }

console.log(`\n✓ Deleted ${ids.length} test orphan patient row(s).`)
