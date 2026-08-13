-- MediTrack — Migration 19: required request fields.
--   patient_id : NOT NULL — every request is created after a patient record exists
--                (commitContact → addPatient, then submitRequest/bookAppointment).
--                MediTrack has no anonymous-lead intake path.
--   source     : NOT NULL + default + CHECK, mirroring tasks.source. Until now
--                requests.source was plain text (no default, no CHECK) — the only
--                one of the three source columns weaker than appointments/tasks.
-- Backfill any legacy NULL/invalid source to the canonical fallback first so the
-- NOT NULL + CHECK can apply to existing rows.

update public.requests set source = 'פורטל'
  where source is null
     or source not in ('הזמנה עצמית', 'הפניה דחופה', 'טלפון', 'פורטל');

alter table public.requests
  alter column source set default 'פורטל',
  alter column source set not null,
  alter column patient_id set not null;

alter table public.requests
  add constraint requests_source_check
  check (source in ('הזמנה עצמית', 'הפניה דחופה', 'טלפון', 'פורטל'));
