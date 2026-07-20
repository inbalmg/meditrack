import { LogIn, UserX, CheckCheck, Check } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { useSession } from '../session.jsx'
import { Badge, Button } from './ui.jsx'

// Check-in / check-out controls for an appointment. Per the spec the secretary
// marks arrival at reception and completion at check-out; a no-show is normally
// auto-marked after X minutes (here it's a manual button for the demo, with a
// note). Gated on role.canApprove so the doctor (view-only) never sees it.
//
// Lifecycle: קבוע → הגיע → הסתיים, with a branch קבוע → לא הגיע.

const STATUS_TONE = { קבוע: 'blue', הגיע: 'teal', הסתיים: 'green', 'לא הגיע': 'red' }

// `compact` renders icon-only buttons (with tooltips) so the controls fit in
// tight spots like the dashboard "today" list without squeezing the name.
export default function AppointmentActions({ appt, size = 'sm', compact = false, className = '' }) {
  const { setAppointmentStatus } = useData()
  const { role } = useSession()

  // Terminal states, or no permission → just show the status.
  const terminal = appt.status === 'הסתיים' || appt.status === 'לא הגיע'
  if (!role?.canApprove || terminal) {
    return <Badge tone={STATUS_TONE[appt.status]}>{appt.status}</Badge>
  }

  if (appt.status === 'הגיע') {
    return (
      <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
        <Badge tone="teal"><Check size={12} /> הגיע</Badge>
        <Button size={size} className={compact ? 'px-2' : ''} title="סיום ביקור"
          onClick={() => setAppointmentStatus(appt.id, 'הסתיים')}>
          <CheckCheck size={15} /> {!compact && 'סיום ביקור'}
        </Button>
      </div>
    )
  }

  // status === 'קבוע'
  const noShowTitle = 'במערכת האמיתית מסומן אוטומטית אחרי X דקות; כאן ידני לצורך ההדגמה'
  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
      <Button variant="soft" size={size} className={compact ? 'px-2' : ''} title="הגיע"
        onClick={() => setAppointmentStatus(appt.id, 'הגיע')}>
        <LogIn size={15} /> {!compact && 'הגיע'}
      </Button>
      <Button
        variant="ghost"
        size={size}
        onClick={() => setAppointmentStatus(appt.id, 'לא הגיע')}
        title={compact ? 'לא הגיע' : noShowTitle}
        className={`text-red-500 hover:bg-red-50 ${compact ? 'px-2' : ''}`}
      >
        <UserX size={15} /> {!compact && 'לא הגיע'}
      </Button>
    </div>
  )
}
