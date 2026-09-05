import { useMemo, useState, useRef } from 'react'
import { isToday } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ListTodo,
  ChevronLeft,
  CheckCircle2,
  Clock,
  Info,
  ClockAlert,
  ClipboardList,
  CalendarPlus,
  ListPlus,
  AlertTriangle,
  ListFilter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { useData } from '../../data/store.jsx'
import { useSession } from '../../session.jsx'
import { Card, CardHeader, Kpi, Badge, Empty } from '../../components/ui.jsx'
import RequestRow, { REQ_COLS } from '../../components/RequestRow.jsx'
import AppointmentActions from '../../components/AppointmentActions.jsx'
import QuickBookDialog from '../../components/QuickBookDialog.jsx'
import EscalationDialog from '../../components/EscalationDialog.jsx'
import { hhmm, relativeFromNow, friendlyDate, shortDate } from '../../lib/format.js'
import { useNow } from '../../lib/useNow.js'
import { isPastUnmarked, selectUnresolved } from '../../lib/appointments.js'
import { isTaskOverdue } from '../../lib/tasks.js'
import { clsx } from '../../components/clsx.js'

// Fallback greeting name when the authenticated user has no full_name on file.
const FALLBACK_STAFF_NAME = 'צוות'
// First name only — the greeting reads "בוקר טוב, {שם}" (e.g. "אורית שקד" → "אורית").
function firstName(fullName) {
  return fullName?.trim().split(/\s+/)[0] || FALLBACK_STAFF_NAME
}
// One-line onboarding explanation of why this queue is short (exceptions only).
// Lives in the header info tooltip + the empty state instead of a fixed paragraph.
const QUEUE_HINT =
  'רוב ההזמנות עצמיות ומשובצות אוטומטית ביומן — כאן רק פניות אנושיות מהפורטל או פניות טלפוניות'

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

// עדיפות משימה בלוח "משימות להיום" — מדרג נמוך = קריטי יותר. איחור ודחיפות הם שני
// המימדים שהופכים משימה לקריטית, ושילובם למעלה מבטיח שמשימה גם-באיחור-וגם-דחופה
// לעולם לא תתפספס. tie-break בתוך מדרג = due עולה (הכי-ותיק/הכי-קרוב ראשון).
function taskTier(t, now, settings) {
  const overdue = isTaskOverdue(t, now, settings)
  const urgent = t.urgency === 'דחוף'
  if (overdue && urgent) return 0
  if (overdue) return 1
  if (urgent) return 2
  return 3
}

// שורת סיכום טריאז' לברכה — רק פסוקיות רלוונטיות (בקשות/דחוף מוצגות רק אם >0).
function buildSummary({ appts, pending, urgent }) {
  const parts = [appts === 0 ? 'אין תורים היום' : plural(appts, 'תור אחד היום', 'תורים היום')]
  if (pending > 0) parts.push(plural(pending, 'בקשה אחת ממתינה', 'בקשות ממתינות'))
  if (urgent > 0) parts.push(plural(urgent, 'משימה דחופה אחת', 'משימות דחופות'))
  return parts.join(' · ')
}

export default function Dashboard() {
  const { requests, appointments, tasks, patientById, therapistById, settings } = useData()
  const { role, fullName } = useSession()
  const navigate = useNavigate()
  // Desk launcher modals (moved here from the global header, into the metrics row).
  const [quickOpen, setQuickOpen] = useState(false)
  const [escalateOpen, setEscalateOpen] = useState(false)
  // Requests the user has opened this session → "read" (drops the blue dot + count).
  const [openedIds, setOpenedIds] = useState(() => new Set())
  const markRead = (id) =>
    setOpenedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  // "New requests" filter chip. null = off; a Set = the ids captured when the
  // filter was switched on. Snapshotting keeps rows from vanishing as opening
  // one marks it read — the table stays stable until the filter is cleared.
  const [unreadFilter, setUnreadFilter] = useState(null)
  // "Urgent only" filter chip (requests marked urgency='דחוף').
  const [urgentFilter, setUrgentFilter] = useState(false)
  const [showAllRequests, setShowAllRequests] = useState(false)
  // Sortable request-table columns. Default: newest received on top. Dates default
  // to desc (newest first), text columns to asc (א→ת); clicking the active column
  // toggles direction.
  const SORT_DEFAULT_DIR = { received: 'desc', patient: 'asc', visitType: 'asc' }
  const [sort, setSort] = useState({ key: 'received', dir: 'desc' })
  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: SORT_DEFAULT_DIR[key] }))

  const requestsRef = useRef(null)
  const tasksRef = useRef(null)
  const todayRef = useRef(null)
  const nextApptRef = useRef(null)
  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const now = useNow()

  // The queue = open work needing the desk, newest first: any request still 'ממתין'
  // (booking requests awaiting approval + inquiries awaiting resolution). Resolving an
  // inquiry (direct close 'סגור' or convert-to-task 'הומר למשימה') moves it out of 'ממתין'
  // so it drops off the board automatically.
  const pending = useMemo(
    () => requests.filter((r) => r.status === 'ממתין').sort((a, b) => b.createdAt - a.createdAt),
    [requests],
  )
  const unreadCount = pending.filter((r) => !openedIds.has(r.id)).length
  const urgentCount = pending.filter((r) => r.urgency === 'דחוף').length
  // Apply the active filter chips (new / urgent) to the queue.
  let filteredPending = pending
  if (unreadFilter) filteredPending = filteredPending.filter((r) => unreadFilter.has(r.id))
  if (urgentFilter) filteredPending = filteredPending.filter((r) => r.urgency === 'דחוף')
  // Apply the active column sort (patient / received / subject) before slicing.
  const dirMul = sort.dir === 'asc' ? 1 : -1
  const sortedPending = [...filteredPending].sort((a, b) => {
    if (sort.key === 'received') return (a.createdAt - b.createdAt) * dirMul
    const av = sort.key === 'patient' ? (patientById[a.patientId]?.name ?? '') : (a.subject ?? '')
    const bv = sort.key === 'patient' ? (patientById[b.patientId]?.name ?? '') : (b.subject ?? '')
    return av.localeCompare(bv, 'he') * dirMul
  })
  // The table shows the newest 5; a "show all" toggle reveals the rest.
  const REQUESTS_PREVIEW = 5
  const displayedPending = showAllRequests ? sortedPending : sortedPending.slice(0, REQUESTS_PREVIEW)
  // The two chips are single-select: turning one on clears the other; clicking the
  // active chip toggles it off (back to showing all).
  const toggleUnreadFilter = () =>
    setUnreadFilter((f) => {
      if (f) return null
      setUrgentFilter(false)
      return new Set(pending.filter((r) => !openedIds.has(r.id)).map((r) => r.id))
    })
  const toggleUrgentFilter = () =>
    setUrgentFilter((v) => {
      if (v) return false
      setUnreadFilter(null)
      return true
    })

  // Tasks that matter today: due today or overdue, not yet done. Ranked by a priority
  // tier (see taskTier) so the two things that make a task critical — being late and
  // being flagged דחוף — float a late-urgent task to the very top; within a tier the
  // earliest due wins (oldest-overdue first, otherwise chronological through the day).
  const todayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'הושלם' && (isToday(t.due) || isTaskOverdue(t, now, settings)))
        .sort((a, b) => taskTier(a, now, settings) - taskTier(b, now, settings) || a.due - b.due),
    [tasks, now, settings],
  )
  const overdueCount = todayTasks.filter((t) => isTaskOverdue(t, now, settings)).length
  // Dashboard is a bounded, prioritized preview — not the full backlog (that lives in
  // TasksBoard). Cap the rows so a growing overdue tail can't flood the panel; the
  // header "N באיחור" chip + footer link keep everything reachable.
  const TASKS_PREVIEW = 6
  const displayedTasks = todayTasks.slice(0, TASKS_PREVIEW)

  // Today's schedule, grouped by start time so parallel appointments (several
  // therapists at once) share a single time label.
  const todayAppts = useMemo(
    () => appointments.filter((a) => isToday(a.start)).sort((a, b) => a.start - b.start),
    [appointments],
  )
  // "לוח היום" מחלק את תורי היום לשלושה דליים. (א) פעיל/נותר — קרוב או פעיל (הגיע / קבוע
  // שעדיין בתוך המשבצת); זה מה שנספר ב"נותרו להיום". (ב) ממתין לעדכון — קבוע שהמשבצת שלו
  // הסתיימה וטרם עודכן; נשאר על הלוח עם צ'יפ ענבר "ממתין לעדכון" במקום להיעלם,
  // אך אינו נספר ב"נותרו". (ג) סופי — הסתיים/לא הגיע (מטופל למטה כ-resolvedToday).
  const activeToday = useMemo(
    () =>
      todayAppts.filter(
        (a) => a.status === 'הגיע' || (a.status === 'קבוע' && !isPastUnmarked(a, now)),
      ),
    [todayAppts, now],
  )
  const awaitingToday = useMemo(
    () => todayAppts.filter((a) => isPastUnmarked(a, now)),
    [todayAppts, now],
  )
  // "נותרו להיום" סופר רק את הפעילים — לא את הממתינים-לעדכון ולא את הסופיים.
  const visibleCount = activeToday.length
  // Today's finished visits stay on the board all day (muted) so the desk keeps a record
  // of what already happened — completed AND no-shows. They're context, not part of the
  // "remaining" count, and a no-show row keeps its "שחזר" (revert) control for mis-clicks.
  const resolvedToday = useMemo(
    () => todayAppts.filter((a) => a.status === 'הסתיים' || a.status === 'לא הגיע'),
    [todayAppts],
  )
  const timelineToday = useMemo(
    () => [...activeToday, ...awaitingToday, ...resolvedToday],
    [activeToday, awaitingToday, resolvedToday],
  )
  // "תורים להיום" KPI: a direct status breakdown instead of a single central number +
  // "total". Each count sits next to its own status label (נותרו · הסתיימו · לעדכון).
  // "נותרו" always shows (the primary remaining count, even 0); finished/awaiting only when
  // present. "לעדכון" is amber to flag it needs attention (matches the schedule's chip).
  const todayBreakdown = useMemo(() => {
    const segs = [{ value: visibleCount, label: 'נותרו', primary: true }]
    if (resolvedToday.length) segs.push({ value: resolvedToday.length, label: 'הסתיימו' })
    if (awaitingToday.length) segs.push({ value: awaitingToday.length, label: 'לעדכון', tone: 'amber' })
    return segs
  }, [visibleCount, resolvedToday.length, awaitingToday.length])
  const todayGroups = useMemo(() => {
    const map = new Map()
    for (const a of timelineToday) {
      const key = a.start.getTime()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(a)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([time, appts]) => ({ time, appts }))
  }, [timelineToday])

  // "הבא בתור" = התור הקרוב ביותר שעדיין לא התחיל (מבין הפעילים).
  const nextAppt = activeToday.find((a) => a.start.getTime() >= now.getTime())
  const nextTime = nextAppt ? nextAppt.start.getTime() : null

  // Unmarked past appointments (slot ended, still 'קבוע'): surfaced here as a count that
  // combines both buckets — today's "ממתין לעדכון" (awaitingToday) + prior days' "לא עודכן"
  // (selectUnresolved). Micro-copy splits today vs prior so one number stays legible. The
  // KPI deep-links to the review queue on the Tasks board (prior days only — today's are
  // handled on the schedule board above).
  const unresolvedToday = awaitingToday.length
  const unresolvedPrior = useMemo(
    () => selectUnresolved(appointments, now).length,
    [appointments, now],
  )
  const unresolvedCount = unresolvedToday + unresolvedPrior
  const unresolvedSub =
    unresolvedCount === 0
      ? undefined
      : unresolvedToday && unresolvedPrior
        ? `${unresolvedToday} מהיום · ${unresolvedPrior} קודמים`
        : unresolvedToday
          ? `${unresolvedToday} מהיום`
          : `${unresolvedPrior} מקודם`

  return (
    <div className="space-y-6 animate-fade">
      {/* Greeting + triage summary (התאריך עלה לכותרת העליונה, בגובה הלוגו) */}
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-800">
          {greetingFor(now)}, {firstName(fullName)}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {buildSummary({ appts: todayAppts.length, pending: pending.length, urgent: overdueCount })}
        </p>
      </div>


      {/* Metrics row (RTL right→left): 4 KPI tiles on the right, desk-action buttons on the
          left. On desktop the actions sit as a column filling the row height; on small
          screens the row wraps to a stack (KPIs on top, actions as a full-width row below). */}
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-3">
        {/* 4 balanced tiles — shrunk to give room to the action buttons. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1 min-w-0">
          <Kpi
            compact
            label="בקשות לטיפול"
            value={pending.length}
            icon={ClipboardList}
            tone="blue"
            chevron={false}
            onClick={() => scrollTo(requestsRef)}
          />
          <Kpi
            compact
            label="משימות להיום"
            value={todayTasks.length}
            delta={overdueCount ? `· ${overdueCount} באיחור` : ''}
            deltaTone="red"
            icon={ListTodo}
            tone="purple"
            chevron={false}
            onClick={() => scrollTo(tasksRef)}
          />
          <Kpi
            compact
            label="תורים להיום"
            breakdown={todayBreakdown}
            icon={CalendarDays}
            tone="slate"
            onClick={() => navigate('/clinic/calendar')}
          />
          <Kpi
            compact
            label="תורים שלא עודכנו"
            value={unresolvedCount}
            sub={unresolvedSub}
            icon={ClockAlert}
            tone={unresolvedCount > 0 ? 'amber' : 'slate'}
            onClick={() => navigate('/clinic/tasks', { state: { focus: 'unresolved' } })}
          />
        </div>

        {/* Desk actions — quick direct booking + open a request-to-treat. */}
        {role.canApprove && (
          <div className="flex flex-row lg:flex-col gap-2 shrink-0 lg:w-44">
            <button
              onClick={() => setQuickOpen(true)}
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 rounded-2xl bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition"
            >
              <CalendarPlus size={16} className="shrink-0" /> קביעה מהירה
            </button>
            <button
              onClick={() => setEscalateOpen(true)}
              className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 rounded-2xl bg-white px-3 py-2.5 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50 transition"
            >
              <ListPlus size={16} className="shrink-0" /> פתיחת בקשה
            </button>
          </div>
        )}
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
                {(urgentCount > 0 || urgentFilter || (pending.length > 0 && (unreadCount > 0 || unreadFilter))) && (
                  <ListFilter size={15} className="text-slate-400 shrink-0" />
                )}
                {/* Urgent-only filter chip — toggles the table to urgent requests. */}
                {(urgentCount > 0 || urgentFilter) && (
                  <FilterChip
                    active={urgentFilter}
                    onClick={toggleUrgentFilter}
                    activeClass="bg-red-500 text-white ring-red-300 shadow-sm"
                    title={urgentFilter ? 'בטל סינון — הצג את כל הבקשות' : 'סנן לבקשות דחופות בלבד'}
                    icon={<AlertTriangle size={13} className="shrink-0" />}
                  >
                    {urgentCount} {urgentCount === 1 ? 'דחופה' : 'דחופות'}
                  </FilterChip>
                )}
                {/* New/unread filter chip — toggles the table to new requests only. */}
                {pending.length > 0 && (unreadCount > 0 || unreadFilter) && (
                  <FilterChip
                    active={!!unreadFilter}
                    onClick={toggleUnreadFilter}
                    activeClass="bg-blue-500 text-white ring-blue-300 shadow-sm"
                    title={unreadFilter ? 'בטל סינון — הצג את כל הבקשות' : 'סנן לבקשות חדשות בלבד'}
                    icon={<span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />}
                  >
                    {unreadCount} {unreadCount === 1 ? 'חדשה' : 'חדשות'}
                  </FilterChip>
                )}
              </div>
            </div>

            <div className="overflow-x-auto scroll-thin no-gutter">
              <div className="min-w-[520px]">
                {/* Column headers. The patient header mirrors the row's leading urgency-icon
                    slot + gap so "מטופל" lines up vertically with the names below. */}
                <div className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 text-sm font-semibold text-slate-600">
                  <SortHeader
                    colClass={clsx(REQ_COLS.patient, 'gap-2')}
                    label="מטופל"
                    sortKey="patient"
                    sort={sort}
                    onSort={toggleSort}
                    leading={<span className="w-4 shrink-0" />}
                  />
                  <SortHeader colClass={clsx(REQ_COLS.received, 'gap-1.5')} label="התקבלה" sortKey="received" sort={sort} onSort={toggleSort} />
                  <SortHeader colClass={clsx(REQ_COLS.visitType, 'gap-1.5')} label="נושא" sortKey="visitType" sort={sort} onSort={toggleSort} />
                  <div className={REQ_COLS.action} />
                  <div className={clsx(REQ_COLS.chevron, 'mr-3')} />
                </div>
                <div>
                  {filteredPending.length === 0 ? (
                    unreadFilter ? (
                      <Empty icon={CheckCircle2} title="אין בקשות חדשות" hint="כל הבקשות החדשות כבר נקראו" />
                    ) : urgentFilter ? (
                      <Empty icon={CheckCircle2} title="אין בקשות דחופות" hint="אין כרגע בקשות שסומנו כדחופות" />
                    ) : (
                      <Empty icon={CheckCircle2} title="הכול טופל!" hint={QUEUE_HINT} />
                    )
                  ) : (
                    displayedPending.map((r) => (
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
            {/* Pagination — reveal the rest beyond the top 5. */}
            {filteredPending.length > REQUESTS_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllRequests((v) => !v)}
                className="w-full border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-slate-50 transition"
              >
                {showAllRequests ? 'הצג פחות' : `הצג את כל ${filteredPending.length} הבקשות`}
              </button>
            )}
          </Card>

          {/* Tasks due today */}
          <Card ref={tasksRef} className="flex flex-col overflow-hidden scroll-mt-4">
            <CardHeader
              dark
              title="משימות להיום"
              icon={ListTodo}
              badge={
                /* Status indicator next to the title — always visible even when some late
                   tasks fall below the preview cap, so the critical backlog is never hidden.
                   Soft, semi-transparent red to signal without shouting. */
                overdueCount > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/clinic/tasks?filter=overdue')}
                    title="הצג בלוח המשימות את המשימות שבאיחור בלבד"
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-medium text-red-300 ring-1 ring-red-400/25 hover:bg-red-500/25 transition shrink-0"
                  >
                    <AlertTriangle size={12} className="shrink-0" /> {overdueCount} באיחור
                  </button>
                )
              }
              action={
                <Link to="/clinic/tasks" className="text-sm text-teal-300 hover:text-teal-200 flex items-center gap-0.5 shrink-0">
                  לכל המשימות <ChevronLeft size={15} />
                </Link>
              }
            />
            <div>
              {todayTasks.length === 0 ? (
                <Empty icon={CheckCircle2} title="אין משימות להיום" />
              ) : (
                displayedTasks.map((t) => {
                  const overdue = isTaskOverdue(t, now, settings)
                  const dueToday = isToday(t.due)
                  const dot = overdue
                    ? 'bg-red-500'
                    : t.source === 'אוטומציה'
                      ? 'bg-amber-400'
                      : 'bg-slate-400'
                  // Date qualifier under the due time. Anything not due today is (by this
                  // list's filter) necessarily overdue from an earlier day — name the day
                  // so "13:50" never reads as today's; same-day-late shows just "באיחור".
                  const dueDateLabel = !dueToday
                    ? `${friendlyDate(t.due) === 'אתמול' ? 'אתמול' : shortDate(t.due)} · באיחור`
                    : overdue
                      ? 'באיחור'
                      : null
                  // Secondary line: for a no-show follow-up, the triggering appointment
                  // time — a past EVENT, prose-labelled so it never reads as a second
                  // deadline against the "עד" time; otherwise how long ago it opened.
                  const origin = t.sourceAt
                    ? `אי-הגעה לתור ${hhmm(t.sourceAt)}`
                    : t.createdAt
                      ? `נוצר ${relativeFromNow(t.createdAt)}`
                      : null
                  return (
                    <div
                      key={t.id}
                      className={clsxRow(overdue)}
                    >
                      <div className="text-center w-20 shrink-0">
                        <p className={`text-xs font-semibold tabular-nums ${overdue ? 'text-red-600' : 'text-slate-600'}`}>
                          עד {hhmm(t.due)}
                        </p>
                        {dueDateLabel && <p className="text-[10px] text-red-600">{dueDateLabel}</p>}
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
                      {/* Urgency and source are independent channels — a דחוף auto task
                          shows both badges (urgency above source), never one slot. */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {t.urgency === 'דחוף' && (
                          <Badge tone="red"><AlertTriangle size={11} /> דחוף</Badge>
                        )}
                        {t.source === 'אוטומציה' ? (
                          <Badge tone="purple">אוטומציה</Badge>
                        ) : (
                          <Badge tone="slate">ידני</Badge>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            {/* Beyond the preview cap → the full board (keeps this panel bounded-height
                so an overdue backlog can't flood the dashboard). */}
            {todayTasks.length > TASKS_PREVIEW && (
              <Link
                to="/clinic/tasks"
                className="w-full border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-teal-700 hover:bg-slate-50 transition flex items-center justify-center gap-1"
              >
                לכל המשימות ({todayTasks.length})
              </Link>
            )}
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
          {/* Count line shows ONLY when items are displayed; the "nothing left"
              state is the empty indicator below, never both at once. */}
          {visibleCount > 0 && (
            <div className="px-4 pt-2 pb-1.5 text-xs text-slate-600 border-b border-slate-100">
              {visibleCount === 1 ? 'נותר תור אחד להיום' : `נותרו ${visibleCount} תורים להיום`}
            </div>
          )}
          <div className="p-1.5 space-y-1">
            {todayGroups.length === 0 ? (
              <Empty
                icon={CalendarDays}
                title={todayAppts.length === 0 ? 'אין תורים היום' : 'לא נותרו תורים להיום'}
              />
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
                        // Resolved visits (completed or no-show) stay listed but muted
                        // (record, not "to-do").
                        const muted = a.status === 'הסתיים' || a.status === 'לא הגיע'
                        // Slot ended but still 'קבוע' — stays on the board with an amber
                        // "ממתין לעדכון" chip. This board is today-only, so a past-slot
                        // unmarked appointment is always "awaiting update" (it becomes
                        // "לא עודכן" only after midnight, once it's a prior day — off this board).
                        const pastUnmarked = isPastUnmarked(a, now)
                        return (
                          <div
                            key={a.id}
                            className={clsx(
                              'flex items-center gap-2',
                              i > 0 && 'mt-2 pt-2 border-t border-slate-100',
                              muted && 'opacity-60',
                            )}
                          >
                            <span className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: t?.color }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className={clsx('text-sm font-medium truncate', muted ? 'text-slate-500' : 'text-slate-800')}>{p?.name ?? 'מטופל/ת'}</p>
                                {pastUnmarked && (
                                  <Badge tone="amber" className="shrink-0">
                                    ממתין לעדכון
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 truncate">{a.visitType} · {t?.name ?? ''} · {a.durationMin} דק׳</p>
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

      {/* Desk launcher modals. */}
      {quickOpen && <QuickBookDialog onClose={() => setQuickOpen(false)} />}
      {escalateOpen && <EscalationDialog onClose={() => setEscalateOpen(false)} />}
    </div>
  )
}

// A toggle filter chip in the requests-board header (dark bar). Reads as an interactive
// tab/chip — outlined + hover when off, filled + an ✕ (clear) when on — not a static badge.
// A clickable column header for the requests table. Shows a neutral ArrowUpDown
// until it's the active sort column, then ArrowUp/ArrowDown by direction. The button
// spans the full column width (no horizontal padding/margin) so its label lines up
// exactly with the data cell below, and the hover teal wash fills the whole column.
function SortHeader({ colClass, label, sortKey, sort, onSort, leading }) {
  const active = sort.key === sortKey
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`מיין לפי ${label}`}
      title={`מיין לפי ${label}`}
      className={clsx(
        colClass,
        'group flex items-center py-0.5 rounded-md text-right font-semibold cursor-pointer select-none transition',
        'hover:bg-teal-50/60 hover:text-teal-700',
        active ? 'text-teal-700' : 'text-slate-600',
      )}
    >
      {leading}
      <span className="truncate">{label}</span>
      <Icon
        size={13}
        className={clsx('shrink-0 transition', active ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')}
      />
    </button>
  )
}

function FilterChip({ active, onClick, activeClass, title, icon, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full h-8 pr-3 pl-2.5 text-xs font-semibold ring-1 transition cursor-pointer select-none',
        active ? activeClass : 'bg-white/10 text-slate-100 ring-white/25 hover:bg-white/20 hover:ring-white/50',
      )}
    >
      {icon}
      <span className="whitespace-nowrap">{children}</span>
      {active && <X size={13} className="shrink-0 opacity-90" />}
    </button>
  )
}

// Task row layout; overdue rows get a soft red wash + red accent bar.
function clsxRow(overdue) {
  return [
    'flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100 last:border-0',
    overdue ? 'bg-red-50/60 border-r-2 border-red-500' : '',
  ].join(' ')
}
