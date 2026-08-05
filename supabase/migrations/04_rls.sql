-- MediTrack — Migration 04: Row-Level Security (the primary enforcement layer).
-- Two immutable JWT app_metadata claims drive every policy: clinic_id (tenant gate)
-- and role. Ownership helpers map auth.uid() -> patient/therapist row. service_role
-- (Edge Functions / automations) bypasses RLS. anon has no policies -> no access.
-- Frontend route guards remain UX only.

-- ------------------------------------------------------------------ helpers ----
create schema if not exists app;
grant usage on schema app to authenticated;

-- Tenant + role from the JWT (no table lookup). NULL when unauthenticated -> deny.
create or replace function app.clinic_id() returns uuid
  language sql stable set search_path = '' as
$$ select nullif(auth.jwt() -> 'app_metadata' ->> 'clinic_id', '')::uuid $$;

create or replace function app.jwt_role() returns text
  language sql stable set search_path = '' as
$$ select auth.jwt() -> 'app_metadata' ->> 'role' $$;

-- Ownership maps (SECURITY DEFINER: bypass RLS to resolve the caller's own row).
create or replace function app.patient_id() returns uuid
  language sql stable security definer set search_path = '' as
$$ select id from public.patients where profile_id = auth.uid() limit 1 $$;

create or replace function app.therapist_id() returns uuid
  language sql stable security definer set search_path = '' as
$$ select id from public.therapists where profile_id = auth.uid() limit 1 $$;

-- Therapist sees a patient only if they have (had) an appointment together.
create or replace function app.therapist_treats_patient(p_patient uuid) returns boolean
  language sql stable security definer set search_path = '' as
$$ select exists (
     select 1 from public.appointments a
     where a.patient_id = p_patient and a.therapist_id = app.therapist_id()
   ) $$;

grant execute on function
  app.clinic_id(), app.jwt_role(), app.patient_id(),
  app.therapist_id(), app.therapist_treats_patient(uuid)
  to authenticated;

-- ------------------------------------------------------------------ clinics ----
alter table public.clinics enable row level security;
create policy clinics_select_staff on public.clinics for select to authenticated
  using (id = app.clinic_id() and app.jwt_role() in ('secretary','manager','therapist'));
create policy clinics_update_admin on public.clinics for update to authenticated
  using      (id = app.clinic_id() and app.jwt_role() in ('secretary','manager'))
  with check (id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));

-- ----------------------------------------------------------------- profiles ----
alter table public.profiles enable row level security;
-- Read own profile; staff read profiles in their clinic. Writes are server-side only.
create policy profiles_select_self_or_staff on public.profiles for select to authenticated
  using (id = auth.uid()
    or (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager')));

-- --------------------------------------------------------------- therapists ----
alter table public.therapists enable row level security;
create policy therapists_select_clinic on public.therapists for select to authenticated
  using (clinic_id = app.clinic_id()); -- all roles read (booking flow)
create policy therapists_write_admin on public.therapists for all to authenticated
  using      (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'))
  with check (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));

-- --------------------------------------------------------------- treatments ----
alter table public.treatments enable row level security;
create policy treatments_select_clinic on public.treatments for select to authenticated
  using (clinic_id = app.clinic_id());
create policy treatments_write_admin on public.treatments for all to authenticated
  using      (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'))
  with check (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));

-- ------------------------------------------------------ treatment_providers ----
alter table public.treatment_providers enable row level security;
create policy tp_select_clinic on public.treatment_providers for select to authenticated
  using (clinic_id = app.clinic_id());
create policy tp_write_admin on public.treatment_providers for all to authenticated
  using      (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'))
  with check (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));

-- ----------------------------------------------------------------- patients ----
alter table public.patients enable row level security;
create policy patients_select_self on public.patients for select to authenticated
  using (app.jwt_role() = 'patient' and id = app.patient_id());
create policy patients_select_staff on public.patients for select to authenticated
  using (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));
create policy patients_select_therapist on public.patients for select to authenticated
  using (clinic_id = app.clinic_id() and app.jwt_role() = 'therapist'
    and app.therapist_treats_patient(id));
create policy patients_update_self on public.patients for update to authenticated
  using      (app.jwt_role() = 'patient' and id = app.patient_id())
  with check (app.jwt_role() = 'patient' and id = app.patient_id());
create policy patients_write_staff on public.patients for all to authenticated
  using      (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'))
  with check (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));

-- ------------------------------------------------------------- appointments ----
alter table public.appointments enable row level security;
-- reads: patient (own) / therapist (own calendar) / staff (clinic-wide)
create policy appt_select_patient on public.appointments for select to authenticated
  using (app.jwt_role() = 'patient' and patient_id = app.patient_id());
create policy appt_select_therapist on public.appointments for select to authenticated
  using (app.jwt_role() = 'therapist' and therapist_id = app.therapist_id());
create policy appt_select_staff on public.appointments for select to authenticated
  using (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));
-- patient self-book: only for self, only confirmed ('קבוע')
create policy appt_insert_patient on public.appointments for insert to authenticated
  with check (app.jwt_role() = 'patient' and patient_id = app.patient_id()
    and clinic_id = app.clinic_id() and status = 'קבוע');
create policy appt_insert_staff on public.appointments for insert to authenticated
  with check (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));
-- patient cancel/reschedule own; staff manage all (check-in/out, status)
create policy appt_update_patient on public.appointments for update to authenticated
  using      (app.jwt_role() = 'patient' and patient_id = app.patient_id())
  with check (app.jwt_role() = 'patient' and patient_id = app.patient_id());
create policy appt_delete_patient on public.appointments for delete to authenticated
  using (app.jwt_role() = 'patient' and patient_id = app.patient_id());
create policy appt_update_staff on public.appointments for update to authenticated
  using      (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'))
  with check (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));
create policy appt_delete_staff on public.appointments for delete to authenticated
  using (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));

-- ----------------------------------------------------------------- requests ----
alter table public.requests enable row level security;
create policy req_select_patient on public.requests for select to authenticated
  using (app.jwt_role() = 'patient' and patient_id = app.patient_id());
create policy req_select_therapist on public.requests for select to authenticated
  using (app.jwt_role() = 'therapist' and preferred_therapist_id = app.therapist_id());
create policy req_select_staff on public.requests for select to authenticated
  using (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));
create policy req_insert_patient on public.requests for insert to authenticated
  with check (app.jwt_role() = 'patient' and patient_id = app.patient_id()
    and clinic_id = app.clinic_id());
create policy req_write_staff on public.requests for all to authenticated
  using      (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'))
  with check (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));

-- -------------------------------------------------------------------- tasks ----
alter table public.tasks enable row level security;
-- No patient access at all (no policy). Therapist reads own; staff full.
create policy tasks_select_therapist on public.tasks for select to authenticated
  using (app.jwt_role() = 'therapist' and assignee_id = app.therapist_id());
create policy tasks_select_staff on public.tasks for select to authenticated
  using (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));
create policy tasks_write_staff on public.tasks for all to authenticated
  using      (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'))
  with check (clinic_id = app.clinic_id() and app.jwt_role() in ('secretary','manager'));

-- Reports: no table yet. When added, expose as a manager-only VIEW/RPC guarded by
-- app.jwt_role() = 'manager' (secretary is clinic-wide but NOT reports).
