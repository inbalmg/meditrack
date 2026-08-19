-- MediTrack — Migration 28: inquiry "converted to task" terminal status.
-- The secretary resolves an active inquiry (kind='inquiry') via one of two mutually
-- exclusive terminal outcomes, both of which drop it off the active board:
--   • Direct close  → status 'סגור'   (no task created)
--   • Convert to task → a tasks row is created (status 'בטיפול') AND the request is
--                       marked 'הומר למשימה' so it leaves the queue immediately.
-- This adds the new 'הומר למשימה' status. All prior values are kept (incl. the now-unused
-- 'נוצר קשר') so existing rows stay valid. No tasks migration is needed — 'בטיפול' is
-- already a valid task status and tasks.assignee_id is nullable with no FK (migration 10),
-- so a converted task can be left unassigned (the "general / office" default).
alter table public.requests drop constraint requests_status_check;
alter table public.requests
  add constraint requests_status_check
  check (status in ('ממתין', 'אושר', 'נדחה', 'נוצר קשר', 'סגור', 'הומר למשימה'));
