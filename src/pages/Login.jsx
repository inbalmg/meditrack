import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  Stethoscope,
  Smartphone,
  Building2,
  UserCog,
  UserRound,
  UserPlus,
  ShieldCheck,
  ChevronLeft,
  Plus,
} from 'lucide-react'
import { useSession, ROLES } from '../session.jsx'
import { useData } from '../data/store.jsx'
import { Button } from '../components/ui.jsx'
import { clsx } from '../components/clsx.js'

const CLINIC_ROLES = [
  { id: 'secretary', icon: UserCog },
  { id: 'manager', icon: ShieldCheck },
  { id: 'therapist', icon: Stethoscope },
]

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

  return (
    <div className="min-h-full grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-ink-900 text-white overflow-hidden">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-teal-500">
            <Plus size={24} strokeWidth={3} />
          </span>
          <div>
            <p className="text-xl font-bold leading-tight">MediTrack</p>
            <p className="text-teal-300 text-sm">Clinic</p>
          </div>
        </div>
        <div className="relative">
          <h1 className="text-3xl font-bold leading-snug">
            תיאום תורים, בקשות ומשימות
            <br />
            במערכת דיגיטלית אחת
          </h1>
          <p className="mt-4 text-teal-100/80 max-w-md leading-relaxed">
            מחליפה תיאום טלפוני ופתקים ידניים בתהליך מקצה לקצה — עם סיווג חכם (AI)
            ואוטומציות לתזכורות ומעקב.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {['B2B SaaS', 'סיווג AI', 'אוטומציות', '3 פרסונות'].map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-3 py-1 text-sm text-teal-50">
                {t}
              </span>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-teal-200/50">פרויקט גמר · קורס מיישם AI · יולי 2026</p>
      </div>

      {/* Entrance panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-fade">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="grid place-items-center h-9 w-9 rounded-lg bg-teal-600 text-white">
              <Plus size={20} strokeWidth={3} />
            </span>
            <span className="font-bold text-lg text-slate-800">MediTrack Clinic</span>
          </div>

          {!entrance && (
            <>
              <h2 className="text-2xl font-bold text-slate-800">ברוכים הבאים</h2>
              <p className="text-slate-500 mt-1 mb-8">בחרו כיצד להיכנס למערכת</p>
              <div className="space-y-3">
                <EntranceCard
                  icon={Building2}
                  title="כניסת צוות הקליניקה"
                  subtitle="מזכירות · מטפלים · הנהלה · דסקטופ"
                  onClick={() => setEntrance('clinic')}
                />
                <EntranceCard
                  icon={Smartphone}
                  title="פורטל מטופלים"
                  subtitle="בקשת תור ומעקב · מובייל"
                  onClick={() => setEntrance('patient')}
                />
              </div>
              <p className="mt-8 text-center text-xs text-slate-400">
                שתי כניסות נפרדות · הפרדה מלאה ברמת הכניסה
              </p>
            </>
          )}

          {entrance === 'clinic' && (
            <>
              <button
                onClick={() => setEntrance(null)}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
              >
                <ChevronLeft size={16} /> חזרה
              </button>
              <h2 className="text-2xl font-bold text-slate-800">כניסת צוות</h2>
              <p className="text-slate-500 mt-1 mb-6">בחרו תפקיד להדגמה</p>
              <div className="space-y-3">
                {CLINIC_ROLES.map(({ id, icon }) => (
                  <RoleCard key={id} role={ROLES[id]} icon={icon} onClick={() => enter(id)} />
                ))}
              </div>
            </>
          )}

          {entrance === 'patient' && (
            <>
              <button
                onClick={() => setEntrance(null)}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
              >
                <ChevronLeft size={16} /> חזרה
              </button>
              <h2 className="text-2xl font-bold text-slate-800">פורטל מטופלים</h2>
              <p className="text-slate-500 mt-1 mb-6">בחרו כיצד להיכנס להדגמה</p>
              <div className="space-y-3">
                {/* Registered patient — phone already on file (prefilled at booking) */}
                <button
                  onClick={() => enterPatient('p1')}
                  className="group w-full flex items-center gap-4 rounded-2xl ring-1 ring-slate-200 bg-white p-4 text-right hover:ring-teal-400 hover:shadow-md transition"
                >
                  <span className="grid place-items-center h-12 w-12 rounded-full bg-teal-100 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition">
                    <UserRound size={24} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">רותם ברק</p>
                    <p className="text-sm text-slate-400">מטופל/ת רשומ/ה · 050-1234567</p>
                  </div>
                  <ChevronLeft className="text-slate-300 group-hover:text-teal-500" size={20} />
                </button>
                {/* First-time patient — no record yet; phone entered during booking */}
                <button
                  onClick={() => enterPatient(null)}
                  className="group w-full flex items-center gap-4 rounded-2xl ring-1 ring-slate-200 bg-white p-4 text-right hover:ring-teal-400 hover:shadow-md transition"
                >
                  <span className="grid place-items-center h-12 w-12 rounded-full bg-slate-100 text-slate-500 group-hover:bg-teal-600 group-hover:text-white transition">
                    <UserPlus size={24} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">מטופל/ת חדש/ה</p>
                    <p className="text-sm text-slate-400">פנייה ראשונה · הזנת שם וטלפון בבקשת התור</p>
                  </div>
                  <ChevronLeft className="text-slate-300 group-hover:text-teal-500" size={20} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EntranceCard({ icon: Icon, title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-4 rounded-2xl ring-1 ring-slate-200 bg-white p-4 text-right hover:ring-teal-400 hover:shadow-md transition"
    >
      <span className="grid place-items-center h-12 w-12 rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition">
        <Icon size={24} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800">{title}</p>
        <p className="text-sm text-slate-400 truncate">{subtitle}</p>
      </div>
      <ChevronLeft className="text-slate-300 group-hover:text-teal-500" size={20} />
    </button>
  )
}

function RoleCard({ role, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group w-full flex items-center gap-4 rounded-2xl ring-1 ring-slate-200 bg-white p-4 text-right hover:ring-teal-400 hover:shadow-md transition',
      )}
    >
      <span className="grid place-items-center h-11 w-11 rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white transition">
        <Icon size={22} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800">{role.label}</p>
        <p className="text-sm text-slate-400 truncate">{role.desc}</p>
      </div>
      <ChevronLeft className="text-slate-300 group-hover:text-teal-500" size={20} />
    </button>
  )
}
