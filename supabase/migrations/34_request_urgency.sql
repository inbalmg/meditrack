-- MediTrack — Migration 34: request urgency (secretary-opened requests-to-treat).
-- "פתיחת בקשה" now creates a REQUEST that lands in the secretary's queue (not a task):
-- the secretary logs patient + category (→ subject) + detail (→ description) + an optional
-- urgency. Category reuses the existing `subject` column; urgency needs a column of its own,
-- reusing the same Hebrew vocabulary as tasks.urgency (migration 32).
alter table public.requests add column if not exists urgency text;

alter table public.requests drop constraint if exists requests_urgency_check;
alter table public.requests
  add constraint requests_urgency_check
  check (urgency is null or urgency in ('רגיל','בהקדם','דחוף'));
