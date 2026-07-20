import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  ListChecks,
  BarChart3,
  LogOut,
  Plus,
  Bell,
} from 'lucide-react'
import { useSession } from '../session.jsx'
import { useData } from '../data/store.jsx'
import { Avatar } from '../components/ui.jsx'
import { clsx } from '../components/clsx.js'

export default function ClinicLayout() {
  const { role, logout } = useSession()
  const navigate = useNavigate()
  const { requests, tasks } = useData()

  const pendingCount = requests.filter((r) => r.status === 'ממתין').length
  const openTasks = tasks.filter((t) => t.status !== 'הושלם').length

  const nav = [
    { to: '/clinic', end: true, icon: LayoutDashboard, label: 'מרכז פעילות', badge: pendingCount },
    { to: '/clinic/calendar', icon: CalendarDays, label: 'יומן הקליניקה' },
    { to: '/clinic/tasks', icon: ListChecks, label: 'לוח משימות', badge: openTasks },
    ...(role.canReports ? [{ to: '/clinic/reports', icon: BarChart3, label: 'דוחות ואנליטיקה' }] : []),
  ]

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-full flex bg-canvas">
      {/* Sidebar (right, in RTL) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-ink-900 text-slate-300 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-6 h-16 border-b border-white/5">
          <span className="grid place-items-center h-9 w-9 rounded-lg bg-teal-500 text-white">
            <Plus size={20} strokeWidth={3} />
          </span>
          <div>
            <p className="font-bold text-white leading-tight">MediTrack</p>
            <p className="text-[11px] text-teal-400">Clinic</p>
          </div>
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
                  isActive
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={19} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge > 0 && (
                    <span
                      className={clsx(
                        'grid place-items-center min-w-5 h-5 px-1 rounded-full text-[11px] font-bold',
                        isActive ? 'bg-white text-teal-600' : 'bg-teal-500/90 text-white',
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar initials={role.id === 'manager' ? 'מנ' : 'מז'} color="#14b8a6" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{role.label}</p>
              <p className="text-[11px] text-slate-400 truncate">מרפאת שקד · מרכז</p>
            </div>
            <button
              onClick={handleLogout}
              title="יציאה"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar role={role} pendingCount={pendingCount} onLogout={handleLogout} nav={nav} />
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function TopBar({ role, pendingCount, onLogout, nav }) {
  return (
    <header className="sticky top-0 z-20 bg-canvas/80 backdrop-blur border-b border-slate-200/70">
      <div className="h-16 px-4 sm:px-6 flex items-center gap-3 max-w-[1400px] mx-auto">
        {/* Mobile brand + nav */}
        <div className="md:hidden flex items-center gap-2">
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-teal-600 text-white">
            <Plus size={18} strokeWidth={3} />
          </span>
          <span className="font-bold text-slate-800">MediTrack</span>
        </div>
        <div className="flex-1" />
        <button className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500">
          <Bell size={20} />
          {pendingCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-canvas" />
          )}
        </button>
        <div className="md:hidden">
          <button onClick={onLogout} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
            <LogOut size={20} />
          </button>
        </div>
      </div>
      {/* Mobile bottom-less nav row */}
      <nav className="md:hidden flex gap-1 px-3 pb-2 overflow-x-auto scroll-thin">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium',
                isActive ? 'bg-teal-600 text-white' : 'text-slate-500 bg-white ring-1 ring-slate-200',
              )
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
