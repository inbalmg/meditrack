import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { CalendarClock, CalendarDays, ListChecks, LogOut, Stethoscope, Eye } from 'lucide-react'
import { useSession } from '../session.jsx'
import { useData } from '../data/store.jsx'
import { Avatar, Badge } from '../components/ui.jsx'
import { clsx } from '../components/clsx.js'

export default function DoctorLayout() {
  const { role, logout } = useSession()
  const navigate = useNavigate()
  const { therapistById } = useData()
  const me = therapistById[role.therapistId]

  const nav = [
    { to: '/doctor', end: true, icon: CalendarClock, label: 'היום שלי' },
    { to: '/doctor/calendar', icon: CalendarDays, label: 'היומן שלי' },
    { to: '/doctor/tasks', icon: ListChecks, label: 'לוח משימות' },
  ]

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-full flex bg-canvas">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-ink-900 text-slate-300 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-white/5">
          <span className="grid place-items-center h-9 w-9 rounded-lg bg-teal-500 text-white">
            <Stethoscope size={19} />
          </span>
          <div>
            <p className="font-bold text-white leading-tight">MediTrack</p>
            <p className="text-[11px] text-teal-400">תצוגת רופא</p>
          </div>
        </div>

        {/* Plain caption — a read-only role indicator, not an interactive control. */}
        <div className="px-6 mt-4 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
          <Eye size={12} /> מצב צפייה בלבד
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isActive ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <item.icon size={19} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar initials={me.initials} color={me.color} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{me.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{me.specialty}</p>
            </div>
            <button onClick={handleLogout} title="יציאה" className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-canvas/80 backdrop-blur border-b border-slate-200/70">
          <div className="h-16 px-4 sm:px-6 flex items-center gap-3 max-w-[1200px] mx-auto">
            <div className="md:hidden flex items-center gap-2">
              <span className="grid place-items-center h-8 w-8 rounded-lg bg-teal-600 text-white"><Stethoscope size={17} /></span>
              <span className="font-bold text-slate-800">{me.name}</span>
            </div>
            <div className="flex-1" />
            <Badge tone="slate"><Eye size={13} /> צפייה בלבד</Badge>
            <div className="md:hidden">
              <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><LogOut size={20} /></button>
            </div>
          </div>
          <nav className="md:hidden flex gap-1 px-3 pb-2">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => clsx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                  isActive ? 'bg-teal-600 text-white' : 'text-slate-500 bg-white ring-1 ring-slate-200')}>
                <item.icon size={16} /> {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="flex-1 p-4 sm:p-6 max-w-[1200px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
