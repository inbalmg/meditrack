-- MediTrack — Migration 13: patient visit history in the therapist's patient profile.
-- Two changes back the "Visit History" view (VisitCard):
--
-- 1) appointments.clinical_note — the clinical note / visit summary surfaced per past
--    visit so a therapist can scan prior clinical context before/during a session.
--
-- 2) A therapist may READ the FULL appointment history of any patient they treat, not
--    only their own appointments — the profile must show cross-provider context (a
--    patient often sees several providers). This mirrors patients_select_therapist
--    (a therapist already sees patients they treat, gated by app.therapist_treats_patient).
--    RLS stays the enforcement layer; the therapist's own Day/Calendar screens still
--    filter to therapist_id = self in the UI, so this only widens the profile history.

alter table public.appointments
  add column if not exists clinical_note text;

create policy appt_select_therapist_patient on public.appointments for select to authenticated
  using (app.jwt_role() = 'therapist' and app.therapist_treats_patient(patient_id));
