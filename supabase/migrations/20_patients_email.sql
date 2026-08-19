-- MediTrack — Migration 20: optional patient email (secondary notification channel).
-- Phone stays the mandatory contact/reminder channel (NOT NULL, migration 18); email is
-- OPTIONAL so patients without an address (children, elderly) are never blocked. The
-- column is nullable and a CHECK validates the format ONLY when a value is present
-- (NULL passes a CHECK automatically). Same pattern as the constraints in migration 18.
-- Keep in sync with lib/validation.js → emailValid().

alter table public.patients add column if not exists email text;

alter table public.patients
  add constraint patients_email_check
  check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
