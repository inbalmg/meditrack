import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarHeart, Bell, FilePlus2, Clock, Check, X, Hourglass, MapPin, Users } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { Card, Badge, Button, Empty } from '../../components/ui.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { hhmm, friendlyDate, relativeFromNow } from '../../lib/format.js'
import { clsx } from '../../components/clsx.js'

const REQ_STATUS = {
  ממתין: { tone: 'amber', icon: Hourglass, text: 'ממתינה לאישור המרפאה' },
  אושר: { tone: 'green', icon: Check, text: 'אושרה — נקבע תור' },
  נדחה: { tone: 'red', icon: X, text: 'נדחתה — ניתן לשלוח בקשה חדשה' },
}

// Patient-facing status view. Human inquiries have their own team-handling lifecycle:
//   ממתין        → awaiting the team
//   הומר למשימה  → the team is handling it (converted to an internal task, still active)
//   סגור         → handled/done (directly closed, or the linked task was completed)
// Booking requests fall back to REQ_STATUS.
function statusView(r) {
  if (r.kind === 'inquiry') {
    if (r.status === 'הומר למשימה') return { tone: 'blue', icon: Users, text: 'בטיפול הצוות' }
    if (r.status === 'סגור') return { tone: 'green', icon: Check, text: 'טופל' }
    return { tone: 'amber', icon: Hourglass, text: 'ממתינה לטיפול הצוות' }
  }
  return REQ_STATUS[r.status]
}

// Status banners are shown only while the request was updated within this window;
// a rejected request older than this auto-expires from the dashboard.
const RECENT_DAYS = 7
const RECENT_MS = RECENT_DAYS * 24 * 60 * 60 * 1000
// A handled inquiry ("טופל") lingers on the dashboard for 48h after completion, then
// drops off the active feed. Anchored on updatedAt (= when it was closed/completed).
const HANDLED_RETENTION_MS = 48 * 60 * 60 * 1000

// Manually-dismissed rejected banners persist locally (per browser), so a patient who
// closed a banner doesn't see it again on reload.
const DISMISS_KEY = 'meditrack:dismissedRequests'
function loadDismissed() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')) } catch { return new Set() }
}

export default function MyAppointments() {
  const { requests, appointments, currentPatientId, therapistById, settings, cancelAppointment } = useData()

  // Appointment pending cancel confirmation (null = no dialog open).
  const [confirmCancel, setConfirmCancel] = useState(null)
  // Locally-dismissed request banners (rejected requests the patient closed).
  const [dismissed, setDismissed] = useState(loadDismissed)
  function dismissRequest(id) {
    setDismissed((prev) => {
      const next = new Set(prev).add(id)
      try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const myRequests = requests.filter((r) => r.patientId === currentPatientId)
  // Active banners, newest change first. Two lifecycles:
  //  • Inquiries: pending / in-progress ('הומר למשימה') stay visible continuously while
  //    the team works them; handled ('סגור') lingers 48h post-completion, then drops off.
  //  • Booking requests: pending or recently-rejected within 7 days, dismissible.
  // Approved booking requests surface as an upcoming appointment instead.
  const activeRequests = useMemo(() => {
    const now = Date.now()
    const bookingCutoff = now - RECENT_MS
    return myRequests
      .filter((r) => {
        if (r.kind === 'inquiry') {
          if (r.status === 'ממתין' || r.status === 'הומר למשימה') return true
          if (r.status === 'סגור') {
            const anchor = r.updatedAt?.getTime() ?? r.createdAt.getTime()
            return now - anchor < HANDLED_RETENTION_MS
          }
          return false
        }
        return (r.status === 'ממתין' || r.status === 'נדחה') &&
          (r.updatedAt?.getTime() ?? r.createdAt.getTime()) >= bookingCutoff &&
          !dismissed.has(r.id)
      })
      .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0))
  }, [myRequests, dismissed])
  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => a.patientId === currentPatientId && a.start >= new Date() && a.status !== 'לא הגיע')
        .sort((a, b) => a.start - b.start),
    [appointments, currentPatientId],
  )

  return (
    <div className="animate-fade space-y-5">
      {/* Request status banners — pending / recently-rejected, dismissible */}
      {activeRequests.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-2 px-1">סטטוס הבקשות שלך</h2>
          <div className="space-y-3">
            {activeRequests.map((r) => {
              const view = statusView(r)
              const isRejected = r.status === 'נדחה'
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <StatusIcon view={view} />
                    <div className="flex-1 min-w-0">
                      {r.kind === 'inquiry' ? (
                        <>
                          <p className="text-sm font-medium text-slate-800">פנייה: {r.subject}</p>
                          {r.description?.trim() && (
                            <p className="text-sm text-slate-700 leading-relaxed mt-0.5">"{r.description}"</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-slate-700 leading-relaxed">"{r.description}"</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{relativeFromNow(r.createdAt)}</p>
                      <Badge tone={view.tone} className="mt-2">{view.text}</Badge>
                      {isRejected && r.rejectionReason && (
                        <div className="mt-2 rounded-lg bg-red-50 ring-1 ring-red-100 px-3 py-2 text-sm text-red-800 leading-relaxed">
                          <span className="font-medium">סיבת הדחייה: </span>{r.rejectionReason}
                        </div>
                      )}
                    </div>
                    {isRejected && (
                      <button
                        onClick={() => dismissRequest(r.id)}
                        title="הסתרת ההודעה"
                        aria-label="הסתרת ההודעה"
                        className="text-slate-400 hover:text-slate-600 p-1 -m-1 shrink-0 transition"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming appointments */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-2 px-1">התורים הקרובים שלי</h2>
        {upcoming.length === 0 ? (
          <Card className="p-2">
            <Empty icon={CalendarHeart} title="אין תורים קרובים" hint="שלחו בקשת תור חדשה" />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((a) => {
              const t = therapistById[a.therapistId]
              return (
                <Card key={a.id} className="overflow-hidden">
                  <div className="h-1.5" style={{ backgroundColor: t.color }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">{a.visitType}</p>
                        <p className="text-sm text-slate-500">{t.name} · {t.specialty}</p>
                      </div>
                      <Badge tone="blue">{a.status}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CalendarHeart size={15} className="text-teal-600" /> {friendlyDate(a.start)}
                      </span>
                      <span className="flex items-center gap-1.5 font-medium tabular-nums">
                        <Clock size={15} className="text-teal-600" /> {hhmm(a.start)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                      <MapPin size={13} /> מרפאת שקד · רח׳ הרצל 12, מרכז
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <Link to="/patient/new" state={{ rescheduleId: a.id }} className="flex-1">
                        <Button variant="soft" size="sm" className="w-full">שינוי מועד</Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(a)}>
                        <X size={14} /> ביטול תור
                      </Button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400 text-center">ניתן לבטל עד 24 שעות לפני התור</p>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Automated reminder note — configurable in the clinic Settings screen */}
      {settings.remindersEnabled && (
        <Card className="p-4 bg-teal-50/60 ring-teal-100">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-teal-100 text-teal-600 shrink-0"><Bell size={18} /></span>
            <div>
              <p className="text-sm font-medium text-slate-700">תזכורות אוטומטיות פעילות</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                נשלח לך תזכורת במייל / וואטסאפ יום לפני כל תור, כדי שלא תפספס/י.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Link to="/patient/new" className="block">
        <Button size="lg" className="w-full"><FilePlus2 size={18} /> בקשת תור חדש</Button>
      </Link>

      {confirmCancel && (
        <ConfirmDialog
          title="ביטול התור?"
          message={`${confirmCancel.visitType} · ${friendlyDate(confirmCancel.start)} בשעה ${hhmm(confirmCancel.start)}. פעולה זו אינה ניתנת לביטול.`}
          confirmLabel="כן, בטל/י תור"
          cancelLabel="חזרה"
          onConfirm={() => { cancelAppointment(confirmCancel.id); setConfirmCancel(null) }}
          onClose={() => setConfirmCancel(null)}
        />
      )}
    </div>
  )
}

function StatusIcon({ view }) {
  const { tone, icon: Icon } = view
  const bg = {
    amber: 'bg-amber-100 text-amber-600',
    green: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
    blue: 'bg-blue-100 text-blue-600',
  }[tone]
  return <span className={clsx('grid place-items-center h-9 w-9 rounded-xl shrink-0', bg)}><Icon size={18} /></span>
}
