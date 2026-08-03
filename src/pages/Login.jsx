import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Stethoscope, UserCog, ShieldCheck, UserRound, UserPlus } from 'lucide-react'
import { useSession, ROLES } from '../session.jsx'
import { useData } from '../data/store.jsx'
import Welcome, { WelcomeCard, StaffIcon, PatientIcon } from './Welcome.jsx'

const CLINIC_ROLES = [
  { id: 'secretary', icon: UserCog },
  { id: 'manager', icon: ShieldCheck },
  { id: 'therapist', icon: Stethoscope },
]

// אייקון lucide בתוך עיגול הכרטיס — באותו גוון טורקיז של אייקוני העיצוב.
function CircleIcon({ icon: Icon }) {
  return <Icon style={{ width: '3em', height: '3em', color: '#3d8b82' }} strokeWidth={1.7} />
}

export default function Login() {
  const { login } = useSession()
  const { setCurrentPatient } = useData()
  const navigate = useNavigate()
  const [entrance, setEntrance] = useState(null) // null | 'clinic' | 'patient'

  function enter(roleId) {
    login(roleId)
    navigate(ROLES[roleId].home, { replace: true })
  }

  // Enter the patient portal either as a registered patient (phone on file) or
  // as a first-time patient (no record yet → phone entered during booking).
  function enterPatient(patientId) {
    setCurrentPatient(patientId)
    enter('patient')
  }

  if (entrance === 'clinic') {
    return (
      <Welcome heading="כניסת צוות" onBack={() => setEntrance(null)}>
        {CLINIC_ROLES.map(({ id, icon }) => (
          <WelcomeCard
            key={id}
            icon={<CircleIcon icon={icon} />}
            title={ROLES[id].label}
            subtitle={ROLES[id].desc}
            onClick={() => enter(id)}
          />
        ))}
      </Welcome>
    )
  }

  if (entrance === 'patient') {
    return (
      <Welcome heading="פורטל מטופלים" onBack={() => setEntrance(null)}>
        {/* מטופל/ת רשומ/ה — הטלפון כבר במערכת (ממולא-מראש בהזמנה) */}
        <WelcomeCard
          icon={<CircleIcon icon={UserRound} />}
          title="רותם ברק"
          subtitle="מטופל/ת רשומ/ה · 050-1234567"
          onClick={() => enterPatient('p1')}
        />
        {/* מטופל/ת חדש/ה — אין רשומה; שם+טלפון נקלטים בבקשת התור */}
        <WelcomeCard
          icon={<CircleIcon icon={UserPlus} />}
          title="מטופל/ת חדש/ה"
          subtitle="פנייה ראשונה · הזנת שם וטלפון בבקשת התור"
          onClick={() => enterPatient(null)}
        />
      </Welcome>
    )
  }

  // מסך נחיתה ראשי — שתי כניסות
  return (
    <Welcome heading="ברוכים הבאים">
      <WelcomeCard
        icon={<StaffIcon />}
        title="כניסת צוות הקליניקה"
        subtitle="מזכירות · מטפלים · הנהלה"
        onClick={() => setEntrance('clinic')}
      />
      <WelcomeCard
        icon={<PatientIcon />}
        title="פורטל מטופלים"
        subtitle="בקשת תור · עדכונים · מעקב"
        onClick={() => setEntrance('patient')}
      />
    </Welcome>
  )
}
