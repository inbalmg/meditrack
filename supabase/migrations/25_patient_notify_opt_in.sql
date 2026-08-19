-- MediTrack — Migration 25: patient notification opt-in (consent preference).
-- Collected in the new-patient onboarding form ("קבלת התראות ב-SMS/אימייל") as an
-- OPTIONAL checkbox. The phone stays the mandatory reminder channel; this flag records
-- whether the patient consents to receive appointment notifications at all. Additive,
-- defaults to true so existing rows keep receiving reminders. NOT NULL — every patient
-- carries an explicit boolean. The privacy/terms consent is a UI gate (must be accepted
-- to register) and is not stored here.
alter table public.patients
  add column notify_opt_in boolean not null default true;
