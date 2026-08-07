import { useState } from 'react'
import { X, Route, ChevronDown, ChevronUp, Phone, User } from 'lucide-react'
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
  const { patientById, therapistById, approveRequest, rejectRequest } = useData()
  const [expanded, setExpanded] = useState(false)
  const [scheduling, setScheduling] = useState(false)
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
              טפל בבקשה
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
              <div className="flex justify-end">
                <Button size="sm" variant="danger" onClick={() => rejectRequest(request.id)}>
                  <X size={15} /> דחיית הבקשה
                </Button>
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

function Detail({ icon: Icon, label, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {Icon && <Icon size={13} className="text-slate-500" />}
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-slate-700">{children}</span>
    </span>
  )
}
