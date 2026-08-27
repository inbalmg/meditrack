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
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5 text-sm">
            <Row label="מטופל/ת">{patientName}</Row>
            <Row label="טיפול">{appt.visitType}</Row>
            <Row label="מטפל/ת">{therapistName}{specialty ? ` · ${specialty}` : ''}</Row>
            <Row label="מועד">יום {dayName(appt.start)} {shortDate(appt.start)} · {hhmm(appt.start)}</Row>
            <Row label="משך">{appt.durationMin} דק׳</Row>
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

// One row of the two-column summary grid: `dt`/`dd` are direct grid children so
// the label column auto-sizes and every value column starts on the same line.
function Row({ label, children }) {
  return (
    <>
      <dt className="text-slate-500 whitespace-nowrap">{label}:</dt>
      <dd className="font-medium text-slate-700">{children}</dd>
    </>
  )
}
