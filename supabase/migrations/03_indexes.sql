-- MediTrack — Migration 03: indexes (query-driven + FK coverage).

-- Composite indexes for the hot read paths.
create index idx_appt_clinic_therapist_start on public.appointments(clinic_id, therapist_id, start); -- calendar/day views, therapist scope
create index idx_appt_clinic_patient_start  on public.appointments(clinic_id, patient_id, start);   -- patient "My Appointments"
create index idx_appt_clinic_status_start   on public.appointments(clinic_id, status, start);       -- reports (no-show rate, throughput)
create index idx_requests_clinic_status_created on public.requests(clinic_id, status, created_at desc); -- secretary exceptions queue
create index idx_tasks_clinic_assignee_status_due on public.tasks(clinic_id, assignee_id, status, due); -- task board / overdue

-- Join-table lookups (booking flow: which treatments a provider offers, and vice versa).
create index idx_tp_therapist on public.treatment_providers(therapist_id);
create index idx_tp_treatment on public.treatment_providers(treatment_id);

-- Foreign-key coverage (avoids seq scans on cascade/joins; satisfies the FK-index advisor).
create index idx_appt_treatment              on public.appointments(treatment_id);
create index idx_requests_patient            on public.requests(patient_id);
create index idx_requests_preferred_therapist on public.requests(preferred_therapist_id);
create index idx_requests_appointment        on public.requests(appointment_id);
create index idx_tasks_patient               on public.tasks(patient_id);
create index idx_tasks_assignee              on public.tasks(assignee_id);
create index idx_therapists_profile          on public.therapists(profile_id);
create index idx_patients_profile            on public.patients(profile_id);
create index idx_therapists_clinic           on public.therapists(clinic_id);
create index idx_treatments_clinic           on public.treatments(clinic_id);
create index idx_patients_clinic             on public.patients(clinic_id);
