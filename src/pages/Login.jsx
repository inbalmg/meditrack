import { useState } from 'react'
import { ShieldCheck, UserCog, Stethoscope, UserRound } from 'lucide-react'
import { signInWithPassword } from '../lib/auth.js'
import Welcome, { WelcomeCard, StaffIcon, PatientIcon } from './Welcome.jsx'

// Fixed demo/test accounts (see supabase/seed_auth_users.sql). Sign-in is real
// Supabase Auth — on success the session updates and App redirects to role.home.
const DEMO_PASSWORD = 'Meditrack1!'
const STAFF_ACCOUNTS = [
  { email: 'manager@meditrack.test', title: 'מנהל/ת קליניקה', subtitle: 'גישה מלאה + דוחות ואנליטיקה', icon: ShieldCheck },
  { email: 'secretary@meditrack.test', title: 'מזכירות', subtitle: 'ניהול צינור הבקשות, יומן ומשימות', icon: UserCog },
  { email: 'therapist@meditrack.test', title: 'רופא / מטפל', subtitle: 'צפייה ביומן ובמשימות שלי', icon: Stethoscope },
]

function CircleIcon({ icon: Icon }) {
  return <Icon style={{ width: '3em', height: '3em', color: '#3d8b82' }} strokeWidth={1.7} />
}

export default function Login() {
  const [entrance, setEntrance] = useState(null) // null | 'clinic' | 'patient'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function enter(email) {
    setBusy(true); setError(null)
    try {
      await signInWithPassword(email, DEMO_PASSWORD)
      // Session update → App redirects; DataProvider shows its loading screen.
    } catch (e) {
      setError('ההתחברות נכשלה. נסו שוב.')
      setBusy(false)
    }
  }

  const hint = (
    <p style={{ margin: 0, fontSize: '1.05em', color: 'rgba(200,218,224,0.6)', textAlign: 'right' }}>
      {busy ? 'מתחבר…' : 'חשבונות הדגמה · סיסמה: Meditrack1!'}
    </p>
  )
  const errorBanner = error && (
    <p style={{ margin: 0, fontSize: '1.05em', color: '#fca5a5', textAlign: 'right' }}>{error}</p>
  )

  if (entrance === 'clinic') {
    return (
      <Welcome heading="כניסת צוות" onBack={() => setEntrance(null)}>
        {STAFF_ACCOUNTS.map((a) => (
          <WelcomeCard key={a.email} icon={<CircleIcon icon={a.icon} />} title={a.title} subtitle={a.subtitle} onClick={() => enter(a.email)} />
        ))}
        {hint}{errorBanner}
      </Welcome>
    )
  }

  if (entrance === 'patient') {
    return (
      <Welcome heading="פורטל מטופלים" onBack={() => setEntrance(null)}>
        <WelcomeCard
          icon={<CircleIcon icon={UserRound} />}
          title="רותם ברק"
          subtitle="מטופל/ת רשומ/ה · 050-1234567"
          onClick={() => enter('patient@meditrack.test')}
        />
        {hint}{errorBanner}
      </Welcome>
    )
  }

  return (
    <Welcome heading="ברוכים הבאים">
      <WelcomeCard icon={<StaffIcon />} title="כניסת צוות הקליניקה" subtitle="מזכירות · מטפלים · הנהלה" onClick={() => setEntrance('clinic')} />
      <WelcomeCard icon={<PatientIcon />} title="פורטל מטופלים" subtitle="בקשת תור · עדכונים · מעקב" onClick={() => setEntrance('patient')} />
      {errorBanner}
    </Welcome>
  )
}
