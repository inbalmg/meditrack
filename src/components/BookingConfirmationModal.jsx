import { createPortal } from 'react-dom'
import { Check, CalendarCheck, Send, Mail } from 'lucide-react'
import { useData } from '../data/store.jsx'
import { Card, Button } from './ui.jsx'
import { dayName, shortDate, hhmm } from '../lib/format.js'

// Booking-success modal shown after the secretary approves a phone/AI request — the same
// confirmation a patient gets on self-booking (NewRequest's "התור נקבע!" screen), plus a
// line summarizing which confirmation channels were sent. Driven by store.bookingConfirmation
// and rendered from ClinicLayout so it survives the approved request's row unmounting.
// Portaled to <body> and top-aligned, consistent with the other clinic dialogs.
export default function BookingConfirmationModal() {
  const { bookingConfirmation, clearBookingConfirmation } = useData()
  if (!bookingConfirmation) return null

  const { appointment: appt, patientName, phone, email, therapistName, specialty, notifiedSms, notifiedEmail } = bookingConfirmation

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center items-start p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={clearBookingConfirmation}
    >
      <div className="w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <Card className="p-6 text-center">
          <span className="grid place-items-center h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto mb-4">
            <Check size={32} />
          </span>
          <h2 className="text-xl font-bold text-slate-800">התור נקבע!</h2>
          <p className="text-slate-500 mt-1 text-sm">שוריין מקום ביומן עבור {patientName}.</p>
          {(notifiedSms || notifiedEmail) && (
            <div className="mt-3 flex flex-col items-center gap-1 text-xs text-slate-500">
              {notifiedSms && (
                <span className="flex items-center gap-1.5">
                  <Send size={13} className="text-teal-600" /> נשלחה הודעת אישור בוואטסאפ/SMS ל־{phone}
                </span>
              )}
              {notifiedEmail && (
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-teal-600" /> נשלחה הודעת אישור במייל ל־{email}
                </span>
              )}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <dl className="space-y-2.5 text-sm">
            <Row label="מטופל/ת"><span className="font-medium text-slate-700">{patientName}</span></Row>
            <Row label="טיפול"><span className="font-medium text-slate-700">{appt.visitType}</span></Row>
            <Row label="מטפל/ת"><span className="font-medium text-slate-700">{therapistName}{specialty ? ` · ${specialty}` : ''}</span></Row>
            <Row label="מועד"><span className="font-medium text-slate-700">יום {dayName(appt.start)} {shortDate(appt.start)} · {hhmm(appt.start)}</span></Row>
            <Row label="משך"><span className="font-medium text-slate-700">{appt.durationMin} דק׳</span></Row>
          </dl>
        </Card>
        <Button size="lg" className="w-full" onClick={clearBookingConfirmation}>
          <CalendarCheck size={18} /> סגירה
        </Button>
      </div>
    </div>,
    document.body,
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
