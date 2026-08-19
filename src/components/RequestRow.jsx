import { useEffect, useRef, useState } from 'react'
import { X, Route, ChevronDown, ChevronUp, Phone, User, Mail, ListPlus, Check } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { Badge, Button } from './ui.jsx'
import ScheduleDialog from './ScheduleDialog.jsx'
import { relativeFromNow } from '../lib/format.js'
import { clsx } from './clsx.js'

// Shared column widths so the header row and every request row line up.
// Column order (RTL, right→left): patient · received · visitType · action · chevron.
// "received" sits by the patient on the right; visitType flexes to fill the middle;
// the action column is widened so "טפל בבקשה" reads as the primary, easy-to-hit CTA.
export const REQ_COLS = {
  patient: 'w-32 shrink-0',
  received: 'w-20 shrink-0',
  visitType: 'flex-1 min-w-0',
  action: 'w-36 shrink-0',
  chevron: 'w-6 shrink-0',
}

// One request rendered as a table row. The row is an accordion: it expands to
// reveal the full details (age, phone, free text, AI routing/rationale/tags),
// and expanding marks it read (via onOpen). The primary action opens the
// scheduling dialog; reject lives in the expanded panel. `unread` drives the
// bold + blue-dot "new" treatment; `ai.urgentFlag` escalates urgent referrals.
export default function RequestRow({ request, canApprove = true, unread = false, onOpen }) {
  // Human inquiries (kind==='inquiry') carry no AI/scheduling — they get a dedicated
  // row with a contact/close lifecycle and an internal note, not the booking flow.
  if (request.kind === 'inquiry') {
    return <InquiryRow request={request} canApprove={canApprove} unread={unread} onOpen={onOpen} />
  }
  return <BookingRow request={request} canApprove={canApprove} unread={unread} onOpen={onOpen} />
}

function BookingRow({ request, canApprove = true, unread = false, onOpen }) {
  const { patientById, therapistById, approveRequest, rejectRequest } = useData()
  const [expanded, setExpanded] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  // Optional note the patient sees on their dashboard when the request is rejected.
  const [rejectReason, setRejectReason] = useState('')
  const patient = patientById[request.patientId]
  const ai = request.ai
  const routed = therapistById[ai.routedTo]
  const urgent = !!ai.urgentFlag

  function toggle() {
    setExpanded((v) => {
      if (!v && onOpen) onOpen(request.id) // opening → mark read
      return !v
    })
  }

  return (
    <div className="border-b border-slate-100 last:border-0">
      {/* Row */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle()}
        className={clsx(
          'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition',
          urgent && 'border-r-2 border-red-500',
          expanded ? 'bg-teal-50/40' : urgent ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50',
        )}
      >
        {/* Patient */}
        <div className={clsx(REQ_COLS.patient, 'flex items-center gap-2')}>
          <span className={clsx('h-2 w-2 rounded-full shrink-0', unread ? 'bg-blue-600' : 'bg-transparent')} />
          <div className="min-w-0">
            <span className={clsx('truncate block', unread ? 'font-semibold text-slate-800' : 'font-normal text-slate-600')}>
              {patient.name}
            </span>
            {request.source && request.source !== 'פורטל' && (
              <Badge tone={request.source === 'טלפון' ? 'blue' : 'red'}>
                {request.source}
              </Badge>
            )}
          </div>
        </div>
        {/* Received — moved right, next to the patient */}
        <div className={clsx(REQ_COLS.received, 'text-xs text-slate-600 whitespace-nowrap')}>
          {relativeFromNow(request.createdAt)}
        </div>
        {/* Visit type */}
        <div className={clsx(REQ_COLS.visitType, 'text-sm text-teal-700 whitespace-nowrap')}>{ai.visitType}</div>
        {/* Action */}
        <div className={REQ_COLS.action} onClick={(e) => e.stopPropagation()}>
          {canApprove ? (
            <Button size="sm" variant="primary" className="w-full" onClick={() => setScheduling(true)}>
              {/* Phone-sourced requests show a phone icon (right of the text in RTL); others text-only. */}
              {request.source === 'טלפון' && <Phone size={14} />} טפל בבקשה
            </Button>
          ) : (
            <span className="text-xs text-slate-500">צפייה בלבד</span>
          )}
        </div>
        {/* Expand chevron */}
        <div className={clsx(REQ_COLS.chevron, 'flex justify-center', expanded ? 'text-teal-700' : 'text-slate-400')}>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-4 pt-1 animate-fade">
          <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 p-4 space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
              <Detail icon={User} label="גיל">{patient.age}</Detail>
              <Detail icon={Phone} label="טלפון">{patient.phone}</Detail>
              <Detail label="חלון מועדף">{request.preferredTime}</Detail>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-0.5">מלל הבקשה</p>
              <p className="text-sm text-slate-700 leading-relaxed">"{request.description}"</p>
            </div>

            <div className="rounded-lg bg-teal-50/70 ring-1 ring-teal-100 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <Route size={13} /> ניתוב: <span className="font-medium text-slate-800">{routed.name}</span>
                </span>
                {ai.tags.map((t) => <Badge key={t} tone="slate">{t}</Badge>)}
              </div>
            </div>

            {canApprove && (
              <div className="space-y-3">
                <StaffNote requestId={request.id} initialNote={request.staffNote} />
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">סיבת דחייה <span className="text-slate-400">(רשות — תוצג למטופל)</span></label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                      placeholder="לדוגמה: אין זמינות בשבועיים הקרובים — נא לפנות טלפונית"
                      className="w-full rounded-lg ring-1 ring-slate-200 p-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none leading-relaxed"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="danger" onClick={() => rejectRequest(request.id, rejectReason)}>
                      <X size={15} /> דחיית הבקשה
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {scheduling && (
        <ScheduleDialog
          request={request}
          onClose={() => setScheduling(false)}
          onConfirm={(slot) => approveRequest(request.id, slot)}
        />
      )}
    </div>
  )
}

// A human inquiry (kind==='inquiry') in the secretary queue. Same column layout as a
// booking request, but the row expands to the patient's details + the free-text inquiry
// + an internal note. It's resolved via two mutually-exclusive terminal paths (no
// scheduling): DIRECT CLOSE ('סמן כטופל' → 'סגור', no task) or CONVERT TO TASK
// ('הפוך למשימה' → creates a 'בטיפול' task and marks the request 'הומר למשימה'). Both
// drop it off the active board.
function InquiryRow({ request, canApprove = true, unread = false, onOpen }) {
  const { patientById, updateInquiry, convertInquiryToTask } = useData()
  const [expanded, setExpanded] = useState(false)
  const patient = patientById[request.patientId]

  function toggle() {
    setExpanded((v) => {
      if (!v && onOpen) onOpen(request.id) // opening → mark read
      return !v
    })
  }
  // Open (never collapse) — used by the inline "טפל בבקשה" CTA so it always reveals
  // the resolution actions, matching a booking row's inline primary button.
  function open() {
    if (!expanded && onOpen) onOpen(request.id)
    setExpanded(true)
  }

  return (
    <div className="border-b border-slate-100 last:border-0">
      {/* Row */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle()}
        className={clsx(
          'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition',
          expanded ? 'bg-teal-50/40' : 'hover:bg-slate-50',
        )}
      >
        {/* Patient */}
        <div className={clsx(REQ_COLS.patient, 'flex items-center gap-2')}>
          <span className={clsx('h-2 w-2 rounded-full shrink-0', unread ? 'bg-blue-600' : 'bg-transparent')} />
          <div className="min-w-0">
            <span className={clsx('truncate block', unread ? 'font-semibold text-slate-800' : 'font-normal text-slate-600')}>
              {patient.name}
            </span>
            <Badge tone="teal">פנייה מהפורטל</Badge>
          </div>
        </div>
        {/* Received */}
        <div className={clsx(REQ_COLS.received, 'text-xs text-slate-600 whitespace-nowrap')}>
          {relativeFromNow(request.createdAt)}
        </div>
        {/* Subject (in the visit-type column) */}
        <div className={clsx(REQ_COLS.visitType, 'text-sm text-slate-700 truncate')}>{request.subject}</div>
        {/* Action */}
        <div className={REQ_COLS.action} onClick={(e) => e.stopPropagation()}>
          {!canApprove ? (
            <span className="text-xs text-slate-500">צפייה בלבד</span>
          ) : (
            <Button size="sm" variant="primary" className="w-full" onClick={open}>
              טפל בבקשה
            </Button>
          )}
        </div>
        {/* Expand chevron */}
        <div className={clsx(REQ_COLS.chevron, 'flex justify-center', expanded ? 'text-teal-700' : 'text-slate-400')}>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-4 pt-1 animate-fade">
          <div className="rounded-xl bg-slate-50 ring-1 ring-slate-100 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
              <Detail icon={User} label="גיל">{patient.age}</Detail>
              <Detail icon={Phone} label="טלפון">{patient.phone}</Detail>
              {patient.email && <Detail icon={Mail} label="אימייל">{patient.email}</Detail>}
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-0.5">נושא הפנייה</p>
              <p className="text-sm font-medium text-slate-800">{request.subject}</p>
            </div>

            {request.description?.trim() && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">פירוט המטופל/ת</p>
                <p className="text-sm text-slate-700 leading-relaxed">"{request.description}"</p>
              </div>
            )}

            {canApprove && (
              <div className="space-y-3">
                <StaffNote requestId={request.id} initialNote={request.staffNote} />

                {/* Two mutually-exclusive resolution paths — both remove the inquiry from the board. */}
                <div className="flex gap-2 pt-2 border-t border-slate-200">
                  <Button size="sm" variant="tealOutline" className="flex-1" onClick={() => updateInquiry(request.id, { status: 'סגור' })}>
                    <Check size={15} /> סמן כטופל
                  </Button>
                  <Button size="sm" variant="primary" className="flex-1" onClick={() => convertInquiryToTask(request.id)}>
                    <ListPlus size={15} /> הפוך למשימה
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Staff-only internal note on a request, shared by both row types. Auto-saves (debounced)
// as the secretary types — no manual save button and no placeholder/example text. Also
// flushes on blur so a note isn't lost if the row collapses right after typing.
function StaffNote({ requestId, initialNote }) {
  const { updateRequestNote } = useData()
  const [note, setNote] = useState(initialNote ?? '')
  const savedRef = useRef((initialNote ?? '').trim())

  function flush(value) {
    const next = (value ?? '').trim()
    if (next === savedRef.current) return
    savedRef.current = next
    updateRequestNote(requestId, next || null)
  }

  // Debounced auto-save ~700ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => flush(note), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note])

  return (
    <div>
      <label className="text-xs text-slate-500 mb-1 block">
        הערה פנימית <span className="text-slate-400">(לא נראית למטופל/ת · נשמרת אוטומטית)</span>
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => flush(note)}
        rows={2}
        className="w-full rounded-lg ring-1 ring-slate-200 p-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none leading-relaxed"
      />
    </div>
  )
}

function Detail({ icon: Icon, label, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {Icon && <Icon size={13} className="text-slate-500" />}
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-slate-700">{children}</span>
    </span>
  )
}
