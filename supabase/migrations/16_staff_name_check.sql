-- MediTrack — Migration 16: staff.name value constraint.
-- Until now staff.name was NOT NULL only, so a whitespace-only or arbitrarily long
-- name could be persisted. Add a data-quality CHECK on the trimmed length (2..80).
-- RLS remains the enforcement layer for WHO may write (secretary/manager, in-clinic);
-- this constrains the VALUE itself. Mirrors the client rules in src/lib/validation.js.

alter table public.staff
  add constraint staff_name_len
  check (char_length(btrim(name)) between 2 and 80);
