-- MediTrack — Migration 17: soft-archive for therapists (IsActive).
-- A departing provider must disappear from active booking / calendar / provider
-- pickers WITHOUT being deleted: appointments.therapist_id is ON DELETE RESTRICT and
-- the clinical history must be preserved. Same pattern as treatments.active.
-- Existing rows default to active = true, so nothing changes for current providers.

alter table public.therapists
  add column if not exists active boolean not null default true;
