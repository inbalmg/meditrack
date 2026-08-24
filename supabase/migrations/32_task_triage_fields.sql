-- MediTrack — Migration 32: task triage fields (category + urgency).
-- The secretary's "escalation" path (a call that can't be resolved live) creates a task
-- through a structured form: category, urgency, responsible therapist, note. `assignee_id`
-- (responsible) and `note` already exist; add the two missing structured fields.
--   urgency  : reuses the Hebrew urgency vocabulary already used across the app
--              (URGENCY_TONE) — 'רגיל' / 'בהקדם' / 'דחוף'. Nullable (auto/legacy tasks
--              have none); drives board ordering + a colored badge.
--   category : the escalation subject (אדמיניסטרציה / תיאום מטפל / רפואי / אחר). Free text
--              (the UI offers a fixed chip set) so the vocabulary can evolve without a
--              migration.
alter table public.tasks
  add column if not exists urgency  text,
  add column if not exists category text;

alter table public.tasks drop constraint if exists tasks_urgency_check;
alter table public.tasks
  add constraint tasks_urgency_check
  check (urgency is null or urgency in ('רגיל','בהקדם','דחוף'));
