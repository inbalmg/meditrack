import { useMemo, useState, useRef } from 'react'
import { isToday } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Clock3,
  ListTodo,
  AlertTriangle,
  ChevronLeft,
  ChevronDown,
  CheckCircle2,
  Clock,
  Phone,
  Plus,
  Info,
} from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { useSession } from '../../session.jsx'
import { Card, CardHeader, Kpi, Badge, Empty } from '../../components/ui.jsx'
import RequestRow, { REQ_COLS } from '../../components/RequestRow.jsx'
import AppointmentActions from '../../components/AppointmentActions.jsx'
import PhoneRequestDialog from '../../components/PhoneRequestDialog.jsx'
import { hhmm, relativeFromNow } from '../../lib/format.js'
import { clsx } from '../../components/clsx.js'

// Demo greeting name — in production this comes from the authenticated user.
const DEMO_STAFF_NAME = 'מיכל'
// One-line onboarding explanation of why this queue is short (exceptions only).
// Lives in the header info tooltip + the empty state instead of a fixed paragraph.
const QUEUE_HINT =
  'רוב הבקשות עצמיות ומשובצות אוטומטית ביומן — כאן רק מקרים שדורשים טיפול אנושי (הפניה דחופה/טלפון)'

function greetingFor(date) {
  const h = date.getHours()
  if (h < 12) return 'בוקר טוב'
  if (h < 18) return 'צהריים טובים'
  return 'ערב טוב'
}

// ריבוי בעברית: n=1 → הצורה המלאה ליחיד; אחרת "N <רבים>".
function plural(n, one, many) {
  return n === 1 ? one : `${n} ${many}`
}

// שורת סיכום טריאז' לברכה — רק פסוקיות רלוונטיות (בקשות/דחוף מוצגות רק אם >0).
function buildSummary({ appts, pending, urgent }) {
  const parts = [appts === 0 ? 'אין תורים היום' : plural(appts, 'תור אחד היום', 'תורים היום')]
  if (pending > 0) parts.push(plural(pending, 'בקשה אחת ממתינה', 'בקשות ממתינות'))
  if (urgent > 0) parts.push(plural(urgent, 'משימה דחופה אחת', 'משימות דחופות'))
  return parts.join(' · ')
}

const isTerminal = (a) => a.status === 'הסתיים' || a.status === 'לא הגיע'

export default function Dashboard() {
  const { requests, appointments, tasks, patientById, therapistById } = useData()
  const { role } = useSession()
  const navigate = useNavigate()
  const [phoneOpen, setPhoneOpen] = useState(false)
  // Requests the user has opened this session → "read" (drops the blue dot + count).
  const [openedIds, setOpenedIds] = useState(() => new Set())
  const markRead = (id) =>
    setOpenedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  // "New requests" filter chip. null = off; a Set = the ids captured when the
  // filter was switched on. Snapshotting keeps rows from vanishing as opening
  // one marks it read — the table stays stable until the filter is cleared.
  const [unreadFilter, setUnreadFilter] = useState(null)

  const requestsRef = useRef(null)
  const tasksRef = useRef(null)
  const todayRef = useRef(null)
  const nextApptRef = useRef(null)
  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // "הבא בתור" — glide straight to the highlighted next appointment (or the day
  // board if none is left), centered so it lands in view.
  const scrollToNext = () =>
    (nextApptRef.current ?? todayRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const now = new Date()

  // Requests = exceptions awaiting approval, urgent first, then newest.
  const pending = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'ממתין')
        .sort(
          (a, b) =>
            (b.ai.urgentFlag ? 1 : 0) - (a.ai.urgentFlag ? 1 : 0) || b.createdAt - a.createdAt,
        ),
    [requests],
  )
  const unreadCount = pending.filter((r) => !openedIds.has(r.id)).length
  // When the "new" filter is on, show only the snapshotted new requests.
  const visiblePending = unreadFilter ? pending.filter((r) => unreadFilter.has(r.id)) : pending
  const toggleUnreadFilter = () =>
    setUnreadFilter((f) =>
      f ? null : new Set(pending.filter((r) => !openedIds.has(r.id)).map((r) => r.id)),
    )

  // Tasks that matter today: due today or overdue, not yet done — overdue first.
  const todayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'הושלם' && (isToday(t.due) || t.due < now))
        .sort((a, b) => (a.due < now ? 0 : 1) - (b.due < now ? 0 : 1) || a.due - b.due),
    [tasks, now],
  )
  const overdueCount = todayTasks.filter((t) => t.due < now).length

  // Today's schedule, grouped by start time so parallel appointments (several
  // therapists at once) share a single time label.
  const todayAppts = useMemo(
    () => appointments.filter((a) => isToday(a.start)).sort((a, b) => a.start - b.start),
    [appointments],
  )
  const todayGroups = useMemo(() => {
    const map = new Map()
    for (const a of todayAppts) {
      const key = a.start.getTime()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(a)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([time, appts]) => ({ time, appts }))
  }, [todayAppts])

  const nextAppt = todayAppts.find((a) => a.start.getTime() >= now.getTime() && !isTerminal(a))
  const nextTime = nextAppt ? nextAppt.start.getTime() : null
  // "עבר" = כבר טופל (הסתיים/לא הגיע) או שהשעה שלו כבר חלפה. נותרו = רק תורים עתידיים פעילים.
  const isPast = (a) => isTerminal(a) || a.start.getTime() < now.getTime()
  const remaining = todayAppts.filter((a) => !isPast(a)).length

  return (
    <div className="space-y-6 animate-fade">
      {/* Greeting + triage summary + date */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800">
            {greetingFor(now)}, {DEMO_STAFF_NAME}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {buildSummary({ appts: todayAppts.length, pending: pending.length, urgent: overdueCount })}
          </p>
        </div>
        <Badge tone="teal">
          <Clock size={13} /> {now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Badge>
      </div>


      {/* Prioritised summary — action tiles keep their colour; context tiles stay neutral. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          compact
          label="דורש אישור"
          value={pending.length}
          icon={AlertTriangle}
          tone="red"
          accent="red"
          onClick={() => scrollTo(requestsRef)}
        />
        <Kpi
          compact
          label="משימות להיום"
          value={todayTasks.length}
          delta={overdueCount ? `· ${overdueCount} באיחור` : ''}
          deltaTone="red"
          icon={ListTodo}
          tone="amber"
          accent="amber"
          onClick={() => scrollTo(tasksRef)}
        />
        <Kpi
          compact
          label="תורים היום"
          value={todayAppts.length}
          icon={CalendarDays}
          tone="slate"
          onClick={() => navigate('/clinic/calendar')}
        />
        <Kpi
          compact
          label="הבא בתור"
          value={nextAppt ? hhmm(nextAppt.start) : '—'}
          icon={Clock3}
          tone="slate"
          onClick={scrollToNext}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        {/* Action column — requests + tasks (what needs my decision) */}
        <div className="space-y-6 min-w-0">
          {/* Requests to approve */}
          <Card ref={requestsRef} className="flex flex-col overflow-hidden scroll-mt-4">
            <div className="flex items-center justify-between gap-3 bg-ink-900 px-5 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span title={QUEUE_HINT} className="inline-flex cursor-help shrink-0 text-slate-400 hover:text-slate-200 transition">
                  <Info size={15} />
                </span>
                <h3 className="font-semibold text-white truncate">בקשות הדורשות טיפול</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Filter pill — toggles the table to new requests only (Chevron flips when active) */}
                {pending.length > 0 && (unreadCount > 0 || unreadFilter) && (
                  <button
                    type="button"
                    aria-pressed={!!unreadFilter}
                    onClick={toggleUnreadFilter}
                    title={unreadFilter ? 'הצג את כל הבקשות' : 'סנן לבקשות חדשות בלבד'}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-sm font-medium ring-1 transition',
                      unreadFilter
                        ? 'bg-blue-600 text-white ring-blue-500 hover:bg-blue-700'
                        : 'bg-white/10 text-white ring-white/15 hover:bg-white/20',
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-white shrink-0" />
                    {unreadCount} {unreadCount === 1 ? 'חדשה' : 'חדשות'}
                    <ChevronDown size={15} className={clsx('transition-transform', unreadFilter && 'rotate-180')} />
                  </button>
                )}
                {role.canApprove && (
                  <button
                    onClick={() => setPhoneOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white ring-1 ring-white/15 px-3 h-8 text-sm font-medium transition"
                  >
                    <Plus size={15} /> <Phone size={15} /> בקשה טלפונית
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto scroll-thin no-gutter">
              <div className="min-w-[520px]">
                {/* Column headers */}
                <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 text-xs font-medium text-slate-500">
                  <div className={REQ_COLS.patient}>מטופל</div>
                  <div className={REQ_COLS.received}>התקבלה</div>
                  <div className={REQ_COLS.visitType}>סוג ביקור</div>
                  <div className={REQ_COLS.action} />
                  <div className={REQ_COLS.chevron} />
                </div>
                <div>
                  {visiblePending.length === 0 ? (
                    unreadFilter ? (
                      <Empty icon={CheckCircle2} title="אין בקשות חדשות" hint="כל הבקשות החדשות כבר נקראו" />
                    ) : (
                      <Empty icon={CheckCircle2} title="הכול טופל!" hint={QUEUE_HINT} />
                    )
                  ) : (
                    visiblePending.map((r) => (
                      <RequestRow
                        key={r.id}
                        request={r}
                        canApprove={role.canApprove}
                        unread={!openedIds.has(r.id)}
                        onOpen={markRead}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Tasks due today */}
          <Card ref={tasksRef} className="flex flex-col overflow-hidden scroll-mt-4">
            <CardHeader
              dark
              title="משימות להיום"
              icon={ListTodo}
              action={
                <Link to="/clinic/tasks" className="text-sm text-teal-300 hover:text-teal-200 flex items-center gap-0.5">
                  לכל המשימות <ChevronLeft size={15} />
                </Link>
              }
            />
            <div>
              {todayTasks.length === 0 ? (
                <Empty icon={CheckCircle2} title="אין משימות להיום" />
              ) : (
                todayTasks.map((t) => {
                  const overdue = t.due < now
                  const dot = overdue
                    ? 'bg-red-500'
                    : t.source === 'אוטומציה'
                      ? 'bg-amber-400'
                      : 'bg-slate-400'
                  // Anchor the target time to when the task originated, so "14:10"
                  // doesn't read as disconnected: for a no-show follow-up show the
                  // triggering appointment time; otherwise how long ago it opened.
                  const origin = t.sourceAt
                    ? `בעקבות אי-הגעה לתור ${hhmm(t.sourceAt)}`
                    : t.createdAt
                      ? `נוצר ${relativeFromNow(t.createdAt)}`
                      : null
                  return (
                    <div
                      key={t.id}
                      className={clsxRow(overdue)}
                    >
                      <div className="text-center w-11 shrink-0">
                        <p className={`text-xs font-semibold tabular-nums ${overdue ? 'text-red-600' : 'text-slate-600'}`}>
                          {hhmm(t.due)}
                        </p>
                        {overdue && <p className="text-[10px] text-red-600">באיחור</p>}
                      </div>
                      <span className={`h-2 w-2 rounded-full shrink-0 ${dot} mt-1.5 self-start`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 truncate">{t.title}</p>
                        {origin && (
                          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                            <Clock size={11} className="shrink-0" /> {origin}
                          </p>
                        )}
                      </div>
                      {t.source === 'אוטומציה' ? (
                        <Badge tone="purple">אוטומציה</Badge>
                      ) : (
                        <Badge tone="slate">ידני</Badge>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>

        {/* Context column — today's timeline (whole page scrolls, no inner scroll) */}
        <Card ref={todayRef} className="flex flex-col overflow-hidden min-w-0 scroll-mt-4">
          <CardHeader
            dark
            title="לוח היום"
            icon={CalendarDays}
            action={
              <Link to="/clinic/calendar" className="text-sm text-teal-300 hover:text-teal-200 flex items-center gap-0.5 whitespace-nowrap">
                ליומן המלא <ChevronLeft size={15} />
              </Link>
            }
          />
          <div className="px-4 pt-2 pb-1.5 text-xs text-slate-600 border-b border-slate-100">
            {remaining === 0
              ? 'לא נותרו תורים להיום'
              : remaining === 1
                ? 'נותר תור אחד להיום'
                : `נותרו ${remaining} תורים להיום`}
          </div>
          <div className="p-1.5 space-y-1">
            {todayGroups.length === 0 ? (
              <Empty icon={CalendarDays} title="אין תורים היום" />
            ) : (
              todayGroups.map((group) => {
                const isNext = group.time === nextTime
                return (
                  <div
                    key={group.time}
                    ref={isNext ? nextApptRef : undefined}
                    className={
                      isNext
                        ? 'flex gap-2 rounded-xl p-2 bg-sky-50 border-r-2 border-ink-900 scroll-mt-20'
                        : 'flex gap-2 rounded-xl p-2'
                    }
                  >
                    <div className="w-9 shrink-0 flex flex-col items-center justify-center">
                      <p className="text-sm font-bold text-slate-700 tabular-nums">{hhmm(group.appts[0].start)}</p>
                      {isNext && <p className="text-[10px] font-medium text-slate-600">הבא</p>}
                    </div>
                    <div className="flex-1 min-w-0">
                      {group.appts.map((a, i) => {
                        const p = patientById[a.patientId]
                        const t = therapistById[a.therapistId]
                        const past = isPast(a)
                        return (
                          <div
                            key={a.id}
                            className={`flex items-center gap-2 ${i > 0 ? 'mt-2 pt-2 border-t border-slate-100' : ''} ${past ? 'opacity-60' : ''}`}
                          >
                            <span className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                              <p className="text-xs text-slate-600 truncate">{a.visitType} · {t.name} · {a.durationMin} דק׳</p>
                            </div>
                            <AppointmentActions appt={a} compact />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      {phoneOpen && <PhoneRequestDialog onClose={() => setPhoneOpen(false)} />}
    </div>
  )
}

// Task row layout; overdue rows get a soft red wash + red accent bar.
function clsxRow(overdue) {
  return [
    'flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 last:border-0',
    overdue ? 'bg-red-50/60 border-r-2 border-red-500' : '',
  ].join(' ')
}
