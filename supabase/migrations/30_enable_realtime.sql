-- MediTrack — Migration 30: enable Supabase Realtime for cross-device live sync.
-- Problem: store.jsx hydrates a local mirror once at login and only patches it from the
-- SAME tab's own writes, so a row written by another device/session (e.g. a patient's
-- appointment request from mobile) never reaches an already-open clinic dashboard until a
-- manual refresh. Fix: broadcast row changes on the three shared, session-mutated tables so
-- every client can patch its mirror live.
--
-- Scope: requests + appointments + tasks (the request queue, the calendar, and the task
-- board). Rarely-changing config (therapists/treatments/patients/settings) is intentionally
-- left out — it can be added to the same publication later if needed.
--
-- Security: Realtime reuses the existing per-table SELECT RLS policies (see 04_rls.sql) — a
-- client only receives changes to rows it is already allowed to read (patient → own rows,
-- therapist → own/treated rows, secretary/manager → their clinic). No new policies needed.
-- `replica identity full` ships the OLD row image on UPDATE/DELETE so RLS can evaluate those
-- events correctly (INSERT already carries the full new row).

alter publication supabase_realtime add table public.requests;
alter publication supabase_realtime add table public.appointments;
alter publication supabase_realtime add table public.tasks;

alter table public.requests     replica identity full;
alter table public.appointments replica identity full;
alter table public.tasks        replica identity full;
