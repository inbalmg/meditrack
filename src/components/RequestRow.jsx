import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Phone, User, Mail, ListPlus, Check, AlertTriangle } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { Badge, Button } from './ui.jsx'
import { relativeFromNow } from '../lib/format.js'
import { clsx } from './clsx.js'

// Shared column widths so the header row and every request row line up.
// Column order (RTL, right→left): patient · received · subject · action · chevron.
export const REQ_COLS = {
  patient: 'w-32 shrink-0',
  received: 'w-20 shrink-0',
  visitType: 'flex-1 min-w-0',
  action: 'w-36 shrink-0',
  chevron: 'w-6 shrink-0',
}

// The requests queue now holds ONLY human inquiries (kind='inquiry') from the patient
// portal ("לא בטוח/ה איזה טיפול מתאים?"). Phone calls are handled directly by the desk
// (Direct Booking / Escalation), never through this queue, so there's no AI booking row
// anymore — every request renders as an InquiryRow.
export default function RequestRow({ request, canApprove = true, unread = false, onOpen }) {
  return <InquiryRow request={request} canApprove={canApprove} unread={unread} onOpen={onOpen} />
}

// A human inquiry in the secretary queue. The row expands to the patient's details + the
// free-text inquiry + an internal note. It's resolved via two mutually-exclusive terminal
// paths (no scheduling): DIRECT CLOSE ('סמן כטופל' → 'סגור', no task) or CONVERT TO TASK
// ('הפוך למשימה' → creates a 'בטיפול' task and marks the request 'הומר למשימה'). Both
// drop it off the active board.
function InquiryRow({ request, canApprove = true, unread = false, onOpen }) {
  const { patientById, updateInquiry, convertInquiryToTask } = useData()
  const [expanded, setExpanded] = useState(false)
  const patient = patientById[request.patientId]
  const fromPortal = request.source === 'פורטל'
  const urgent = request.urgency === 'דחוף'

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
          // Minimalist look: a uniform white background for every row (read/unread is conveyed by
          // typography alone — see the name/subject below). Hover = brand teal wash + soft shadow.
          expanded ? 'bg-teal-50/40' : 'bg-white hover:bg-teal-50/50 hover:shadow-sm',
        )}
      >
        {/* Patient */}
        <div className={clsx(REQ_COLS.patient, 'flex items-center gap-2')}>
          {/* Dedicated fixed-width urgency-indicator column at the row's right edge (RTL leading
              slot): a red triangle + native "דחוף" tooltip on urgent rows, an empty placeholder
              otherwise, so every patient name stays aligned to the same right line. */}
          <span className="w-4 shrink-0 flex justify-center">
            {urgent && (
              <span title="דחוף" className="inline-flex">
                <AlertTriangle size={14} className="text-red-500" />
              </span>
            )}
          </span>
          {/* Name (line 1) + status badge (line 2), both aligned to one right edge, left of the
              indicator column. Read/unread is conveyed by TYPOGRAPHY only: unread = bold + dark;
              read = normal weight + soft grey, so handled rows visibly recede on the white table. */}
          <div className="min-w-0 flex flex-col items-start gap-0.5">
            <span className={clsx('truncate block max-w-full', unread ? 'font-semibold text-slate-900' : 'font-normal text-slate-600')}>
              {patient.name}
            </span>
            <Badge tone={fromPortal ? 'teal' : 'blue'}>{fromPortal ? 'פנייה מהפורטל' : 'נפתחה במשרד'}</Badge>
          </div>
        </div>
        {/* Received — slightly stronger on unread so it separates from a read row without
            competing with the patient name. */}
        <div className={clsx(REQ_COLS.received, 'text-xs whitespace-nowrap', unread ? 'text-slate-800' : 'text-slate-500')}>
          {relativeFromNow(request.createdAt)}
        </div>
        {/* Subject */}
        <div className={clsx(REQ_COLS.visitType, 'text-sm truncate', unread ? 'font-semibold text-slate-900' : 'font-normal text-slate-600')}>
          {request.subject}
        </div>
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
        {/* Expand chevron — mr-3 adds breathing room from the "טפל בבקשה" action button. */}
        <div className={clsx(REQ_COLS.chevron, 'flex justify-center mr-3', expanded ? 'text-teal-700' : 'text-slate-400')}>
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
