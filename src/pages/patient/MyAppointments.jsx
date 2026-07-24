import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CalendarHeart, Bell, FilePlus2, Clock, Check, X, Hourglass, MapPin } from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { Card, Badge, Button, Empty } from '../../components/ui.jsx'
import { hhmm, friendlyDate, relativeFromNow } from '../../lib/format.js'
import { clsx } from '../../components/clsx.js'

const REQ_STATUS = {
  ממתין: { tone: 'amber', icon: Hourglass, text: 'ממתינה לאישור המרפאה' },
  אושר: { tone: 'green', icon: Check, text: 'אושרה — נקבע תור' },
  נדחה: { tone: 'red', icon: X, text: 'נדחתה — ניתן לשלוח בקשה חדשה' },
}

export default function MyAppointments() {
  const { requests, appointments, currentPatientId, therapistById, settings, cancelAppointment } = useData()

  const myRequests = requests.filter((r) => r.patientId === currentPatientId)
  const lastRequest = myRequests[0] // newest first
  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => a.patientId === currentPatientId && a.start >= new Date() && a.status !== 'לא הגיע')
        .sort((a, b) => a.start - b.start),
    [appointments, currentPatientId],
  )

  return (
    <div className="animate-fade space-y-5">
      {/* Last request status */}
      {lastRequest && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-2 px-1">סטטוס הבקשה האחרונה</h2>
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <StatusIcon status={lastRequest.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 leading-relaxed">"{lastRequest.description}"</p>
                <p className="text-xs text-slate-400 mt-1">{relativeFromNow(lastRequest.createdAt)}</p>
                <Badge tone={REQ_STATUS[lastRequest.status].tone} className="mt-2">
                  {REQ_STATUS[lastRequest.status].text}
                </Badge>
              </div>
            </div>
          </Card>
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
          <div className="space-y-3">
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
                      <Link to="/patient/new" className="flex-1">
                        <Button variant="soft" size="sm" className="w-full">שינוי מועד</Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => cancelAppointment(a.id)}>
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
                נשלח לך תזכורת בוואטסאפ/SMS {settings.reminderHours} שעות לפני כל תור, כדי שלא תפספס/י.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Link to="/patient/new" className="block">
        <Button size="lg" className="w-full"><FilePlus2 size={18} /> בקשת תור חדש</Button>
      </Link>
    </div>
  )
}

function StatusIcon({ status }) {
  const { tone, icon: Icon } = REQ_STATUS[status]
  const bg = { amber: 'bg-amber-100 text-amber-600', green: 'bg-emerald-100 text-emerald-600', red: 'bg-red-100 text-red-600' }[tone]
  return <span className={clsx('grid place-items-center h-9 w-9 rounded-xl shrink-0', bg)}><Icon size={18} /></span>
}
