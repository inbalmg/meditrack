import { useState } from 'react'
import { X, Route, CalendarPlus, ChevronDown, Phone, User } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { Badge, Button } from './ui.jsx'
import ScheduleDialog from './ScheduleDialog.jsx'
import { relativeFromNow } from '../lib/format.js'
import { clsx } from './clsx.js'

// Shared column widths so the header row and every request row line up.
export const REQ_COLS = {
  patient: 'w-36 shrink-0',
  visitType: 'w-24 shrink-0',
  received: 'w-20 shrink-0',
  spacer: 'flex-1 min-w-4',
  action: 'w-44 shrink-0',
  chevron: 'w-8 shrink-0',
}

// One request rendered as a table row. The row expands to reveal the full
// details (age, phone, free text, AI routing/rationale/tags). The primary
// action opens the scheduling dialog; reject lives in the expanded panel.
export default function RequestRow({ request, canApprove = true }) {
  const { patientById, therapistById, approveRequest, rejectRequest } = useData()
  const [expanded, setExpanded] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const patient = patientById[request.patientId]
  const ai = request.ai
  const routed = therapistById[ai.routedTo]

  return (
    <div className="border-b border-slate-100 last:border-0">
      {/* Row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpanded((v) => !v)}
        className={clsx(
          'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition',
          expanded ? 'bg-teal-50/40' : 'hover:bg-slate-50',
        )}
      >
        {/* Patient */}
        <div className={clsx(REQ_COLS.patient, 'min-w-0')}>
          <span className="font-bold text-slate-800 truncate block">{patient.name}</span>
          {request.source && request.source !== 'פורטל' && (
            <Badge tone={request.source === 'טלפון' ? 'blue' : 'red'}>{request.source}</Badge>
          )}
        </div>
        {/* Visit type */}
        <div className={clsx(REQ_COLS.visitType, 'text-sm text-teal-700 truncate')}>{ai.visitType}</div>
        {/* Received */}
        <div className={clsx(REQ_COLS.received, 'text-xs text-slate-400 whitespace-nowrap')}>
          {relativeFromNow(request.createdAt)}
        </div>
        {/* Spacer */}
        <div className={REQ_COLS.spacer} />
        {/* Action */}
        <div className={REQ_COLS.action} onClick={(e) => e.stopPropagation()}>
          {canApprove ? (
            <Button size="sm" className="w-full" onClick={() => setScheduling(true)}>
              <CalendarPlus size={15} /> אישור וקביעת תור
            </Button>
          ) : (
            <span className="text-xs text-slate-400">צפייה בלבד</span>
          )}
        </div>
        {/* Expand chevron */}
        <div className={clsx(REQ_COLS.chevron, 'flex justify-center text-slate-400')}>
          <ChevronDown size={18} className={clsx('transition-transform', expanded && 'rotate-180')} />
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
              <p className="text-xs text-slate-400 mb-0.5">מלל הבקשה</p>
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
      {Icon && <Icon size={13} className="text-slate-400" />}
      <span className="text-slate-400">{label}:</span>
      <span className="font-medium text-slate-700">{children}</span>
    </span>
  )
}
