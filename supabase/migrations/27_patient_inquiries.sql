-- MediTrack — Migration 27: patient inquiries (human hand-off, no AI).
-- The "לא בטוח/ה איזה טיפול מתאים?" path no longer runs the AI classifier. Instead the
-- patient picks a subject (an active service, or אדמיניסטרציה / אחר) + optional free text
-- and the inquiry is handed straight to the secretary. Reuses the requests table — an
-- inquiry is just a request with kind='inquiry' (no ai payload, no scheduling).
--   kind       : distinguishes an AI/booking request ('booking') from a human inquiry
--                ('inquiry'). Existing rows are all booking requests.
--   subject    : נושא הפנייה — the chosen service / topic (inquiry only).
--   staff_note : internal secretary note while working the inquiry (never shown to the
--                patient). Distinct from rejection_reason (which the patient DOES see).
-- Inquiry lifecycle uses two extra statuses next to the booking ones: a secretary marks
-- an inquiry 'נוצר קשר' (contacted) and finally 'סגור' (closed).

alter table public.requests
  add column kind       text not null default 'booking',
  add column subject    text,
  add column staff_note text;

alter table public.requests
  add constraint requests_kind_check check (kind in ('booking', 'inquiry'));

-- Widen the status domain to cover the inquiry lifecycle. Booking statuses are unchanged.
alter table public.requests drop constraint requests_status_check;
alter table public.requests
  add constraint requests_status_check
  check (status in ('ממתין', 'אושר', 'נדחה', 'נוצר קשר', 'סגור'));

-- Existing RLS already covers inquiries: req_insert_patient lets the patient create their
-- own request (no per-column restriction), and req_write_staff lets the secretary/manager
-- update status + staff_note. No policy changes needed.
