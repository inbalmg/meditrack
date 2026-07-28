import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CalendarHeart, FilePlus2, LogOut, Plus } from 'lucide-react'
import { useSession } from '../session.jsx'
import { useData } from '../data/store.jsx'
import { clsx } from '../components/clsx.js'

// Responsive patient portal.
//   • Mobile (<md): full-screen — dark header on top, bottom tab bar.
//   • Desktop (md+): a proper desktop layout — top navigation bar (brand +
//     horizontal nav + account/logout) with the content centered in a
//     comfortable column. No phone-frame mockup.
export default function PatientLayout() {
  const { logout } = useSession()
  const navigate = useNavigate()
  const { patientById, currentPatientId } = useData()
  const me = patientById[currentPatientId]
  const displayName = me?.name ?? 'מטופל/ת חדש/ה'

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const nav = [
    { to: '/patient', end: true, icon: CalendarHeart, label: 'התורים שלי' },
    { to: '/patient/new', icon: FilePlus2, label: 'בקשת תור' },
  ]

  return (
    <div className="min-h-full flex flex-col bg-canvas">
      {/* Desktop top bar */}
      <header className="hidden md:block sticky top-0 z-20 bg-ink-900 text-white">
        <div className="h-16 px-6 flex items-center gap-6 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-teal-500"><Plus size={18} strokeWidth={3} /></span>
            <span className="font-bold">MediTrack</span>
            <span className="text-teal-300 text-xs">Clinic</span>
          </div>
          <nav className="flex items-center gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
                    isActive ? 'bg-teal-500 text-white' : 'text-teal-100/80 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-left leading-tight">
              <p className="text-[11px] text-teal-200/70">שלום,</p>
              <p className="text-sm font-semibold">{displayName}</p>
            </div>
            <button
              onClick={handleLogout}
              title="יציאה"
              className="text-teal-200/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile header */}
      <header className="md:hidden bg-ink-900 text-white px-5 pt-6 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-teal-500"><Plus size={18} strokeWidth={3} /></span>
            <span className="font-bold">MediTrack</span>
          </div>
          <button onClick={handleLogout} className="text-teal-200/70 hover:text-white p-1.5"><LogOut size={18} /></button>
        </div>
        <p className="mt-4 text-teal-200/70 text-sm">שלום,</p>
        <p className="text-xl font-bold">{displayName}</p>
      </header>

      {/* Content — centered, comfortable column on desktop */}
      <main className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-8 pb-24 md:pb-10 overflow-y-auto scroll-thin">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden sticky bottom-0 bg-white border-t border-slate-200 grid grid-cols-2">
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
  )
}
