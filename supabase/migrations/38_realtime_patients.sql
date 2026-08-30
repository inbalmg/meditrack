-- MediTrack — Migration 38: add patients to Supabase Realtime.
-- Problem: migration 30 broadcasts requests/appointments/tasks (and 37 added slot_blocks) but
-- intentionally left patients out. That opened a gap: when a BRAND-NEW patient self-registers on
-- one device and immediately books, their appointment row streams live to every open clinic
-- client — but the matching patients row does not. The receiving client then holds an appointment
-- that references a patient it has never loaded, so the calendar/dashboard rendered a name lookup
-- that resolved to undefined and white-screened until a manual refresh re-hydrated patients.
-- (The render sites are now also null-safe as defense-in-depth; this migration closes the gap at
-- the source so the real name shows live, without a refresh.)
--
-- Security: Realtime reuses the existing per-table SELECT RLS on patients (see 04_rls.sql / 21) —
-- a client only receives patient rows it may already read (secretary/manager → their clinic;
-- a patient → their own row). No new policies. `replica identity full` ships the OLD row image on
-- UPDATE/DELETE so RLS can evaluate those events (INSERT already carries the full new row).

alter publication supabase_realtime add table public.patients;

alter table public.patients replica identity full;
