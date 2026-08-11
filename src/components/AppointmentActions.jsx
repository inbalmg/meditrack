import { LogIn, UserX, CheckCheck, Check } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { useSession } from '../session.jsx'
import { Badge, Button } from './ui.jsx'

// Check-in / check-out controls for an appointment. The secretary marks arrival at
// reception and completion at check-out; a no-show is a front-desk action. Therapists
// run their own sessions, so they may advance THEIR visit to הגיע/הסתיים too — but
// never mark a no-show (that stays with the desk + its follow-up automation).
//
// Lifecycle: קבוע → הגיע → הסתיים, with a staff-only branch קבוע → לא הגיע.

const STATUS_TONE = { קבוע: 'blue', הגיע: 'teal', הסתיים: 'green', 'לא הגיע': 'red' }

// `compact` renders icon-only buttons (with tooltips) so the controls fit in
// tight spots like the dashboard "today" list without squeezing the name.
export default function AppointmentActions({ appt, size = 'sm', compact = false, className = '' }) {
  const { setAppointmentStatus, settings } = useData()
  const { role } = useSession()

  const isTherapist = role?.id === 'therapist'
  const canAct = role?.canApprove || isTherapist

  // Terminal states, or no permission → just show the status.
  const terminal = appt.status === 'הסתיים' || appt.status === 'לא הגיע'
  if (!canAct || terminal) {
    return <Badge tone={STATUS_TONE[appt.status]}>{appt.status}</Badge>
  }

  // Compact rows show icon-only buttons; use the square `icon` size so the tap
  // target stays comfortable (h-9 w-9) instead of a cramped padded button.
  const btnSize = compact ? 'icon' : size

  if (appt.status === 'הגיע') {
    return (
      <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
        <Badge tone="teal"><Check size={12} /> הגיע</Badge>
        <Button size={btnSize} title="סיום ביקור"
          onClick={() => setAppointmentStatus(appt.id, 'הסתיים')}>
          <CheckCheck size={15} /> {!compact && 'סיום ביקור'}
        </Button>
      </div>
    )
  }

  // status === 'קבוע'
  const noShowTitle = settings.autoNoShow
    ? `במערכת האמיתית מסומן אוטומטית אחרי ${settings.noShowMinutes} דקות; כאן ידני לצורך ההדגמה`
    : 'סימון אי-הגעה אוטומטי כבוי בהגדרות — סימון ידני בלבד'
  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
      <Button variant="soft" size={btnSize} title="הגיע"
        onClick={() => setAppointmentStatus(appt.id, 'הגיע')}>
        <LogIn size={15} /> {!compact && 'הגיע'}
      </Button>
      {/* No-show is a front-desk action only — therapists never mark it. */}
      {role?.canApprove && (
        <Button
          variant="ghost"
          size={btnSize}
          onClick={() => setAppointmentStatus(appt.id, 'לא הגיע')}
          title={compact ? 'לא הגיע' : noShowTitle}
          className="text-red-500 hover:bg-red-50"
        >
          <UserX size={15} /> {!compact && 'לא הגיע'}
        </Button>
      )}
    </div>
  )
}
