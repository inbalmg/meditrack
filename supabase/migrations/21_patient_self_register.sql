-- MediTrack — Migration 21: patient self-registration.
-- A new (unregistered) patient signs in with role='patient' but has no patients row yet,
-- so app.patient_id() (profile_id = auth.uid()) resolves to NULL and BOTH the patient
-- self-insert (no policy) and the follow-up appointment/request insert (patient_id =
-- app.patient_id()) were rejected by RLS. This lets a patient create their OWN record on
-- first self-booking; once it commits, app.patient_id() resolves and the existing
-- appt_insert_patient / req_insert_patient policies take over unchanged.
--
-- Scoped tightly: only role='patient', only in their own clinic, and only a row linked
-- to THEMSELVES (profile_id = auth.uid()) — they cannot create records for anyone else.
-- Staff-created phone-book patients keep going through patients_write_staff (profile_id
-- stays NULL there). The frontend stamps profile_id only for the self-registering caller.

create policy patients_insert_self on public.patients for insert to authenticated
  with check (
    app.jwt_role() = 'patient'
    and clinic_id = app.clinic_id()
    and profile_id = auth.uid()
  );

-- One patient record per login. Enforces self-registration idempotence at the DB (a
-- duplicate self-insert fails cleanly) without a self-referential check in the policy.
-- Partial (profile_id is not null) so the many phone-book rows with NULL profile_id are
-- unaffected.
create unique index if not exists patients_profile_unique
  on public.patients (profile_id) where profile_id is not null;
