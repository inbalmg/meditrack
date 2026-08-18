import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  ListChecks,
  BarChart3,
  Settings,
  LogOut,
  ArrowRight,
  Clock,
} from 'lucide-react'
import { useSession } from '../session.jsx'
import { useData } from '../data/store.jsx'
import { Avatar } from '../components/ui.jsx'
import BookingConfirmationModal from '../components/BookingConfirmationModal.jsx'
import { clsx } from '../components/clsx.js'
import { CrossMark } from '../components/Logo.jsx'
import logoUrl from '../assets/meditrack-logo.svg'

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
    ...(role.canSettings ? [{ to: '/clinic/settings', icon: Settings, label: 'הגדרות' }] : []),
  ]

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-full flex bg-canvas">
      {/* Sidebar (right, in RTL) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-ink-900 text-slate-300 sticky top-0 h-screen">
        <div className="flex items-center px-6 h-16 border-b border-white/5">
          {/* Same high-res wordmark asset as the login/welcome hero (identical logo across views). */}
          <img src={logoUrl} alt="MediTrack Clinic" className="h-10 w-auto" />
        </div>

        <nav className="flex-1 px-3 pt-[19px] pb-4 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition',
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm'
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

        <div className="p-3 border-t border-white/5 space-y-1">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar initials={role.id === 'manager' ? 'מנ' : 'מז'} color="#14b8a6" />
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-white truncate">{role.label}</p>
              <p className="text-sm text-slate-400 truncate">מרפאת שקד · מרכז</p>
            </div>
          </div>
          {/* Dedicated, explicit logout row (icon + label). */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-300 transition"
          >
            <LogOut size={19} />
            <span className="flex-1 text-right">התנתקות</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onLogout={handleLogout} nav={nav} />
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Booking-success confirmation (shown after approving a phone/AI request). */}
      <BookingConfirmationModal />
    </div>
  )
}

function TopBar({ onLogout, nav }) {
  const navigate = useNavigate()
  const location = useLocation()
  // תאריך היום מוצג בכל המסכים חוץ מ"הגדרות".
  const isSettings = location.pathname.startsWith('/clinic/settings')
  const today = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <header className="sticky top-0 z-20 bg-canvas/80 backdrop-blur border-b border-slate-200/70">
      <div className="h-16 px-4 sm:px-6 flex items-center gap-3 max-w-[1400px] mx-auto">
        {/* חזרה למסך הקודם */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
        >
          <ArrowRight size={18} className="shrink-0" />
          <span className="hidden sm:inline">חזרה</span>
        </button>
        {/* Mobile brand + nav */}
        <div className="md:hidden flex items-center gap-2">
          <CrossMark className="h-7 w-7" />
          <span className="font-bold text-lg text-slate-800">MediTrack</span>
        </div>
        <div className="flex-1" />
        {/* תאריך היום — מיושר לגובה הלוגו, בכל המסכים חוץ מהגדרות */}
        {!isSettings && (
          <div className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-teal-700 whitespace-nowrap">
            <Clock size={15} className="shrink-0" />
            {today}
          </div>
        )}
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
