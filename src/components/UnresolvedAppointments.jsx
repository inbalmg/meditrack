import { forwardRef, useEffect, useMemo, useState } from 'react'
import { CalendarClock, UserX, CheckCircle2, ChevronDown } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { useSession } from '../session.jsx'
import { Card } from './ui.jsx'
import AppointmentActions from './AppointmentActions.jsx'
import ConfirmDialog from './ConfirmDialog.jsx'
import { hhmm, friendlyDate, relativeFromNow } from '../lib/format.js'
import { useNow } from '../lib/useNow.js'
import { selectUnresolved } from '../lib/appointments.js'
import { clsx } from './clsx.js'

// A soft, collapsible review queue of past appointments still marked 'קבוע' (slot
// ended, arrival/no-show never recorded). Collapsed by default — a compact summary
// bar with a count and a toggle. Each row resolves inline via AppointmentActions;
// a secondary batch action clears the whole backlog as no-show. Lives on the Tasks
// board. `highlighted` (arriving from the Dashboard KPI) rings the card and auto-
// expands it. Read-only roles (no canApprove) never render it.
const UnresolvedAppointments = forwardRef(function UnresolvedAppointments({ highlighted = false }, ref) {
  const { appointments, patientById, therapistById, bulkMarkNoShow } = useData()
  const { role } = useSession()
  const [open, setOpen] = useState(false)
  const [confirmNoShow, setConfirmNoShow] = useState(false)

  const now = useNow()
  const unresolved = useMemo(() => selectUnresolved(appointments, now), [appointments, now])
  const count = unresolved.length

  // Deep-link from the KPI: reveal the list so the redirect lands on the content.
  useEffect(() => {
    if (highlighted) setOpen(true)
  }, [highlighted])

  if (!role.canApprove) return null

  // Nothing pending — a quiet "all clear" bar (no toggle, no red).
  if (count === 0) {
    return (
      <Card ref={ref} className="flex items-center gap-2.5 px-4 py-3">
        <span className="grid place-items-center h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
          <CheckCircle2 size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-700 truncate">תורים שלא עודכנו</h3>
          <p className="text-xs text-slate-500 truncate">כל התורים מהעבר עודכנו — אין תורים שממתינים לבדיקה</p>
        </div>
      </Card>
    )
  }

  return (
    <Card
      ref={ref}
      className={clsx(
        'flex flex-col overflow-hidden scroll-mt-4 !ring-amber-200 transition',
        highlighted && '!ring-2 !ring-amber-300',
      )}
    >
      {/* Summary bar — the whole row toggles the accordion. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'w-full flex items-center justify-between gap-3 px-4 py-3 text-right transition-colors',
          open ? 'bg-amber-50/40' : 'hover:bg-amber-50/30',
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-amber-50 text-amber-600 shrink-0">
            <CalendarClock size={17} />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-amber-700 truncate">תורים שלא עודכנו</h3>
            <p className="text-xs text-slate-500 truncate">ממתינים לעדכון הגעה או אי-הגעה</p>
          </div>
          <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200 shrink-0">
            {count}
          </span>
        </div>
        <ChevronDown size={18} className={clsx('text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Expanded content — the actionable list + a secondary batch action. */}
      {open && (
        <div className="border-t border-amber-100">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <p className="text-xs text-slate-500 min-w-0 truncate">עדכן/י סטטוס לכל תור שהסתיים: הגיע או לא הגיע</p>
            <button
              type="button"
              onClick={() => setConfirmNoShow(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-3 h-8 text-sm font-medium shrink-0 transition-colors"
            >
              <UserX size={15} /> סמן הכל כלא הגיע
            </button>
          </div>
          <div>
            {unresolved.map((a) => {
              const p = patientById[a.patientId]
              const t = therapistById[a.therapistId]
              return (
                <div key={a.id} className="flex items-center gap-2.5 px-4 py-2.5 border-t border-slate-100">
                  <span className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: t?.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p?.name ?? 'מטופל/ת'}</p>
                    <p className="text-xs text-slate-600 truncate">
                      {a.visitType} · {t?.name ?? ''} · {friendlyDate(a.start)} {hhmm(a.start)}
                      <span className="text-slate-400"> · {relativeFromNow(a.start)}</span>
                    </p>
                  </div>
                  <AppointmentActions appt={a} compact />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {confirmNoShow && (
        <ConfirmDialog
          title="לסמן את כל התורים כלא הגיע?"
          message={`${count} תורים מהעבר יסומנו כ"לא הגיע" ותיפתח לכל אחד משימת פולו-אפ. אפשר לסמן ידנית "הגיע" לפני כן.`}
          confirmLabel="סמן הכל כלא הגיע"
          onConfirm={() => {
            bulkMarkNoShow(unresolved.map((a) => a.id))
            setConfirmNoShow(false)
          }}
          onClose={() => setConfirmNoShow(false)}
        />
      )}
    </Card>
  )
})

export default UnresolvedAppointments
