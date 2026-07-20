import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CalendarHeart, FilePlus2, LogOut, Plus } from 'lucide-react'
import { useSession } from '../session.jsx'
import { useData } from '../data/store.jsx'
import { clsx } from '../components/clsx.js'

// Mobile-first portal. On desktop it's centered in a phone-like frame so the
// demo reads clearly as "the patient's phone".
export default function PatientLayout() {
  const { logout } = useSession()
  const navigate = useNavigate()
  const { patientById, currentPatientId } = useData()
  const me = patientById[currentPatientId]

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const nav = [
    { to: '/patient', end: true, icon: CalendarHeart, label: 'התורים שלי' },
    { to: '/patient/new', icon: FilePlus2, label: 'בקשת תור' },
  ]

  return (
    <div className="min-h-full flex justify-center bg-gradient-to-b from-ink-900 to-ink-950 sm:py-8">
      <div className="w-full sm:max-w-[420px] bg-canvas sm:rounded-[2rem] sm:shadow-2xl sm:ring-1 sm:ring-black/20 overflow-hidden flex flex-col min-h-screen sm:min-h-0 sm:h-[860px]">
        {/* Header */}
        <header className="bg-ink-900 text-white px-5 pt-6 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center h-8 w-8 rounded-lg bg-teal-500"><Plus size={18} strokeWidth={3} /></span>
              <span className="font-bold">MediTrack</span>
            </div>
            <button onClick={handleLogout} className="text-teal-200/70 hover:text-white p-1.5"><LogOut size={18} /></button>
          </div>
          <p className="mt-4 text-teal-200/70 text-sm">שלום,</p>
          <p className="text-xl font-bold">{me.name}</p>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto scroll-thin p-4 pb-24">
          <Outlet />
        </main>

        {/* Bottom tab bar */}
        <nav className="sticky bottom-0 bg-white border-t border-slate-200 grid grid-cols-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center gap-1 py-3 text-xs font-medium transition',
                  isActive ? 'text-teal-600' : 'text-slate-400',
                )
              }
            >
              <item.icon size={22} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
